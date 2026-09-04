'use client';

import { useRef, useState } from 'react';

import type { ShareDrawingOption, ShareImageMode } from '@/lib/share/share-image';
import { fitContainedRect, SINGLE_IMAGE_LAYOUT } from '@/lib/share/single-image-layout';
import {
  STORY_BEST_TITLE_Y,
  STORY_CTA_Y,
  STORY_HEIGHT,
  STORY_PUBLIC_URL_Y,
  STORY_SHARED_HEADING_Y,
  STORY_WIDTH,
  storySlots,
  storyWatermark,
  type StorySlot,
} from '@/lib/share/story-layout';
import { storyStyle } from '@/lib/share/story-style';

interface ShareImageMakerProps {
  backgroundImage: string;
  drawing: ShareDrawingOption | null;
  drawings: ShareDrawingOption[];
  heading: string;
  mode: ShareImageMode;
  name: string;
  publicUrl: string;
  watermarkFree: boolean;
}

async function loadImage(source: string) {
  const response = await fetch(source, { credentials: 'same-origin' });
  if (!response.ok) throw new Error('그림을 불러오지 못했습니다.');
  const objectUrl = URL.createObjectURL(await response.blob());
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('그림을 불러오지 못했습니다.')); };
    image.src = objectUrl;
  });
}

function drawContainedImage(context: CanvasRenderingContext2D, image: HTMLImageElement, slot: StorySlot) {
  const fitted = fitContainedRect(image.naturalWidth, image.naturalHeight, slot);
  context.drawImage(image, fitted.x, fitted.y, fitted.width, fitted.height);
}

function setFittedFont(
  context: CanvasRenderingContext2D,
  text: string,
  { maxSize, minSize, maxWidth, weight }: { maxSize: number; minSize: number; maxWidth: number; weight: number },
) {
  let size = maxSize;
  context.font = `${weight} ${size}px ${storyStyle.fontFamily}`;
  while (size > minSize && context.measureText(text).width > maxWidth) {
    size -= 2;
    context.font = `${weight} ${size}px ${storyStyle.fontFamily}`;
  }
}

async function drawWatermark(
  context: CanvasRenderingContext2D,
  mode: ShareImageMode,
) {
  const watermark = await loadImage('/brand/sketchbook-watermark.webp');
  context.save();
  context.globalAlpha = mode === 'best' ? storyWatermark.opacity : 0.52;
  if (mode === 'best') {
    const iconX = storyWatermark.x + 12;
    const iconY = storyWatermark.y + (storyWatermark.height - storyWatermark.iconSize) / 2;
    context.drawImage(watermark, iconX, iconY, storyWatermark.iconSize, storyWatermark.iconSize);
    context.fillStyle = storyStyle.ink;
    context.font = `600 38px ${storyStyle.fontFamily}`;
    context.textAlign = 'left';
    context.fillText('스캐치북', iconX + storyWatermark.iconSize + 12, storyWatermark.y + 70);
  } else {
    const iconSize = 48;
    const contentWidth = 210;
    const startX = (SINGLE_IMAGE_LAYOUT.width - contentWidth) / 2;
    context.drawImage(
      watermark,
      startX,
      SINGLE_IMAGE_LAYOUT.watermark.y + 6,
      iconSize,
      iconSize,
    );
    context.fillStyle = storyStyle.ink;
    context.font = `600 32px ${storyStyle.fontFamily}`;
    context.textAlign = 'left';
    context.fillText('스캐치북', startX + 62, SINGLE_IMAGE_LAYOUT.watermark.y + 43);
  }
  context.restore();
  context.textAlign = 'center';
}

async function drawSingleComposition(
  context: CanvasRenderingContext2D,
  drawing: ShareDrawingOption,
  name: string,
) {
  context.fillStyle = '#ffffff';
  context.fillRect(
    SINGLE_IMAGE_LAYOUT.frame.x,
    SINGLE_IMAGE_LAYOUT.frame.y,
    SINGLE_IMAGE_LAYOUT.frame.width,
    SINGLE_IMAGE_LAYOUT.frame.height,
  );
  context.strokeStyle = storyStyle.line;
  context.lineWidth = 4;
  context.strokeRect(
    SINGLE_IMAGE_LAYOUT.frame.x,
    SINGLE_IMAGE_LAYOUT.frame.y,
    SINGLE_IMAGE_LAYOUT.frame.width,
    SINGLE_IMAGE_LAYOUT.frame.height,
  );
  const image = await loadImage(drawing.imageUrl);
  const fitted = fitContainedRect(image.naturalWidth, image.naturalHeight, SINGLE_IMAGE_LAYOUT.frame);
  context.drawImage(image, fitted.x, fitted.y, fitted.width, fitted.height);
  const author = drawing.source === 'owner'
    ? `${name} · 내 그림`
    : `그린 사람 · ${drawing.authorName}`;
  context.fillStyle = storyStyle.ink;
  setFittedFont(context, author, { maxSize: 38, minSize: 24, maxWidth: 780, weight: 600 });
  context.fillText(author, 540, SINGLE_IMAGE_LAYOUT.authorY);
}

