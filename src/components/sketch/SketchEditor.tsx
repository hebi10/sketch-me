'use client';

import Image from 'next/image';
import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState, type CSSProperties } from 'react';

import {
  createCanvasHistory,
  pushSnapshot,
  redoSnapshot,
  undoSnapshot,
  type CanvasHistory,
} from './canvas-history';
import { sketchColors } from './colors';
import { drawImportedImage, validateSketchImport } from './import-image';

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
  reopenLabel?: string;
}

type EditorTab = 'draw' | 'guide';

const loupeSize = 104;
const loupeHorizontalOffset = 64;

export const SketchEditor = forwardRef<SketchEditorHandle, SketchEditorProps>(
  function SketchEditor({ ariaLabel, initialDrawingDataUrl = null, onDrawingChange, reopenLabel }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const loupeCanvasRef = useRef<HTMLCanvasElement>(null);
    const loupeRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLElement>(null);
    const fullscreenEntryRef = useRef<HTMLButtonElement>(null);
    const fullscreenRestoreFocusRef = useRef(false);
    const fullscreenConfirmRef = useRef<HTMLButtonElement>(null);
    const drawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const canvasHelpId = useId();
    const [tab, setTab] = useState<EditorTab>('draw');
    const [crosshairVisible, setCrosshairVisible] = useState(true);
    const [color, setColor] = useState<string>(sketchColors[0].value);
    const [customColor, setCustomColor] = useState<string | null>(null);
    const [lineWidth, setLineWidth] = useState(5);
    const [penOpacity, setPenOpacity] = useState(100);
    const [eraser, setEraser] = useState(false);
    const [history, setHistory] = useState<CanvasHistory | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [controlsOpen, setControlsOpen] = useState(false);
    const [loupeEnabled, setLoupeEnabled] = useState(true);
    const [leftHandMode, setLeftHandMode] = useState(false);
    const [loupeActive, setLoupeActive] = useState(false);
    const [confirmedDrawing, setConfirmedDrawing] = useState<string | null>(null);
    const [drawingError, setDrawingError] = useState<string | null>(null);
    const [importStatus, setImportStatus] = useState('');
    const loupeBrushStyle = {
      '--loupe-brush-color': eraser ? '#ffffff' : color,
      '--loupe-brush-opacity': eraser ? '100%' : `${penOpacity}%`,
      '--loupe-brush-size': `${eraser ? lineWidth * 3 : lineWidth}px`,
    } as CSSProperties;

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

    const currentDrawingHasContent = useCallback(() => {
      const canvas = canvasRef.current;
      const drawingContext = canvas?.getContext('2d', { willReadFrequently: true });
      if (!canvas || !drawingContext) return false;
      const pixels = drawingContext.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] > 0) return true;
      }
      return false;
    }, []);

    const requestExit = useCallback(() => {
      if (currentDrawingHasContent() && !window.confirm('그림을 그만두면 현재 작업이 사라집니다. 나가시겠어요?')) return;
      const drawingContext = context();
      drawingContext?.clearRect(0, 0, width, height);
      setHistory((current) => current ? createCanvasHistory(current.snapshots[0]) : current);
      setLoupeActive(false);
      setControlsOpen(false);
      setDrawingError(null);
      setIsFullscreen(false);
    }, [context, currentDrawingHasContent]);

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

    function updateLoupe(point: { x: number; y: number }) {
      const canvas = canvasRef.current;
      const loupe = loupeRef.current;
      const loupeContext = loupeCanvasRef.current?.getContext('2d');
      if (!canvas || !loupe || !loupeContext) return;

      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const sourceSize = Math.min(width, (loupeSize / 2) * (width / bounds.width));
      const sourceX = Math.min(width - sourceSize, Math.max(0, point.x - sourceSize / 2));
      const sourceY = Math.min(height - sourceSize, Math.max(0, point.y - sourceSize / 2));
      const canvasPixelsPerCssPixel = width / bounds.width;
      const horizontalDirection = leftHandMode ? 1 : -1;
      const displayX = point.x + horizontalDirection * loupeHorizontalOffset * canvasPixelsPerCssPixel;

      loupe.style.left = `${(displayX / width) * 100}%`;
      loupe.style.top = `${(point.y / height) * 100}%`;
      loupeContext.clearRect(0, 0, loupeSize, loupeSize);
      loupeContext.drawImage(
        canvas,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        loupeSize,
        loupeSize,
      );
    }

    function selectCustomColor(event: React.ChangeEvent<HTMLInputElement>) {
      const nextColor = event.target.value.toLowerCase();
      setCustomColor(nextColor);
      setColor(nextColor);
      setEraser(false);
      setTab('draw');
    }

    function pointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
      const point = canvasPoint(event);
      if (!point) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drawingRef.current = true;
      lastPointRef.current = point;
      drawLine(point, { x: point.x + 0.1, y: point.y + 0.1 });
      if (loupeEnabled) {
        updateLoupe(point);
        setLoupeActive(true);
      }
    }

    function pointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawingRef.current) return;
      const point = canvasPoint(event);
      if (!point || !lastPointRef.current) return;
      drawLine(lastPointRef.current, point);
      lastPointRef.current = point;
      if (loupeEnabled) updateLoupe(point);
    }

    function pointerEnd() {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      lastPointRef.current = null;
      setLoupeActive(false);
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

    function openDrawing() {
      setControlsOpen(false);
      setDrawingError(null);
      setIsFullscreen(true);
    }

    function finishDrawing(output: string) {
      setConfirmedDrawing(output);
      onDrawingChange?.(output);
      setControlsOpen(false);
      setDrawingError(null);
      setIsFullscreen(false);
    }

    async function decodeImportedImage(file: File) {
      if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(file);
        return {
          dispose: () => bitmap.close(),
          source: bitmap as CanvasImageSource,
        };
      }

      const objectUrl = URL.createObjectURL(file);
      let decoded = false;
      try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const nextImage = new window.Image();
          nextImage.onload = () => resolve(nextImage);
          nextImage.onerror = () => reject(new Error('이미지 디코딩 실패'));
          nextImage.src = objectUrl;
        });
        decoded = true;
        return {
          dispose: () => URL.revokeObjectURL(objectUrl),
          source: image,
        };
      } finally {
        if (!decoded) URL.revokeObjectURL(objectUrl);
      }
    }

    async function importImage(event: React.ChangeEvent<HTMLInputElement>) {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (!file) return;

      const validationError = validateSketchImport(file);
      if (validationError) {
        setImportStatus(validationError);
        input.value = '';
        return;
      }

      let dispose = () => {};
      try {
        const canvas = canvasRef.current;
        if (!canvas) throw new Error('캔버스를 찾지 못했어요.');
        const decoded = await decodeImportedImage(file);
        dispose = decoded.dispose;
        drawImportedImage(canvas, decoded.source);
        snapshot();
        finishDrawing(canvas.toDataURL('image/webp', 0.76));
        setImportStatus('이미지를 그림으로 가져왔어요.');
      } catch {
        setImportStatus('이미지를 불러오지 못했어요. 다시 시도해 주세요.');
      } finally {
        dispose();
        input.value = '';
      }
    }

    function confirmDrawing() {
      const canvas = canvasRef.current;
      if (!canvas || !currentDrawingHasContent()) {
        setDrawingError('그림을 한 번 이상 그린 뒤 확인해 주세요.');
        return;
      }
      const output = document.createElement('canvas');
      output.width = width;
      output.height = height;
      const outputContext = output.getContext('2d');
      if (!outputContext) {
        setDrawingError('그림을 저장하지 못했어요. 다시 시도해 주세요.');
        return;
      }
      outputContext.fillStyle = '#ffffff';
      outputContext.fillRect(0, 0, width, height);
      outputContext.drawImage(canvas, 0, 0);
      finishDrawing(output.toDataURL('image/webp', 0.76));
    }

    return (
      <section aria-label={isFullscreen ? '전체 화면 그리기' : undefined} aria-modal={isFullscreen || undefined} className={`sketch-editor ${isFullscreen ? 'sketch-editor--fullscreen' : ''} ${isFullscreen && controlsOpen ? 'sketch-editor--controls-open' : ''}`} ref={editorRef} role={isFullscreen ? 'dialog' : undefined}>
        {!isFullscreen ? <>
          {!confirmedDrawing ? <button className="button button--primary drawing-entry-button" onClick={openDrawing} ref={fullscreenEntryRef} type="button">그림 그리기</button> : null}
          {confirmedDrawing ? <figure className="drawing-preview"><Image alt="그린 그림 미리보기" height={height} src={confirmedDrawing} unoptimized width={width} /></figure> : null}
          {confirmedDrawing && reopenLabel ? <button className="button button--secondary drawing-entry-button drawing-reopen-button" onClick={openDrawing} ref={fullscreenEntryRef} type="button">{reopenLabel}</button> : null}
          <div className="drawing-import">
            <label className="button button--secondary drawing-import-button">
              이미지로 가져오기
              <input accept="image/png,image/jpeg,image/webp" aria-label="이미지로 가져오기" onChange={importImage} type="file" />
            </label>
            <p aria-live="polite" className="drawing-import-status" role="status">{importStatus}</p>
          </div>
        </> : null}
        <div className="sketch-stage-slot" hidden={!isFullscreen}>
          <div className={`sketch-stage sketch-stage--${tab}`}>
            <p className="sr-only" id={canvasHelpId}>손가락이나 마우스로 그림을 그리거나 이미지로 가져오기를 사용할 수 있어요.</p>
            <canvas aria-describedby={canvasHelpId} aria-label={ariaLabel} className="drawing-canvas" height={height} onPointerCancel={pointerEnd} onPointerDown={pointerDown} onPointerLeave={pointerEnd} onPointerMove={pointerMove} onPointerUp={pointerEnd} ref={canvasRef} width={width} />
            {crosshairVisible ? <div aria-hidden="true" className="canvas-crosshair" data-testid="canvas-crosshair" /> : null}
            <div aria-hidden="true" className={`drawing-loupe drawing-loupe--above ${loupeActive ? 'is-visible' : ''}`} data-active={loupeActive} data-placement="above" data-testid="drawing-loupe" ref={loupeRef} style={loupeBrushStyle}>
              <canvas data-loupe="true" height={loupeSize} ref={loupeCanvasRef} width={loupeSize} />
              <span className="drawing-loupe-tip" />
            </div>
          </div>
        </div>
        <div className="editor-control-panel" hidden={!isFullscreen || !controlsOpen}>
          <nav aria-label="그림 편집 단계" className="editor-tabs">
            <button aria-pressed={tab === 'draw'} onClick={() => setTab('draw')} type="button">그리기</button>
            <button aria-pressed={tab === 'guide'} onClick={() => setTab('guide')} type="button">가이드</button>
          </nav>
          <div className="draw-tools">
            {tab === 'guide' ? (
              <div className="guide-controls">
                <p className="guide-empty-copy">중앙선을 켜고 얼굴 비율을 확인해 보세요.</p>
                <label className="crosshair-toggle"><input aria-label="중앙선 보기" checked={crosshairVisible} onChange={(event) => setCrosshairVisible(event.target.checked)} type="checkbox" /><span>중앙선 보기</span></label>
                <label className="crosshair-toggle"><input aria-label="돋보기 보기" checked={loupeEnabled} onChange={(event) => { setLoupeEnabled(event.target.checked); if (!event.target.checked) setLoupeActive(false); }} type="checkbox" /><span>돋보기 보기</span></label>
                <label className="crosshair-toggle"><input aria-label="왼손 모드" checked={leftHandMode} onChange={(event) => setLeftHandMode(event.target.checked)} type="checkbox" /><span>왼손 모드</span></label>
              </div>
            ) : (
              <><div className="tool-row drawing-action-row"><button aria-pressed={!eraser} className={`tool-button ${!eraser ? 'is-active' : ''}`} onClick={() => { setEraser(false); setTab('draw'); }} type="button">펜</button><button aria-pressed={eraser} className={`tool-button ${eraser ? 'is-active' : ''}`} onClick={() => { setEraser(true); setTab('draw'); }} type="button">지우개</button><button aria-label="되돌리기" className="tool-button tool-button--icon" disabled={!history || history.index === 0} onClick={() => history && restore(undoSnapshot(history))} type="button"><Image alt="" height={26} src="/icons/drawing-undo.webp" width={26} /></button><button aria-label="다시 실행" className="tool-button tool-button--icon" disabled={!history || history.index >= history.snapshots.length - 1} onClick={() => history && restore(redoSnapshot(history))} type="button"><Image alt="" height={26} src="/icons/drawing-redo.webp" width={26} /></button><button className="tool-button tool-button--clear" onClick={clear} type="button">전체 삭제</button></div>
              <div className="tool-row color-palette">{sketchColors.map((nextColor) => <button aria-label={`${nextColor.label} 색상`} aria-pressed={color === nextColor.value && !eraser} className={`color-swatch ${color === nextColor.value && !eraser ? 'is-active' : ''}`} key={nextColor.value} onClick={() => { setColor(nextColor.value); setEraser(false); setTab('draw'); }} style={{ backgroundColor: nextColor.value }} type="button" />)}<label className={`color-swatch custom-color-swatch ${customColor === color && !eraser ? 'is-active' : ''}`} style={{ backgroundColor: customColor ?? 'var(--canvas)' }}><span aria-hidden="true">+</span><input aria-label={customColor ? `사용자 지정 색상 ${customColor}` : '사용자 지정 색상 선택'} onChange={selectCustomColor} type="color" value={customColor ?? sketchColors[0].value} /></label></div>
              <div className="drawing-range-controls"><label className="range-control"><span>펜 투명도</span><strong>{penOpacity}%</strong><input aria-label="펜 투명도" max="100" min="10" onChange={(event) => setPenOpacity(Number(event.target.value))} step="5" type="range" value={penOpacity} /></label><label className="range-control"><span>굵기</span><strong>{lineWidth}</strong><input aria-label="굵기" max="18" min="2" onChange={(event) => setLineWidth(Number(event.target.value))} type="range" value={lineWidth} /></label></div></>
            )}
          </div>
        </div>
        {isFullscreen ? (
          <div className="fullscreen-action-area">
            {drawingError ? <p className="fullscreen-drawing-error" role="alert">{drawingError}</p> : null}
            <div className="fullscreen-controls">
              <button aria-label="그리기 나가기" className="fullscreen-exit" onClick={requestExit} type="button"><Image alt="" height={30} src="/icons/fullscreen-exit.webp" width={30} /></button>
              <button aria-label="그림 기록 한 단계 이전" className="fullscreen-undo" disabled={!history || history.index === 0} onClick={() => history && restore(undoSnapshot(history))} type="button"><Image alt="" height={30} src="/icons/fullscreen-back.webp" width={30} /></button>
              <button aria-expanded={controlsOpen} aria-label={controlsOpen ? '그리기 도구 닫기' : '그리기 도구 열기'} onClick={() => setControlsOpen((current) => !current)} type="button"><Image alt="" height={30} src="/icons/drawing-controls.webp" width={30} /></button>
              <button aria-label="확인" className="fullscreen-confirm" onClick={confirmDrawing} ref={fullscreenConfirmRef} type="button"><Image alt="" height={30} src="/icons/fullscreen-confirm.webp" width={30} /></button>
            </div>
          </div>
        ) : null}
      </section>
    );
  },
);
