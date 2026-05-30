export function useLightbox() {
  const images = useState<string[]>('lightbox-images', () => [])
  const index = useState<number>('lightbox-index', () => 0)
  const visible = useState<boolean>('lightbox-visible', () => false)

  function open(imgs: string[], idx: number) {
    images.value = imgs
    index.value = idx
    visible.value = true
  }

  function close() {
    visible.value = false
  }

  return { images, index, visible, open, close }
}
