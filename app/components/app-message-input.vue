<script setup lang="ts">
import type { ChatMember } from '~/types/chat'

const props = defineProps<{
  chatId: string
  members: ChatMember[]
  msUserId?: string | null
  disabled: boolean
}>()

const emit = defineEmits<{
  submit: [payload: { content: string; image: { contentBytes: string; contentType: string } | null; mentions: Array<{ userId: string; displayName: string }> | undefined }]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const newMessage = ref('')

const {
  mentionQuery,
  mentionVisible,
  mentionPickerRef,
  selectedMentions,
  handleTextareaInput,
  handleMentionSelect,
  handleMentionKeydown,
  resetMentions,
} = useMentions(textareaRef, newMessage)

const {
  pendingImage,
  fileInputRef,
  imageError,
  pickImage,
  handleFileSelect,
  removePendingImage,
} = useImageUpload()

function handleKeydown(e: KeyboardEvent) {
  if (handleMentionKeydown(e)) return
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

function sendMessage() {
  if (!newMessage.value.trim() && !pendingImage.value) return

  const content = newMessage.value.trim()
  const mentions = selectedMentions.value.length > 0
    ? selectedMentions.value.map((m) => ({
        userId: m.userId,
        displayName: m.displayName,
      }))
    : undefined
  const image = pendingImage.value
    ? {
        contentBytes: pendingImage.value.contentBytes,
        contentType: pendingImage.value.contentType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
      }
    : null

  newMessage.value = ''
  resetMentions()
  pendingImage.value = null

  emit('submit', { content, image, mentions })
}

watch(() => props.chatId, () => {
  resetMentions()
})
</script>

<template>
  <div
    v-if="!disabled"
    class="flex-shrink-0 border-t border-default bg-default p-4"
  >
    <form
      class="mx-auto flex max-w-3xl flex-col gap-2"
      @submit.prevent="sendMessage"
    >
      <div v-if="pendingImage" class="mx-auto w-full max-w-3xl">
        <div class="relative inline-block">
          <img :src="pendingImage.preview" alt="" class="max-h-40 rounded-lg object-contain">
          <button
            type="button"
            aria-label="Remove image"
            class="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-elevated text-dimmed hover:text-highlighted"
            @click="removePendingImage"
          >
            <UIcon name="i-lucide-x" class="h-3 w-3" />
          </button>
        </div>
      </div>
      <div class="flex items-end gap-2">
        <input id="image-upload" ref="fileInputRef" type="file" accept="image/*" aria-label="Upload image" class="hidden" @change="handleFileSelect">
        <UButton
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Attach image"
          class="h-[38px] flex-shrink-0"
          @click="pickImage"
        >
          <UIcon name="i-lucide-image-plus" class="h-4 w-4" />
        </UButton>
        <div class="relative flex-1">
          <UTextarea
            ref="textareaRef"
            v-model="newMessage"
            placeholder="Type a message..."
            aria-label="Type a message"
            autoresize
            :min-rows="1"
            :max-rows="5"
            class="w-full"
            role="combobox"
            aria-controls="mention-listbox"
            :aria-expanded="mentionVisible"
            @input="handleTextareaInput"
            @keydown="handleKeydown"
          />
          <AppMentionPicker
            ref="mentionPickerRef"
            :members="members.filter((m): m is ChatMember & { userId: string } => m.userId != null && m.userId !== props.msUserId)"
            :query="mentionQuery"
            :visible="mentionVisible"
            @select="(m) => { if (m.userId) handleMentionSelect(m as ChatMember & { userId: string }) }"
          />
        </div>
        <UButton
          type="submit"
          size="sm"
          aria-label="Send message"
          class="h-[38px]"
        >
          <UIcon name="i-lucide-send" class="h-4 w-4" />
        </UButton>
      </div>
    </form>
  </div>
  <div
    v-else
    class="flex-shrink-0 border-t border-default bg-default px-4 py-3"
  >
    <p class="text-center text-xs text-dimmed">
      Responses are disabled for this chat
    </p>
  </div>
</template>
