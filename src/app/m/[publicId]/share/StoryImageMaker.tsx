'use client';

interface StoryImageMakerProps { name: string; publicUrl: string; }

export function StoryImageMaker({ name, publicUrl }: StoryImageMakerProps) {
  function download() {
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1920;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#f7f4ee'; context.fillRect(0, 0, 1080, 1920);
    context.fillStyle = '#181818'; context.textAlign = 'center';
    context.font = '600 88px Arial'; context.fillText('친구들이 그린 나', 540, 210);
    context.font = '600 112px Arial'; context.fillText(`${name} BEST 4`, 540, 350);
    context.strokeStyle = '#5c6f8f'; context.lineWidth = 12; context.beginPath(); context.moveTo(255, 390); context.lineTo(825, 390); context.stroke();
    context.strokeStyle = '#d8d3c9'; context.lineWidth = 4; context.strokeRect(105, 510, 870, 860);
    context.fillStyle = '#6e6e6e'; context.font = '42px Arial'; context.fillText('관리 화면에서 선정한 BEST 그림이 표시됩니다', 540, 960);
    context.fillStyle = '#5c6f8f'; context.fillRect(105, 1600, 870, 120);
    context.fillStyle = '#ffffff'; context.font = '42px Arial'; context.fillText('나도 스케치북에 그림 남기기', 540, 1678);
    context.fillStyle = '#6e6e6e'; context.font = '30px Arial'; context.fillText(publicUrl, 540, 1770);
    const link = document.createElement('a'); link.download = `${name}-sketchbook-story.png`; link.href = canvas.toDataURL('image/png'); link.click();
  }
  return <button className="button button--primary" onClick={download} type="button">PNG로 저장하기</button>;
}
