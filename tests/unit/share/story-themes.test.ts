import { describe, expect, it } from 'vitest';

import { getStoryTheme, storyThemes } from '@/lib/share/story-themes';

describe('story themes', () => {
  it('provides five selectable backgrounds including the existing default', () => {
    expect(storyThemes.map((theme) => theme.id)).toEqual([
      'botanical',
      'pencil-memo',
      'tape-collage',
      'sky-sketch',
      'graphite-stars',
    ]);
  });

  it('falls back to the botanical theme for an unknown selection', () => {
    expect(getStoryTheme('not-a-theme')).toEqual(storyThemes[0]);
  });
});
