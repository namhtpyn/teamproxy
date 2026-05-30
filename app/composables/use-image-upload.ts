export function useImageUpload() {
  const pendingImage = ref<{
    contentBytes: string
    contentType: string
    preview: string
  } | null>(null)
  const imageError = ref<string | null>(null)

  function processImageFile(file: File) {
    imageError.value = null
    if (!file.type.startsWith('image/')) return
    if (file.size > 3 * 1024 * 1024) {
      imageError.value = 'Image must be under 3MB'
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]!
      pendingImage.value = {
        contentBytes: base64,
        contentType: file.type,
        preview: dataUrl,
      }
    }
    reader.readAsDataURL(file)
  }

  function handlePaste(event: ClipboardEvent) {
    const items = event.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        event.preventDefault()
        const file = item.getAsFile()
        if (file) processImageFile(file)
        return
      }
    }
  }

  function removePendingImage() {
    pendingImage.value = null
  }

  return {
    pendingImage,
    imageError,
    handlePaste,
    removePendingImage,
  }
}
