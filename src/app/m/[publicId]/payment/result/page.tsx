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
