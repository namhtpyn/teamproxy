<script setup lang="ts">
import type { ChatMessage } from '@microsoft/microsoft-graph-types'
import type { OptimisticChatMessage } from '~/types/chat'
import { useScroll } from '@vueuse/core'

const props = defineProps<{
  messages: (ChatMessage | OptimisticChatMessage)[]
  loadingMore: boolean
  msUserId?: string | null
}>()

const emit = defineEmits<{
  'load-more': []
  'retry': [tempId: string]
  'react': [payload: { messageId: string; reactionType: string }]
  'reply': [messageId: string]
  'edit': [messageId: string]
  'delete': [messageId: string]
}>()

const messagesContainer = ref<HTMLElement | null>(null)
const { arrivedState } = useScroll(messagesContainer, { offset: { bottom: 100, top: 50 } })
const isNearBottom = computed(() => arrivedState.bottom)
const newMessageCount = ref(0)

watch(isNearBottom, (near) => {
  if (near) {
    newMessageCount.value = 0
  }
})

watch(() => arrivedState.top, (atTop) => {
  if (atTop && !props.loadingMore) {
    emit('load-more')
  }
})

function scrollToBottom(force = false) {
  const el = messagesContainer.value
  if (!el) return
  if (!force && !isNearBottom.value) return
  el.scrollTop = el.scrollHeight
  newMessageCount.value = 0
}

watch(() => props.messages, (newMsgs, oldMsgs) => {
  const isInitialLoad = (oldMsgs?.length ?? 0) === 0
  if (isInitialLoad || !newMsgs || newMsgs.length <= (oldMsgs?.length ?? 0)) return

  const el = messagesContainer.value
  if (!el) return

  const wasPrepend = oldMsgs!.length > 0 && newMsgs[0]?.id !== oldMsgs![0]?.id
  if (wasPrepend) {
    const prevHeight = el.scrollHeight
    nextTick(() => {
      el.scrollTop = el.scrollHeight - prevHeight
    })
  } else {
    const addedCount = newMsgs.length - (oldMsgs?.length ?? 0)
    if (!isNearBottom.value) {
      newMessageCount.value += addedCount
    }
    nextTick(() => scrollToBottom())
  }
})

function scrollToNewMessages() {
  scrollToBottom(true)
}

defineExpose({ scrollToBottom, isNearBottom })
</script>

<template>
  <div class="relative flex-1">
    <div ref="messagesContainer" class="absolute inset-0 overflow-y-auto px-6 py-4" role="log" aria-label="Messages">
      <div v-if="loadingMore" class="flex justify-center py-2">
        <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-muted" />
      </div>
      <div class="mx-auto max-w-3xl space-y-4">
        <AppMessageBubble
           v-for="msg in messages"
           :key="msg.id"
           :msg="msg"
           :ms-user-id="msUserId"
           @retry="emit('retry', msg.id!)"
           @react="emit('react', { messageId: msg.id!, reactionType: $event })"
           @reply="emit('reply', $event)"
           @edit="emit('edit', $event)"
           @delete="emit('delete', $event)"
         />
      </div>
    </div>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-2 opacity-0"
    >
      <div v-if="newMessageCount > 0 && !isNearBottom" aria-live="polite" class="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
        <button
          class="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-primary/90"
          @click="scrollToNewMessages"
        >
          <UIcon name="i-lucide-arrow-down" class="size-3.5" />
          {{ newMessageCount }} new message{{ newMessageCount !== 1 ? 's' : '' }}
        </button>
      </div>
    </Transition>
  </div>
</template>
