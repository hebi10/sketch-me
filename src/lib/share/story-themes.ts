export const storyThemes = [
  { id: 'botanical', label: '식물 스케치', backgroundImage: '/story/sketchbook-share-background.webp' },
  { id: 'pencil-memo', label: '연필 메모', backgroundImage: '/story/story-theme-pencil-memo.webp' },
  { id: 'tape-collage', label: '테이프 콜라주', backgroundImage: '/story/story-theme-tape-collage.webp' },
  { id: 'sky-sketch', label: '푸른 하늘', backgroundImage: '/story/story-theme-sky-sketch.webp' },
  { id: 'graphite-stars', label: '흑연 별빛', backgroundImage: '/story/story-theme-graphite-stars.webp' },
] as const;

export type StoryTheme = (typeof storyThemes)[number];

export function getStoryTheme(themeId: string | null | undefined): StoryTheme {
  return storyThemes.find((theme) => theme.id === themeId) ?? storyThemes[0];
}
