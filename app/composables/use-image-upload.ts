export function useImageUpload() {
  const pendingImage = ref<{
    contentBytes: string
    contentType: string
    preview: string
  } | null>(null)
  const fileInputRef = ref<HTMLInputElement | null>(null)
  const imageError = ref<string | null>(null)

  function pickImage() {
    fileInputRef.value?.click()
  }

  function handleFileSelect(event: Event) {
    imageError.value = null
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
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
    input.value = ''
  }

  function removePendingImage() {
    pendingImage.value = null
  }

  return {
    pendingImage,
    fileInputRef,
    imageError,
    pickImage,
    handleFileSelect,
    removePendingImage,
  }
}
