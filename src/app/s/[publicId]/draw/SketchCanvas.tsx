'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface SketchCanvasProps {
  publicId: string;
  sketchbookName: string;
}

const canvasWidth = 720;
const canvasHeight = 960;

export function SketchCanvas({ publicId, sketchbookName }: SketchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState('#181818');
  const [lineWidth, setLineWidth] = useState(5);
  const [isEraser, setIsEraser] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [authorName, setAuthorName] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function getContext() {
    return canvasRef.current?.getContext('2d') ?? null;
  }

  function rememberCanvas() {
    const source = canvasRef.current;
    if (!source) return;
    const image = source.toDataURL('image/png');
    setHistory((current) => [...current.slice(0, historyIndex + 1), image]);
    setHistoryIndex((current) => current + 1);
  }

  useEffect(() => {
    const context = getContext();
    if (!context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    rememberCanvas();
    // 초기 빈 캔버스만 기록합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvasWidth,
      y: ((event.clientY - bounds.top) / bounds.height) * canvasHeight,
    };
  }

  function drawLine(from: { x: number; y: number }, to: { x: number; y: number }) {
    const context = getContext();
    if (!context) return;
    context.strokeStyle = isEraser ? '#ffffff' : color;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = isEraser ? lineWidth * 3 : lineWidth;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = getPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    isDrawingRef.current = true;
    lastPointRef.current = point;
    drawLine(point, { x: point.x + 0.1, y: point.y + 0.1 });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const point = getPoint(event);
    if (!point || !lastPointRef.current) return;
    drawLine(lastPointRef.current, point);
    lastPointRef.current = point;
  }

  function handlePointerEnd() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    rememberCanvas();
  }

  function clearCanvas() {
    const context = getContext();
    if (!context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    rememberCanvas();
  }

  function restoreHistory(nextIndex: number) {
    const imageData = history[nextIndex];
    const context = getContext();
    if (!imageData || !context) return;
    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, canvasWidth, canvasHeight);
      context.drawImage(image, 0, 0, canvasWidth, canvasHeight);
      setHistoryIndex(nextIndex);
    };
    image.src = imageData;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canvasRef.current) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/sketchbooks/${publicId}/drawings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName,
          message,
          imageDataUrl: canvasRef.current.toDataURL('image/png'),
          usedReferenceImage: false,
        }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? '그림을 남기지 못했습니다.');
      router.push(`/s/${publicId}?submitted=1`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : '그림을 남기지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="draw-shell">
      <header className="draw-header">
        <button className="icon-button" onClick={() => router.back()} type="button" aria-label="이전으로">←</button>
        <p>{sketchbookName}님을 그려주세요</p>
        <span aria-hidden="true" />
      </header>
      <canvas
        aria-label={`${sketchbookName}님을 위한 그림 캔버스`}
        className="drawing-canvas"
        height={canvasHeight}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerLeave={handlePointerEnd}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        ref={canvasRef}
        width={canvasWidth}
      />
      <section className="draw-tools" aria-label="그림 도구">
        <div className="tool-row">
          <button className={`tool-button ${!isEraser ? 'is-active' : ''}`} onClick={() => setIsEraser(false)} type="button">펜</button>
          <button className={`tool-button ${isEraser ? 'is-active' : ''}`} onClick={() => setIsEraser(true)} type="button">지우개</button>
          <button className="tool-button" disabled={historyIndex <= 0} onClick={() => restoreHistory(historyIndex - 1)} type="button">되돌리기</button>
          <button className="tool-button" onClick={clearCanvas} type="button">전체 삭제</button>
        </div>
        <div className="tool-row">
          {['#181818', '#6e6e6e', '#5c6f8f', '#a35d29', '#c6a878'].map((nextColor) => (
            <button
              aria-label={`${nextColor} 색상`}
              className={`color-swatch ${color === nextColor && !isEraser ? 'is-active' : ''}`}
              key={nextColor}
              onClick={() => { setColor(nextColor); setIsEraser(false); }}
              style={{ backgroundColor: nextColor }}
              type="button"
            />
          ))}
          <label className="line-width">
            굵기
            <input max="18" min="2" onChange={(event) => setLineWidth(Number(event.target.value))} type="range" value={lineWidth} />
          </label>
        </div>
      </section>
      <form className="drawing-submit-form" onSubmit={submit}>
        <label className="field-label" htmlFor="author-name">내 이름</label>
        <input id="author-name" maxLength={24} onChange={(event) => setAuthorName(event.target.value)} required value={authorName} />
        <label className="field-label" htmlFor="drawing-message">한마디 <span>(선택)</span></label>
        <textarea id="drawing-message" maxLength={120} onChange={(event) => setMessage(event.target.value)} rows={3} value={message} />
        {error ? <p aria-live="polite" className="form-error">{error}</p> : null}
        <button className="button button--primary" disabled={isSubmitting} type="submit">{isSubmitting ? '그림 남기는 중...' : '그림 남기기'}</button>
      </form>
    </main>
  );
}