async function drawBestComposition(
  context: CanvasRenderingContext2D,
  drawings: ShareDrawingOption[],
  publicUrl: string,
) {
  setFittedFont(context, 'BEST 4', { maxSize: 78, minSize: 28, maxWidth: 900, weight: 700 });
  context.fillText('BEST 4', 540, STORY_BEST_TITLE_Y);

  for (const slot of storySlots) {
    context.fillStyle = '#ffffff';
    context.fillRect(slot.x, slot.y, slot.width, slot.height);
    context.strokeStyle = storyStyle.line;
    context.lineWidth = 4;
    context.strokeRect(slot.x, slot.y, slot.width, slot.height);
    const drawing = drawings.find((item) => item.bestRank === slot.rank);
    if (drawing) {
      const image = await loadImage(drawing.imageUrl);
      drawContainedImage(context, image, slot);
    } else {
      context.fillStyle = storyStyle.muted;
      context.font = `34px ${storyStyle.fontFamily}`;
      context.fillText('아직 선정 전', slot.x + slot.width / 2, slot.y + slot.height / 2);
    }
    context.fillStyle = storyStyle.accent;
    context.fillRect(slot.x, slot.y, slot.rank === 1 ? 150 : 112, slot.rank === 1 ? 58 : 48);
    context.fillStyle = '#ffffff';
    context.font = slot.rank === 1 ? `600 30px ${storyStyle.fontFamily}` : `600 24px ${storyStyle.fontFamily}`;
    context.textAlign = 'left';
    context.fillText(`BEST ${slot.rank}`, slot.x + 14, slot.y + (slot.rank === 1 ? 39 : 33));
    context.textAlign = 'center';
  }

  const absolutePublicUrl = new URL(publicUrl, window.location.origin).href;
  context.fillStyle = storyStyle.accent;
  context.fillRect(210, STORY_CTA_Y, 660, 84);
  context.fillStyle = '#ffffff';
  context.font = `600 32px ${storyStyle.fontFamily}`;
  context.fillText('나도 스케치북에 그림 남기기', 540, STORY_CTA_Y + 54);
  context.fillStyle = storyStyle.muted;
  context.font = `22px ${storyStyle.fontFamily}`;
  context.fillText(absolutePublicUrl, 540, STORY_PUBLIC_URL_Y);
}

export function ShareImageMaker({
  backgroundImage,
  drawing,
  drawings,
  heading,
  mode,
  name,
  publicUrl,
  watermarkFree,
}: ShareImageMakerProps) {
  const [status, setStatus] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const width = mode === 'single' ? SINGLE_IMAGE_LAYOUT.width : STORY_WIDTH;
  const height = mode === 'single' ? SINGLE_IMAGE_LAYOUT.height : STORY_HEIGHT;

  async function download() {
    if (mode === 'single' && !drawing) return;
    setStatus('공유 이미지를 만드는 중이에요.');
    try {
      const canvas = canvasRef.current;
      const link = downloadRef.current;
      if (!canvas || !link) throw new Error('이미지 편집 기능을 사용할 수 없습니다.');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('이미지 편집 기능을 사용할 수 없습니다.');

      await document.fonts.ready;
      context.fillStyle = storyStyle.background;
      context.fillRect(0, 0, width, height);
      const background = await loadImage(backgroundImage);
      context.drawImage(background, 0, 0, width, height);
      context.fillStyle = storyStyle.ink;
      context.textAlign = 'center';
      setFittedFont(context, heading, { maxSize: mode === 'single' ? 62 : 54, minSize: 24, maxWidth: 840, weight: 600 });
      context.fillText(heading, 540, mode === 'single' ? SINGLE_IMAGE_LAYOUT.titleY : STORY_SHARED_HEADING_Y);

      if (mode === 'single' && drawing) {
        await drawSingleComposition(context, drawing, name);
      } else {
        await drawBestComposition(context, drawings, publicUrl);
      }
      if (!watermarkFree) await drawWatermark(context, mode);

      link.download = `${name}-sketchbook-${mode}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setStatus(`${width} × ${height} PNG를 저장했어요.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '공유 이미지를 만들지 못했습니다.');
    }
  }

  return (
    <div className="story-download">
      <canvas aria-hidden="true" className="share-output-canvas" height={height} ref={canvasRef} width={width} />
      <a aria-hidden="true" className="share-output-download" download="" ref={downloadRef} tabIndex={-1}>이미지 파일</a>
      <button
        className="button button--primary"
        disabled={mode === 'single' && !drawing}
        onClick={download}
        type="button"
      >
        PNG로 저장하기
      </button>
      {status ? <p aria-live="polite">{status}</p> : null}
    </div>
  );
}
