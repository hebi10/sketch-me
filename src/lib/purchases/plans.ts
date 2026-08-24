import type { PurchaseProductId } from '@/lib/domain/types';

export const purchasePlans = [
  { additionalLimit: 10, amount: 990, productId: 'FRIENDS_10' },
  { additionalLimit: 50, amount: 3_900, productId: 'FRIENDS_50' },
  { additionalLimit: 100, amount: 6_900, productId: 'FRIENDS_100' },
] as const satisfies ReadonlyArray<{
  additionalLimit: number;
  amount: number;
  productId: PurchaseProductId;
}>;

export type PurchasePlan = (typeof purchasePlans)[number];

export function getPurchasePlan(productId: unknown) {
  return purchasePlans.find((plan) => plan.productId === productId) ?? null;
}
