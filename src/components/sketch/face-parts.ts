export const FACE_PART_CATEGORIES = ['face', 'hair', 'eyes', 'mouth', 'accessory'] as const;

export type FacePartCategory = (typeof FACE_PART_CATEGORIES)[number];
export type FaceSelection = Record<FacePartCategory, string | null>;

export interface FacePartOption {
  id: string;
  label: string;
  src: string;
}

export const EMPTY_FACE_SELECTION: FaceSelection = {
  face: null,
  hair: null,
  eyes: null,
  mouth: null,
  accessory: null,
};

export const FACE_PARTS: Record<FacePartCategory, readonly FacePartOption[]> = {
  face: [
    { id: 'oval', label: '갸름한 얼굴', src: '/guides/face-parts/face/oval.webp' },
    { id: 'round', label: '둥근 얼굴', src: '/guides/face-parts/face/round.webp' },
    { id: 'angular', label: '각진 얼굴', src: '/guides/face-parts/face/angular.webp' },
  ],
  hair: [
    { id: 'short', label: '짧은 머리', src: '/guides/face-parts/hair/short.webp' },
    { id: 'side-part', label: '가르마 머리', src: '/guides/face-parts/hair/side-part.webp' },
    { id: 'wavy', label: '웨이브 머리', src: '/guides/face-parts/hair/wavy.webp' },
    { id: 'curly', label: '곱슬머리', src: '/guides/face-parts/hair/curly.webp' },
    { id: 'buzz', label: '아주 짧은 머리', src: '/guides/face-parts/hair/buzz.webp' },
    { id: 'bob', label: '단발머리', src: '/guides/face-parts/hair/bob.webp' },
    { id: 'long', label: '긴 머리', src: '/guides/face-parts/hair/long.webp' },
    { id: 'tied', label: '묶은 머리', src: '/guides/face-parts/hair/tied.webp' },
  ],
  eyes: [
    { id: 'gentle', label: '부드러운 눈', src: '/guides/face-parts/eyes/gentle.webp' },
    { id: 'round', label: '동그란 눈', src: '/guides/face-parts/eyes/round.webp' },
    { id: 'smile', label: '웃는 눈', src: '/guides/face-parts/eyes/smile.webp' },
    { id: 'sharp', label: '또렷한 눈', src: '/guides/face-parts/eyes/sharp.webp' },
    { id: 'sleepy', label: '편안한 눈', src: '/guides/face-parts/eyes/sleepy.webp' },
    { id: 'bright', label: '반짝이는 눈', src: '/guides/face-parts/eyes/bright.webp' },
  ],
  mouth: [
    { id: 'soft-smile', label: '잔잔한 미소', src: '/guides/face-parts/mouth/soft-smile.webp' },
    { id: 'wide-smile', label: '활짝 웃는 입', src: '/guides/face-parts/mouth/wide-smile.webp' },
    { id: 'small-smile', label: '작은 미소', src: '/guides/face-parts/mouth/small-smile.webp' },
    { id: 'neutral', label: '다문 입', src: '/guides/face-parts/mouth/neutral.webp' },
    { id: 'open-smile', label: '살짝 열린 입', src: '/guides/face-parts/mouth/open-smile.webp' },
    { id: 'pout', label: '새침한 입', src: '/guides/face-parts/mouth/pout.webp' },
  ],
  accessory: [
    { id: 'round-glasses', label: '동그란 안경', src: '/guides/face-parts/accessory/round-glasses.webp' },
    { id: 'square-glasses', label: '네모 안경', src: '/guides/face-parts/accessory/square-glasses.webp' },
    { id: 'freckles', label: '주근깨', src: '/guides/face-parts/accessory/freckles.webp' },
    { id: 'bandage', label: '작은 반창고', src: '/guides/face-parts/accessory/bandage.webp' },
    { id: 'earrings', label: '귀걸이', src: '/guides/face-parts/accessory/earrings.webp' },
    { id: 'hairpin', label: '머리핀', src: '/guides/face-parts/accessory/hairpin.webp' },
  ],
};

export function selectFacePart(
  selection: FaceSelection,
  category: FacePartCategory,
  id: string,
): FaceSelection {
  if (!FACE_PARTS[category].some((option) => option.id === id)) return selection;
  return { ...selection, [category]: id };
}

export function hasFaceSelection(selection: FaceSelection): boolean {
  return FACE_PART_CATEGORIES.some((category) => selection[category] !== null);
}

export function selectedFacePartSources(selection: FaceSelection): string[] {
  return FACE_PART_CATEGORIES.flatMap((category) => {
    const id = selection[category];
    if (!id) return [];
    const option = FACE_PARTS[category].find((candidate) => candidate.id === id);
    return option ? [option.src] : [];
  });
}

export function randomFaceSelection(random: () => number = Math.random): FaceSelection {
  return Object.fromEntries(FACE_PART_CATEGORIES.map((category) => {
    const options = FACE_PARTS[category];
    const index = Math.min(options.length - 1, Math.floor(random() * options.length));
    return [category, options[index].id];
  })) as FaceSelection;
}
