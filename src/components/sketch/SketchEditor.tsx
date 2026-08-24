'use client';

import Image from 'next/image';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

import {
  createCanvasHistory,
  pushSnapshot,
  redoSnapshot,
  undoSnapshot,
  type CanvasHistory,
} from './canvas-history';
import { sketchColors } from './colors';

const width = 720;
const height = 720;

export interface SketchEditorHandle {
  exportDrawing: () => string | null;
  hasDrawing: () => boolean;
}

interface SketchEditorProps {
  ariaLabel: string;
  referenceImageUrl?: string | null;
}

type EditorTab = 'draw' | 'reference' | 'edit';

export const SketchEditor = forwardRef<SketchEditorHandle, SketchEditorProps>(
  function SketchEditor({ ariaLabel, referenceImageUrl }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const referencePointers = useRef(new Map<number, { x: number; y: number }>());
    const [tab, setTab] = useState<EditorTab>('draw');
    const [color, setColor] = useState<string>(sketchColors[0].value);
    const [lineWidth, setLineWidth] = useState(5);
    const [eraser, setEraser] = useState(false);
    const [history, setHistory] = useState<CanvasHistory | null>(null);
    const [referenceScale, setReferenceScale] = useState(1);
    const [referenceOffset, setReferenceOffset] = useState({ x: 0, y: 0 });

    function context() {
      return canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null;
    }

    function canvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const bounds = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - bounds.left) / bounds.width) * width,
        y: ((event.clientY - bounds.top) / bounds.height) * height,
      };
    }

    function snapshot() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const next = canvas.toDataURL('image/png');
      setHistory((current) => current ? pushSnapshot(current, next) : createCanvasHistory(next));
    }

    function canvasHasDrawing() {
      const drawingContext = context();
      if (!drawingContext) return false;
      const pixels = drawingContext.getImageData(0, 0, width, height).data;
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] !== 0) return true;
      }
      return false;
    }

    useImperativeHandle(ref, () => ({
      hasDrawing: canvasHasDrawing,
      exportDrawing: () => {
        const canvas = canvasRef.current;
        if (!canvas || !canvasHasDrawing()) return null;
        const output = document.createElement('canvas');
        output.width = width;
        output.height = height;
        const outputContext = output.getContext('2d');
        if (!outputContext) return null;
        outputContext.fillStyle = '#ffffff';
        outputContext.fillRect(0, 0, width, height);
        outputContext.drawImage(canvas, 0, 0);
        return output.toDataURL('image/webp', 0.76);
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setHistory(createCanvasHistory(canvas.toDataURL('image/png')));
    }, []);

    function drawLine(from: { x: number; y: number }, to: { x: number; y: number }) {
      const drawingContext = context();
      if (!drawingContext) return;
      drawingContext.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
      drawingContext.strokeStyle = color;
      drawingContext.lineCap = 'round';
      drawingContext.lineJoin = 'round';
      drawingContext.lineWidth = eraser ? lineWidth * 3 : lineWidth;
      drawingContext.beginPath();
      drawingContext.moveTo(from.x, from.y);
      drawingContext.lineTo(to.x, to.y);
      drawingContext.stroke();
    }

    function pointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
      if (tab !== 'draw') return;
      const point = canvasPoint(event);
      if (!point) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drawingRef.current = true;
      lastPointRef.current = point;
      drawLine(point, { x: point.x + 0.1, y: point.y + 0.1 });
    }

    function pointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawingRef.current || tab !== 'draw') return;
      const point = canvasPoint(event);
      if (!point || !lastPointRef.current) return;
      drawLine(lastPointRef.current, point);
      lastPointRef.current = point;
    }

    function pointerEnd() {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      lastPointRef.current = null;
      snapshot();
    }

    function restore(next: CanvasHistory) {
      const drawingContext = context();
      const source = next.snapshots[next.index];
      if (!drawingContext || !source) return;
      const image = new window.Image();
      image.onload = () => {
        drawingContext.clearRect(0, 0, width, height);
        drawingContext.drawImage(image, 0, 0, width, height);
        setHistory(next);
      };
      image.src = source;
    }

    function clear() {
      const drawingContext = context();
      if (!drawingContext) return;
      drawingContext.clearRect(0, 0, width, height);
      snapshot();
    }

    function referencePointerDown(event: React.PointerEvent<HTMLDivElement>) {
      if (tab !== 'reference') return;
      event.currentTarget.setPointerCapture(event.pointerId);
      referencePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    function referencePointerMove(event: React.PointerEvent<HTMLDivElement>) {
      const previous = referencePointers.current.get(event.pointerId);
      if (!previous || tab !== 'reference') return;
      const before = [...referencePointers.current.values()];
      referencePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const after = [...referencePointers.current.values()];
      if (before.length === 1) {
        setReferenceOffset((current) => ({ x: current.x + event.clientX - previous.x, y: current.y + event.clientY - previous.y }));
      } else if (before.length >= 2) {
        const oldDistance = Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y);
        const newDistance = Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y);
        if (oldDistance > 0) setReferenceScale((current) => Math.min(3, Math.max(0.6, current * (newDistance / oldDistance))));
      }
    }

    function referencePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
      referencePointers.current.delete(event.pointerId);
    }

    return (
      <section className="sketch-editor">
        <div className={`sketch-stage sketch-stage--${tab}`} onPointerCancel={referencePointerEnd} onPointerDown={referencePointerDown} onPointerMove={referencePointerMove} onPointerUp={referencePointerEnd}>
          {referenceImageUrl ? (
            <div className="reference-layer" style={{ transform: `translate(${referenceOffset.x}px, ${referenceOffset.y}px) scale(${referenceScale})` }}>
              <Image alt="그림 참고 사진" fill sizes="(max-width: 640px) 100vw, 600px" src={referenceImageUrl} unoptimized />
            </div>
          ) : null}
          <canvas aria-label={ariaLabel} className="drawing-canvas" height={height} onPointerCancel={pointerEnd} onPointerDown={pointerDown} onPointerLeave={pointerEnd} onPointerMove={pointerMove} onPointerUp={pointerEnd} ref={canvasRef} width={width} />
        </div>
        <nav aria-label="그림 편집 단계" className="editor-tabs">
          <button aria-pressed={tab === 'draw'} onClick={() => setTab('draw')} type="button">그리기</button>
          <button aria-pressed={tab === 'reference'} disabled={!referenceImageUrl} onClick={() => setTab('reference')} type="button">참고사진</button>
          <button aria-pressed={tab === 'edit'} onClick={() => setTab('edit')} type="button">편집</button>
        </nav>
        <div className="draw-tools">
          {tab === 'reference' ? (
            <div className="reference-controls"><p>한 손가락으로 이동하고 두 손가락으로 확대·축소하세요.</p><label>확대<input max="3" min="0.6" onChange={(event) => setReferenceScale(Number(event.target.value))} step="0.1" type="range" value={referenceScale} /></label><button className="tool-button" onClick={() => { setReferenceOffset({ x: 0, y: 0 }); setReferenceScale(1); }} type="button">위치 초기화</button></div>
          ) : (
            <><div className="tool-row"><button className={`tool-button ${!eraser ? 'is-active' : ''}`} onClick={() => { setEraser(false); setTab('draw'); }} type="button">펜</button><button className={`tool-button ${eraser ? 'is-active' : ''}`} onClick={() => { setEraser(true); setTab('draw'); }} type="button">지우개</button><button className="tool-button" disabled={!history || history.index === 0} onClick={() => history && restore(undoSnapshot(history))} type="button">되돌리기</button><button className="tool-button" disabled={!history || history.index >= history.snapshots.length - 1} onClick={() => history && restore(redoSnapshot(history))} type="button">다시 실행</button><button className="tool-button" onClick={clear} type="button">전체 삭제</button></div>
            <div className="tool-row">{sketchColors.map((nextColor) => <button aria-label={`${nextColor.label} 색상`} aria-pressed={color === nextColor.value && !eraser} className={`color-swatch ${color === nextColor.value && !eraser ? 'is-active' : ''}`} key={nextColor.value} onClick={() => { setColor(nextColor.value); setEraser(false); setTab('draw'); }} style={{ backgroundColor: nextColor.value }} type="button" />)}<label className="line-width">굵기<input max="18" min="2" onChange={(event) => setLineWidth(Number(event.target.value))} type="range" value={lineWidth} /></label></div></>
          )}
        </div>
      </section>
    );
  },
);
