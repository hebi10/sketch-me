import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ImageCreationEntry } from './ImageCreationEntry';
import { ImageModeChooser } from './ImageModeChooser';
import { ShareImageComposer } from './ShareImageComposer';
import {
  buildFriendShareDrawingOptions,
  buildOwnerShareDrawingOption,
  parseShareImageMode,
  type ShareDrawingOption,
} from '@/lib/share/share-image';
import { getManagedSketchbook } from '@/lib/sketchbooks/management';
import { findSketchbookByPublicId, listDrawings } from '@/lib/sketchbooks/repository';

export const dynamic = 'force-dynamic';

export default async function SharePage({ params, searchParams }: {
  params: Promise<{ publicId: string }>;
  searchParams?: Promise<{ mode?: string }>;
}) {
  const [{ publicId }, { mode: rawMode }] = await Promise.all([
    params,
    searchParams ?? Promise.resolve<{ mode?: string }>({}),
  ]);
  const mode = parseShareImageMode(rawMode);
  const sketchbook = await getManagedSketchbook(publicId);
  if (!sketchbook) {
    if (await findSketchbookByPublicId(publicId)) redirect(`/m/${publicId}/login`);
    notFound();
  }

  if (!mode) {
    return (
      <>
        <main className="share-shell">
          <header className="simple-header share-header">
            <Link aria-label="내 스캐치북으로 돌아가기" className="header-icon-link" href={`/m/${publicId}`}>←</Link>
            <span className="header-title">이미지 제작</span>
            <span aria-hidden="true" className="header-balance" />
          </header>
        </main>
        <ImageModeChooser dismissHref={`/m/${publicId}`} open publicId={publicId} />
      </>
    );
  }

  const drawings = await listDrawings(sketchbook.id);
  const drawingOptions = [
    buildOwnerShareDrawingOption(publicId, sketchbook),
    ...buildFriendShareDrawingOptions(publicId, drawings),
  ].filter((drawing): drawing is ShareDrawingOption => drawing !== null);
  const publicPath = `/s/${publicId}`;

  return (
    <main className="share-shell">
      <header className="simple-header share-header">
        <Link aria-label="내 스캐치북으로 돌아가기" className="header-icon-link" href={`/m/${publicId}`}>←</Link>
        <span className="header-title">이미지 제작</span>
        <span aria-hidden="true" className="header-balance" />
      </header>
      <div className="share-mode-action">
        <ImageCreationEntry
          ariaLabel="제작 유형 바꾸기"
          className="button button--secondary"
          publicId={publicId}
        >
          제작 유형 바꾸기
        </ImageCreationEntry>
      </div>
      <ShareImageComposer
        bestHeading={sketchbook.storyHeading}
        drawings={drawingOptions}
        initialWatermarkFree={sketchbook.entitlements.watermarkFree}
        mode={mode}
        name={sketchbook.name}
        publicId={publicId}
        publicUrl={publicPath}
        singleHeading={sketchbook.singleStoryHeading}
      />
    </main>
  );
}
