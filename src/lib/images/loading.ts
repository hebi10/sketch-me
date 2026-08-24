export function galleryImageLoading(index: number): 'eager' | 'lazy' {
  return index === 0 ? 'eager' : 'lazy';
}
