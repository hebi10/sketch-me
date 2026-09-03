import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getManagedSketchbook } from '@/lib/sketchbooks/management';
import { findSketchbookByPublicId } from '@/lib/sketchbooks/repository';
import { OwnerDrawingEditor } from './OwnerDrawingEditor';
import styles from './OwnerDrawingEdit.module.css';

export const dynamic = 'force-dynamic';

export default async function OwnerDrawingEditPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const sketchbook = await getManagedSketchbook(publicId);
  if (!sketchbook) {
    if (await findSketchbookByPublicId(publicId)) redirect(`/m/${publicId}/login`);
    notFound();
  }
  if (!sketchbook.ownerDrawingPath) notFound();

  return (
    <main className="form-shell owner-edit-shell">
      <header className={styles.header}>
        <Link aria-label="내 스케치북 관리로 돌아가기" className={`icon-button ${styles.backLink}`} href={`/m/${publicId}`}>←</Link>
        <span className={styles.headerTitle}>내 그림 관리</span>
      </header>
      <OwnerDrawingEditor name={sketchbook.name} publicId={publicId} />
    </main>
  );
}
