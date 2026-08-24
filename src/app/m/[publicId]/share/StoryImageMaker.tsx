'use client';

import { useState } from 'react';

import { STORY_HEIGHT, STORY_WIDTH, storySlots, type StorySlot } from '@/lib/share/story-layout';
import { storyStyle } from '@/lib/share/story-style';

export interface StoryDrawing {
  rank: 1 | 2 | 3 | 4;
  imageUrl: string;
}

interface StoryImageMakerProps {
  drawings: StoryDrawing[];
  name: string;
  publicUrl: string;
}

async function loadImage(source: string) {
  const response = await fetch(source, { credentials: 'same-origin' });
  if (!response.ok) throw new Error('BEST 그림을 불러오지 못했습니다.');
  const objectUrl = URL.createObjectURL(await response.blob());
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('BEST 그림을 불러오지 못했습니다.')); };
    image.src = objectUrl;
  });
}

function drawContainedImage(context: CanvasRenderingContext2D, image: HTMLImageElement, slot: StorySlot) {
  const scale = Math.min(slot.width / image.naturalWidth, slot.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, slot.x + (slot.width - width) / 2, slot.y + (slot.height - height) / 2, width, height);
}

export function StoryImageMaker({ drawings, name, publicUrl }: StoryImageMakerProps) {
  const [status, setStatus] = useState<string | null>(null);

  async function download() {
    setStatus('스토리 이미지를 만드는 중이에요.');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = STORY_WIDTH;
      canvas.height = STORY_HEIGHT;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('이미지 편집 기능을 사용할 수 없습니다.');

      await document.fonts.ready;

      context.fillStyle = storyStyle.background;
      context.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
      context.fillStyle = storyStyle.ink;
      context.textAlign = 'center';
      context.font = `600 76px ${storyStyle.fontFamily}`;
      context.fillText('친구들이 그린 나', 540, 170);
      context.font = `700 104px ${storyStyle.fontFamily}`;
      context.fillText(`${name} BEST 4`, 540, 300);
      context.strokeStyle = storyStyle.accent;
      context.lineWidth = 10;
      context.beginPath();
      context.moveTo(300, 345);
      context.lineTo(780, 345);
      context.stroke();

      for (const slot of storySlots) {
        context.fillStyle = '#ffffff';
        context.fillRect(slot.x, slot.y, slot.width, slot.height);
        context.strokeStyle = storyStyle.line;
        context.lineWidth = 4;
        context.strokeRect(slot.x, slot.y, slot.width, slot.height);
        const drawing = drawings.find((item) => item.rank === slot.rank);
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
      context.fillRect(105, 1690, 870, 112);
      context.fillStyle = '#ffffff';
      context.font = `600 39px ${storyStyle.fontFamily}`;
      context.fillText('나도 스케치북에 그림 남기기', 540, 1760);
      context.fillStyle = storyStyle.muted;
      context.font = `28px ${storyStyle.fontFamily}`;
      context.fillText(absolutePublicUrl, 540, 1850);

      const link = document.createElement('a');
      link.download = `${name}-sketchbook-story.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setStatus('1080 × 1920 PNG를 저장했어요.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '스토리 이미지를 만들지 못했습니다.');
    }
  }

  return (
    <div className="story-download">
      <button className="button button--primary" onClick={download} type="button">PNG로 저장하기</button>
      {status ? <p aria-live="polite">{status}</p> : null}
    </div>
  );
}
