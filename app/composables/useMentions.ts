import type { ComponentPublicInstance } from 'vue'

export function useMentions(
  textareaRef: Ref<HTMLTextAreaElement | null>,
  newMessage: Ref<string>,
) {
  const mentionQuery = ref('')
  const mentionVisible = ref(false)
  const mentionStartIndex = ref(-1)
  const selectedMentions = ref<Array<{ userId: string; displayName: string }>>([])
  const mentionPickerRef = ref<
    ComponentPublicInstance<{ handleKeydown: (e: KeyboardEvent) => void }> | null
  >(null)

  function handleTextareaInput() {
    const textarea = textareaRef.value
    if (!textarea) return
    const text = textarea.value
    const cursorPos = textarea.selectionStart

    let atIndex = -1
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (text[i] === '@') {
        if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '\n') {
          atIndex = i
        }
        break
      }
      if (text[i] === ' ' || text[i] === '\n') break
    }

    if (atIndex !== -1) {
      mentionStartIndex.value = atIndex
      mentionQuery.value = text.slice(atIndex + 1, cursorPos)
      mentionVisible.value = true
    } else {
      mentionVisible.value = false
    }
  }

  function handleMentionSelect(member: {
    id: string
    displayName: string
    userId: string
  }) {
    const textarea = textareaRef.value
    if (!textarea) return

    const before = textarea.value.slice(0, mentionStartIndex.value)
    const after = textarea.value.slice(textarea.selectionStart)
    const insert = `@${member.displayName} `
    newMessage.value = before + insert + after

    if (!selectedMentions.value.some((m) => m.userId === member.userId)) {
      selectedMentions.value.push({
        userId: member.userId,
        displayName: member.displayName,
      })
    }

    mentionVisible.value = false

    nextTick(() => {
      if (textareaRef.value) {
        const newCursorPos = before.length + insert.length
        textareaRef.value.focus()
        textareaRef.value.setSelectionRange(newCursorPos, newCursorPos)
      }
    })
  }

  function handleMentionKeydown(e: KeyboardEvent): boolean {
    if (!mentionVisible.value) return false
    mentionPickerRef.value?.handleKeydown(e)
    if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
      e.preventDefault()
      if (e.key === 'Escape') mentionVisible.value = false
    }
    return true
  }

  function resetMentions() {
    selectedMentions.value = []
    mentionVisible.value = false
  }

  return {
    mentionQuery,
    mentionVisible,
    mentionPickerRef,
    selectedMentions,
    handleTextareaInput,
    handleMentionSelect,
    handleMentionKeydown,
    resetMentions,
  }
}
