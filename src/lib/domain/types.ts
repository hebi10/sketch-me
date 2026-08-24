export type SketchbookStatus = 'PUBLIC' | 'PRIVATE' | 'DELETED';
export type DrawingStatus = 'VISIBLE' | 'HIDDEN' | 'DELETED';
export type PurchaseStatus = 'READY' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export type ShareType = 'SELF_VS_FRIENDS' | 'FRIENDS_BEST';

export interface Sketchbook {
  id: string;
  publicId: string;
  name: string;
  manageTokenHash: string;
  referenceImagePath: string | null;
  referenceImageEnabled: boolean;
  participantLimit: number;
  participantCount: number;
  status: SketchbookStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Drawing {
  id: string;
  sketchbookId: string;
  imagePath: string;
  authorName: string;
  message: string | null;
  usedReferenceImage: boolean;
  bestRank: 1 | 2 | 3 | 4 | null;
  status: DrawingStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Purchase {
  id: string;
  orderId: string;
  provider: 'MOCK' | 'TOSS';
  productType: 'PARTICIPANT_20';
  amount: 990;
  additionalLimit: 20;
  paymentStatus: PurchaseStatus;
  paidAt: Date | null;
  createdAt: Date;
}

export interface ShareImage {
  id: string;
  shareType: ShareType;
  mainDrawingId: string;
  subDrawingIds: [string, string, string];
  imagePath: string;
  createdAt: Date;
}
