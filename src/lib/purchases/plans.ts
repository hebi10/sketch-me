import type { PurchaseProductId } from '@/lib/domain/types';

export const purchasePlans = [
  { additionalLimit: 10, amount: 1_000, kind: 'capacity', label: '친구 그림 10명 추가', productId: 'FRIENDS_10' },
  { additionalLimit: 50, amount: 4_490, kind: 'capacity', label: '친구 그림 50명 추가', productId: 'FRIENDS_50' },
  { additionalLimit: 100, amount: 8_490, kind: 'capacity', label: '친구 그림 100명 추가', productId: 'FRIENDS_100' },
  { additionalLimit: 0, amount: 1_000, kind: 'watermark', label: '워터마크 제거', productId: 'WATERMARK_FREE' },
] as const satisfies ReadonlyArray<{
  additionalLimit: number;
  amount: number;
  kind: 'capacity' | 'watermark';
  label: string;
  productId: PurchaseProductId;
}>;

export type PurchasePlan = (typeof purchasePlans)[number];

export function getPurchasePlan(productId: unknown) {
  return purchasePlans.find((plan) => plan.productId === productId) ?? null;
}
