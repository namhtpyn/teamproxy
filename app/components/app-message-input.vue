<script setup lang="ts">
import type { ChatMessage } from '@microsoft/microsoft-graph-types'
import type { ChatMember, OptimisticChatMessage } from '~/types/chat'

const props = withDefaults(defineProps<{
  chatId: string
  members: ChatMember[]
  msUserId?: string | null
  disabled: boolean
  replyingTo?: ChatMessage | OptimisticChatMessage | null
}>(), {
  replyingTo: null,
})

const emit = defineEmits<{
  submit: [payload: { content: string; image: { contentBytes: string; contentType: string } | null; mentions: Array<{ userId: string; displayName: string }> | undefined; replyToId?: string }]
  'cancel-reply': []
}>()

const uTextareaRef = ref<{ textareaRef?: HTMLTextAreaElement } | null>(null)
const textareaRef = computed(() => uTextareaRef.value?.textareaRef ?? null)
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
  imageError,
  handlePaste,
  removePendingImage,
} = useImageUpload()

const replyPreviewText = computed(() => {
  if (!props.replyingTo) return ''
  const content = props.replyingTo.body?.content ?? ''
  return content
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
})

const replySenderName = computed(() => {
  if (!props.replyingTo) return ''
  return (props.replyingTo as ChatMessage).from?.user?.displayName ?? 'Unknown'
})

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

  emit('submit', { content, image, mentions, replyToId: props.replyingTo?.id?.startsWith('temp:') ? undefined : props.replyingTo?.id })
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
      <div v-if="replyingTo" class="flex items-center gap-2 rounded-lg bg-elevated px-3 py-2">
        <UIcon name="i-lucide-reply" class="h-4 w-4 flex-shrink-0 text-dimmed" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-xs font-medium text-highlighted">{{ replySenderName }}</p>
          <p class="truncate text-xs text-dimmed">{{ replyPreviewText }}</p>
        </div>
        <button type="button" class="flex-shrink-0 text-dimmed hover:text-highlighted" @click="emit('cancel-reply')">
          <UIcon name="i-lucide-x" class="h-3.5 w-3.5" />
        </button>
      </div>
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
      <p v-if="imageError" class="mt-1 text-xs text-error">{{ imageError }}</p>
      <div class="flex items-end gap-2">
        <div class="relative flex-1">
          <UTextarea
            ref="uTextareaRef"
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
            @paste="handlePaste"
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
