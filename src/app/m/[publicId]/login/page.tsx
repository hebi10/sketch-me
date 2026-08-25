import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ManagePinForm } from './ManagePinForm';
import { findSketchbookByPublicId } from '@/lib/sketchbooks/repository';

export const dynamic = 'force-dynamic';

export default async function ManageLoginPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const sketchbook = await findSketchbookByPublicId(publicId);
  if (!sketchbook) notFound();

  return (
    <main className="manage-pin-shell">
      <Link className="back-text-link" href={`/s/${publicId}`}>친구 페이지로 돌아가기</Link>
      <section aria-labelledby="manage-pin-title">
        <p className="eyebrow">내 스케치북 관리</p>
        <h1 id="manage-pin-title">관리 비밀번호를 입력해 주세요</h1>
        <p>{sketchbook.name}님의 스케치북을 안전하게 관리할 수 있어요.</p>
        <ManagePinForm hint={sketchbook.managePinHint ?? null} publicId={publicId} />
      </section>
    </main>
  );
}
