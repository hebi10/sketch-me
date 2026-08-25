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
    const editorRef = useRef<HTMLElement>(null);
    const fullscreenEntryRef = useRef<HTMLButtonElement>(null);
    const fullscreenRestoreFocusRef = useRef(false);
    const fullscreenConfirmRef = useRef<HTMLButtonElement>(null);
    const drawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const referencePointers = useRef(new Map<number, { x: number; y: number }>());
    const [tab, setTab] = useState<EditorTab>('draw');
    const [color, setColor] = useState<string>(sketchColors[0].value);
    const [lineWidth, setLineWidth] = useState(5);
    const [penOpacity, setPenOpacity] = useState(100);
    const [eraser, setEraser] = useState(false);
    const [history, setHistory] = useState<CanvasHistory | null>(null);
    const [referenceScale, setReferenceScale] = useState(1);
    const [referenceOpacity, setReferenceOpacity] = useState(100);
    const [referenceOffset, setReferenceOffset] = useState({ x: 0, y: 0 });
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [controlsOpen, setControlsOpen] = useState(false);
    const [confirmedDrawing, setConfirmedDrawing] = useState<string | null>(null);
    const [drawingError, setDrawingError] = useState<string | null>(null);

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

    function createDrawingOutput() {
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
    }

    useImperativeHandle(ref, () => ({
      hasDrawing: () => Boolean(confirmedDrawing),
      exportDrawing: () => confirmedDrawing,
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setHistory(createCanvasHistory(canvas.toDataURL('image/png')));
    }, []);

    useEffect(() => {
      if (!isFullscreen) {
        if (fullscreenRestoreFocusRef.current) {
          fullscreenRestoreFocusRef.current = false;
          fullscreenEntryRef.current?.focus();
        }
        return;
      }
      const previousOverflow = document.body.style.overflow;
      const editor = editorRef.current;
      const inertSiblings: Array<{ element: HTMLElement; wasInert: boolean }> = [];
      let current: HTMLElement | null = editor;
      while (current?.parentElement && current.parentElement !== document.body) {
        [...current.parentElement.children].forEach((sibling) => {
          if (sibling === current || !(sibling instanceof HTMLElement)) return;
          inertSiblings.push({ element: sibling, wasInert: sibling.hasAttribute('inert') });
          sibling.setAttribute('inert', '');
        });
        current = current.parentElement;
      }
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setControlsOpen(false);
          setIsFullscreen(false);
          return;
        }
        if (event.key !== 'Tab' || !editor) return;
        const focusable = [...editor.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
          .filter((element) => !element.closest('[hidden]'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      fullscreenConfirmRef.current?.focus();
      return () => {
        document.body.style.overflow = previousOverflow;
        window.removeEventListener('keydown', handleKeyDown);
        inertSiblings.forEach(({ element, wasInert }) => { if (!wasInert) element.removeAttribute('inert'); });
        fullscreenRestoreFocusRef.current = true;
      };
    }, [isFullscreen]);

    function drawLine(from: { x: number; y: number }, to: { x: number; y: number }) {
      const drawingContext = context();
      if (!drawingContext) return;
      drawingContext.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
      drawingContext.globalAlpha = eraser ? 1 : penOpacity / 100;
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
        drawingContext.globalAlpha = 1;
        drawingContext.clearRect(0, 0, width, height);
        drawingContext.drawImage(image, 0, 0, width, height);
        setHistory(next);
      };
      image.src = source;
    }

    function clear() {
      const drawingContext = context();
      if (!drawingContext) return;
      drawingContext.globalAlpha = 1;
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

    function openDrawing() {
      setControlsOpen(false);
      setDrawingError(null);
      setIsFullscreen(true);
    }

    function confirmDrawing() {
      const output = createDrawingOutput();
      if (!output) {
        setDrawingError('그림을 한 번 이상 그린 뒤 확인해 주세요.');
        return;
      }
      setConfirmedDrawing(output);
      setControlsOpen(false);
      setDrawingError(null);
      setIsFullscreen(false);
    }

    return (
      <section aria-label={isFullscreen ? '전체 화면 그리기' : undefined} aria-modal={isFullscreen || undefined} className={`sketch-editor ${isFullscreen ? 'sketch-editor--fullscreen' : ''}`} ref={editorRef} role={isFullscreen ? 'dialog' : undefined}>
        {!isFullscreen && !confirmedDrawing ? <button className="button button--primary drawing-entry-button" onClick={openDrawing} ref={fullscreenEntryRef} type="button">그림 그리기</button> : null}
        {!isFullscreen && confirmedDrawing ? <figure className="drawing-preview"><Image alt="그린 그림 미리보기" height={height} src={confirmedDrawing} unoptimized width={width} /></figure> : null}
        <div className={`sketch-stage sketch-stage--${tab}`} hidden={!isFullscreen} onPointerCancel={referencePointerEnd} onPointerDown={referencePointerDown} onPointerMove={referencePointerMove} onPointerUp={referencePointerEnd}>
          {referenceImageUrl ? (
            <div className="reference-layer" style={{ opacity: referenceOpacity / 100, transform: `translate(${referenceOffset.x}px, ${referenceOffset.y}px) scale(${referenceScale})` }}>
              <Image alt="그림 참고 사진" fill sizes="(max-width: 640px) 100vw, 600px" src={referenceImageUrl} unoptimized />
            </div>
          ) : null}
          <canvas aria-label={ariaLabel} className="drawing-canvas" height={height} onPointerCancel={pointerEnd} onPointerDown={pointerDown} onPointerLeave={pointerEnd} onPointerMove={pointerMove} onPointerUp={pointerEnd} ref={canvasRef} width={width} />
        </div>
        <div className="editor-control-panel" hidden={!isFullscreen || !controlsOpen}>
          <nav aria-label="그림 편집 단계" className="editor-tabs">
            <button aria-pressed={tab === 'draw'} onClick={() => setTab('draw')} type="button">그리기</button>
            <button aria-pressed={tab === 'reference'} disabled={!referenceImageUrl} onClick={() => setTab('reference')} type="button">참고사진</button>
            <button aria-pressed={tab === 'edit'} onClick={() => setTab('edit')} type="button">편집</button>
          </nav>
          <div className="draw-tools">
            {tab === 'reference' ? (
              <div className="reference-controls"><p>한 손가락으로 이동하고 두 손가락으로 확대·축소하세요.</p><label className="range-control"><span>사진 투명도</span><strong>{referenceOpacity}%</strong><input aria-label="사진 투명도" max="100" min="10" onChange={(event) => setReferenceOpacity(Number(event.target.value))} step="5" type="range" value={referenceOpacity} /></label><label className="range-control"><span>확대</span><strong>{Math.round(referenceScale * 100)}%</strong><input aria-label="확대" max="3" min="0.6" onChange={(event) => setReferenceScale(Number(event.target.value))} step="0.1" type="range" value={referenceScale} /></label><button className="tool-button" onClick={() => { setReferenceOffset({ x: 0, y: 0 }); setReferenceScale(1); }} type="button">위치 초기화</button></div>
            ) : (
              <><div className="tool-row"><button className={`tool-button ${!eraser ? 'is-active' : ''}`} onClick={() => { setEraser(false); setTab('draw'); }} type="button">펜</button><button className={`tool-button ${eraser ? 'is-active' : ''}`} onClick={() => { setEraser(true); setTab('draw'); }} type="button">지우개</button><button className="tool-button" disabled={!history || history.index === 0} onClick={() => history && restore(undoSnapshot(history))} type="button">되돌리기</button><button className="tool-button" disabled={!history || history.index >= history.snapshots.length - 1} onClick={() => history && restore(redoSnapshot(history))} type="button">다시 실행</button><button className="tool-button" onClick={clear} type="button">전체 삭제</button></div>
              <div className="tool-row">{sketchColors.map((nextColor) => <button aria-label={`${nextColor.label} 색상`} aria-pressed={color === nextColor.value && !eraser} className={`color-swatch ${color === nextColor.value && !eraser ? 'is-active' : ''}`} key={nextColor.value} onClick={() => { setColor(nextColor.value); setEraser(false); setTab('draw'); }} style={{ backgroundColor: nextColor.value }} type="button" />)}</div>
              <div className="drawing-range-controls"><label className="range-control"><span>펜 투명도</span><strong>{penOpacity}%</strong><input aria-label="펜 투명도" max="100" min="10" onChange={(event) => setPenOpacity(Number(event.target.value))} step="5" type="range" value={penOpacity} /></label><label className="range-control"><span>굵기</span><strong>{lineWidth}</strong><input aria-label="굵기" max="18" min="2" onChange={(event) => setLineWidth(Number(event.target.value))} type="range" value={lineWidth} /></label></div></>
            )}
          </div>
        </div>
        {isFullscreen ? (
          <><div className="fullscreen-controls">
              <button className="fullscreen-confirm" onClick={confirmDrawing} ref={fullscreenConfirmRef} type="button">확인</button>
              <button aria-expanded={controlsOpen} aria-label={controlsOpen ? '그리기 도구 닫기' : '그리기 도구 열기'} onClick={() => setControlsOpen((current) => !current)} type="button"><Image alt="" height={30} src="/icons/drawing-controls.webp" width={30} /></button>
            </div>{drawingError ? <p className="fullscreen-drawing-error" role="alert">{drawingError}</p> : null}</>
        ) : null}
      </section>
    );
  },
);
