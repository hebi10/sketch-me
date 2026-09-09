/* 결제 시스템 비활성화: 기존 결제 결과 화면입니다.
import { PaymentResult } from './PaymentResult';

export default async function PaymentResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ orderId?: string }>;
}) {
  const [{ publicId }, { orderId = '' }] = await Promise.all([params, searchParams]);
  return (
    <main className="payment-result-shell manage-system-sans">
      <PaymentResult orderId={orderId} publicId={publicId} />
    </main>
  );
}
*/

import { redirect } from 'next/navigation';

export default async function PaymentResultPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  redirect(`/m/${publicId}`);
}
