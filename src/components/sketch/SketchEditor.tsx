'use client';

import Image from 'next/image';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

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
  initialDrawingDataUrl?: string | null;
  onDrawingChange?: (dataUrl: string | null) => void;
  referenceImageUrl?: string | null;
}

type EditorTab = 'draw' | 'reference' | 'edit';

export const SketchEditor = forwardRef<SketchEditorHandle, SketchEditorProps>(
  function SketchEditor({ ariaLabel, initialDrawingDataUrl = null, onDrawingChange, referenceImageUrl }, ref) {
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
    const [customColor, setCustomColor] = useState<string | null>(null);
    const [lineWidth, setLineWidth] = useState(5);
    const [penOpacity, setPenOpacity] = useState(100);
    const [eraser, setEraser] = useState(false);
    const [history, setHistory] = useState<CanvasHistory | null>(null);
    const [referenceScale, setReferenceScale] = useState(1);
    const [referenceOpacity, setReferenceOpacity] = useState(100);
    const [referenceOffset, setReferenceOffset] = useState({ x: 0, y: 0 });
    const [referenceVisible, setReferenceVisible] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [controlsOpen, setControlsOpen] = useState(false);
    const [confirmedDrawing, setConfirmedDrawing] = useState<string | null>(null);
    const [drawingError, setDrawingError] = useState<string | null>(null);
    const [drawingImportStatus, setDrawingImportStatus] = useState<string | null>(null);

    const context = useCallback(() => {
      return canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null;
    }, []);

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

    const canvasHasDrawing = useCallback(() => {
      const drawingContext = context();
      if (!drawingContext) return false;
      const pixels = drawingContext.getImageData(0, 0, width, height).data;
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] !== 0) return true;
      }
      return false;
    }, [context]);

    const requestExit = useCallback(() => {
      if (canvasHasDrawing() && !window.confirm('그림을 그만두면 현재 작업이 사라집니다. 나가시겠어요?')) return;
      const drawingContext = context();
      drawingContext?.clearRect(0, 0, width, height);
      setHistory((current) => current ? createCanvasHistory(current.snapshots[0]) : current);
      setControlsOpen(false);
      setDrawingError(null);
      setDrawingImportStatus(null);
      setIsFullscreen(false);
    }, [canvasHasDrawing, context]);

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
      if (!initialDrawingDataUrl) return;
      const drawingContext = context();
      if (!drawingContext) return;
      const image = new window.Image();
      image.onload = () => {
        drawingContext.globalAlpha = 1;
        drawingContext.clearRect(0, 0, width, height);
        drawingContext.drawImage(image, 0, 0, width, height);
        snapshot();
        setConfirmedDrawing(initialDrawingDataUrl);
      };
      image.src = initialDrawingDataUrl;
    }, [context, initialDrawingDataUrl]);

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
          requestExit();
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
    }, [isFullscreen, requestExit]);

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

    function selectCustomColor(event: React.ChangeEvent<HTMLInputElement>) {
      const nextColor = event.target.value.toLowerCase();
      setCustomColor(nextColor);
      setColor(nextColor);
      setEraser(false);
      setTab('draw');
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

    function importDrawing(event: React.ChangeEvent<HTMLInputElement>) {
      const file = event.target.files?.[0];
      if (!file) return;
      setDrawingImportStatus(null);
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setDrawingError('PNG, JPG, WEBP 그림만 불러올 수 있어요.');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setDrawingError('그림 파일은 2MB 이하로 선택해 주세요.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          setDrawingError('그림 파일을 읽지 못했습니다. 다른 파일을 선택해 주세요.');
          return;
        }
        const image = new window.Image();
        image.onload = () => {
          const drawingContext = context();
          if (!drawingContext || !image.naturalWidth || !image.naturalHeight) return;
          const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
          const drawWidth = image.naturalWidth * scale;
          const drawHeight = image.naturalHeight * scale;
          drawingContext.globalAlpha = 1;
          drawingContext.clearRect(0, 0, width, height);
          drawingContext.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
          snapshot();
          setDrawingError(null);
          setDrawingImportStatus('그림을 불러왔어요. 확인을 누르면 제출할 수 있어요.');
        };
        image.onerror = () => setDrawingError('그림 파일을 열지 못했습니다. 다른 파일을 선택해 주세요.');
        image.src = reader.result;
      };
      reader.onerror = () => setDrawingError('그림 파일을 읽지 못했습니다. 다른 파일을 선택해 주세요.');
      reader.readAsDataURL(file);
      event.target.value = '';
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
      setDrawingImportStatus(null);
      setIsFullscreen(true);
    }

    function confirmDrawing() {
      const output = createDrawingOutput();
      if (!output) {
        setDrawingError('그림을 한 번 이상 그린 뒤 확인해 주세요.');
        return;
      }
      setConfirmedDrawing(output);
      onDrawingChange?.(output);
      setControlsOpen(false);
      setDrawingError(null);
      setDrawingImportStatus(null);
      setIsFullscreen(false);
    }

    return (
      <section aria-label={isFullscreen ? '전체 화면 그리기' : undefined} aria-modal={isFullscreen || undefined} className={`sketch-editor ${isFullscreen ? 'sketch-editor--fullscreen' : ''}`} ref={editorRef} role={isFullscreen ? 'dialog' : undefined}>
        {!isFullscreen && !confirmedDrawing ? <button className="button button--primary drawing-entry-button" onClick={openDrawing} ref={fullscreenEntryRef} type="button">그림 그리기</button> : null}
        {!isFullscreen && confirmedDrawing ? <figure className="drawing-preview"><Image alt="그린 그림 미리보기" height={height} src={confirmedDrawing} unoptimized width={width} /></figure> : null}
        <div className={`sketch-stage sketch-stage--${tab}`} hidden={!isFullscreen} onPointerCancel={referencePointerEnd} onPointerDown={referencePointerDown} onPointerMove={referencePointerMove} onPointerUp={referencePointerEnd}>
          {referenceImageUrl ? (
            <div className="reference-layer" hidden={!referenceVisible} style={{ opacity: referenceOpacity / 100, transform: `translate(${referenceOffset.x}px, ${referenceOffset.y}px) scale(${referenceScale})` }}>
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
              <div className="reference-controls"><p>한 손가락으로 이동하고 두 손가락으로 확대·축소하세요.</p><button aria-pressed={referenceVisible} className="tool-button reference-visibility-toggle" onClick={() => setReferenceVisible((current) => !current)} type="button">참고 사진 {referenceVisible ? '숨기기' : '보기'}</button><label className="range-control"><span>사진 투명도</span><strong>{referenceOpacity}%</strong><input aria-label="사진 투명도" max="100" min="10" onChange={(event) => setReferenceOpacity(Number(event.target.value))} step="5" type="range" value={referenceOpacity} /></label><label className="range-control"><span>확대</span><strong>{Math.round(referenceScale * 100)}%</strong><input aria-label="확대" max="3" min="0.6" onChange={(event) => setReferenceScale(Number(event.target.value))} step="0.1" type="range" value={referenceScale} /></label><button className="tool-button" onClick={() => { setReferenceOffset({ x: 0, y: 0 }); setReferenceScale(1); }} type="button">위치 초기화</button></div>
            ) : (
              <><div className="tool-row"><button className={`tool-button ${!eraser ? 'is-active' : ''}`} onClick={() => { setEraser(false); setTab('draw'); }} type="button">펜</button><button className={`tool-button ${eraser ? 'is-active' : ''}`} onClick={() => { setEraser(true); setTab('draw'); }} type="button">지우개</button><button className="tool-button" disabled={!history || history.index === 0} onClick={() => history && restore(undoSnapshot(history))} type="button">되돌리기</button><button className="tool-button" disabled={!history || history.index >= history.snapshots.length - 1} onClick={() => history && restore(redoSnapshot(history))} type="button">다시 실행</button><button className="tool-button" onClick={clear} type="button">전체 삭제</button></div>
              <div className="tool-row color-palette">{sketchColors.map((nextColor) => <button aria-label={`${nextColor.label} 색상`} aria-pressed={color === nextColor.value && !eraser} className={`color-swatch ${color === nextColor.value && !eraser ? 'is-active' : ''}`} key={nextColor.value} onClick={() => { setColor(nextColor.value); setEraser(false); setTab('draw'); }} style={{ backgroundColor: nextColor.value }} type="button" />)}<label className={`color-swatch custom-color-swatch ${customColor === color && !eraser ? 'is-active' : ''}`} style={{ backgroundColor: customColor ?? 'var(--canvas)' }}><span aria-hidden="true">+</span><input aria-label={customColor ? `사용자 지정 색상 ${customColor}` : '사용자 지정 색상 선택'} onChange={selectCustomColor} type="color" value={customColor ?? sketchColors[0].value} /></label></div>
              <div className="drawing-range-controls"><label className="range-control"><span>펜 투명도</span><strong>{penOpacity}%</strong><input aria-label="펜 투명도" max="100" min="10" onChange={(event) => setPenOpacity(Number(event.target.value))} step="5" type="range" value={penOpacity} /></label><label className="range-control"><span>굵기</span><strong>{lineWidth}</strong><input aria-label="굵기" max="18" min="2" onChange={(event) => setLineWidth(Number(event.target.value))} type="range" value={lineWidth} /></label></div></>
            )}
          </div>
        </div>
        {isFullscreen ? (
          <><div className="fullscreen-controls">
              <button className="fullscreen-confirm" onClick={confirmDrawing} ref={fullscreenConfirmRef} type="button">확인</button>
              <button aria-label="그리기 나가기" className="fullscreen-exit" onClick={requestExit} type="button"><Image alt="" height={30} src="/icons/fullscreen-back.webp" width={30} /></button>
              <button aria-expanded={controlsOpen} aria-label={controlsOpen ? '그리기 도구 닫기' : '그리기 도구 열기'} onClick={() => setControlsOpen((current) => !current)} type="button"><Image alt="" height={30} src="/icons/drawing-controls.webp" width={30} /></button>
              <label className="fullscreen-import" htmlFor="drawing-import">그림 불러오기<input accept="image/jpeg,image/png,image/webp" aria-label="완성된 그림 불러오기" id="drawing-import" onChange={importDrawing} type="file" /></label>
            </div>{drawingError ? <p className="fullscreen-drawing-error" role="alert">{drawingError}</p> : null}
            {drawingImportStatus ? <p className="sr-only" role="status">{drawingImportStatus}</p> : null}</>
        ) : null}
      </section>
    );
  },
);
