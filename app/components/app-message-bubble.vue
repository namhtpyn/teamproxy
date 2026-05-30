<script setup lang="ts">
import type { ChatMessage } from '@microsoft/microsoft-graph-types'
import type { ContextMenuItem } from '@nuxt/ui'
import type { OptimisticChatMessage } from '~/types/chat'
import { getEventDetail, getMessageContent, getSender, groupReactions } from '~/utils/graph-helpers'
import { onClickOutside } from '@vueuse/core'

const props = defineProps<{
  msg: ChatMessage | OptimisticChatMessage
  msUserId?: string | null
}>()

const emit = defineEmits<{
  retry: []
  react: [reactionType: string]
  reply: [messageId: string]
  edit: [messageId: string]
  delete: [messageId: string]
}>()

const sender = computed(() => getSender(props.msg))
const isOwn = computed(() => !!props.msUserId && sender.value?.id === props.msUserId)
const isSending = computed(() => props.msg.id?.startsWith('temp:') && !('sendFailed' in props.msg && props.msg.sendFailed))
const isSystemEvent = computed(() => !!getEventDetail(props.msg))
const systemEventInfo = computed(() => getSystemEventInfo(getEventDetail(props.msg)))

const content = computed(() => getMessageContent(props.msg))

const renderedContent = computed(() => {
  if (!content.value) return ''
  return content.value
    // Proxy <img> src from Graph API to our local proxy endpoint
    .replace(/(<img[^>]*\bsrc=["'])(https:\/\/graph\.microsoft\.com\/v1\.0\/)([^"']*)(["'][^>]*>)/gi,
      (_, prefix, _baseUrl, apiPath, suffix) => `${prefix}/api/graph-image?path=${encodeURIComponent(apiPath)}${suffix}`)
    // Convert <emoji alt="😆"> to the alt text (unicode emoji)
    .replace(/<emoji[^>]*\balt=["']([^"']*)["'][^>]*>/gi, '$1')
    // Convert <at id="0">Name</at> to highlighted mention span
    .replace(/<at[^>]*>([^<]*)<\/at>/gi, '<span style="color:#c24e00;font-weight:600">@$1</span>')
    // Clean up <p> tags — convert to <br> for compact layout, strip opening <p>
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '<br>')
    // Style inline images like Teams (rounded, max-height, zoom cursor)
    .replace(/(<img[^>]*?)>/gi, '$1 class="inline-chat-img" style="max-height:200px;border-radius:8px;display:block;margin:4px 0;cursor:zoom-in" loading="lazy">')
    // Remove trailing <br>
    .replace(/<br>\s*$/i, '')
    .trim()
})

const hasRenderedContent = computed(() => renderedContent.value.length > 0)

const { open } = useLightbox()

function handleContentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.tagName !== 'IMG' || !target.classList.contains('inline-chat-img')) return
  const contentEl = target.closest('[data-message-content]')
  if (!contentEl) return
  const allImgs = Array.from(contentEl.querySelectorAll<HTMLImageElement>('img.inline-chat-img'))
  const idx = allImgs.indexOf(target as HTMLImageElement)
  if (idx === -1) return
  const urls = allImgs.map(img => img.src)
  open(urls, idx)
}

const sendFailed = computed(() => ('sendFailed' in props.msg ? props.msg.sendFailed : undefined))

const reactionGroups = computed(() => groupReactions(props.msg.reactions, props.msUserId))
const showReactionPicker = ref(false)
const canReact = computed(() => !isSystemEvent.value && !isSending.value && !props.msg.id?.startsWith('temp:'))

const contextItems = computed<ContextMenuItem[][]>(() => {
  const items: ContextMenuItem[][] = []

  const actions: ContextMenuItem[] = [
    { label: 'Reply', icon: 'i-lucide-reply', onSelect: () => emit('reply', props.msg.id!) },
    { label: 'React', icon: 'i-lucide-smile-plus', onSelect: () => { showReactionPicker.value = true } },
  ]
  items.push(actions)

  items.push([
    { label: 'Copy message', icon: 'i-lucide-copy', onSelect: () => copyMessage() },
  ])

  if (isOwn.value && !isSending.value && !isSystemEvent.value) {
    items.push([
      { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => emit('edit', props.msg.id!) },
      { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => emit('delete', props.msg.id!) },
    ])
  }

  return items
})

function copyMessage() {
  const text = renderedContent.value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim()
  navigator.clipboard.writeText(text)
}

function toggleReaction(reactionType: string) {
  emit('react', reactionType)
  showReactionPicker.value = false
}

const pickerRef = ref<HTMLElement | null>(null)
onClickOutside(pickerRef, () => {
  showReactionPicker.value = false
})

const messageTime = computed(() => formatMessageTime(props.msg.createdDateTime ?? ''))


</script>

<template>
  <div v-if="isSystemEvent && systemEventInfo" class="flex justify-center">
    <div class="flex items-center gap-1.5 rounded-full bg-elevated/50 px-3 py-1 text-xs text-dimmed">
      <span>{{ messageTime }}</span>
      <span>·</span>
      <span>{{ systemEventInfo.text }}</span>
      <a
        v-if="systemEventInfo.link"
        :href="systemEventInfo.link.url"
        target="_blank"
        rel="noopener noreferrer"
        class="font-medium text-primary hover:underline"
      >{{ systemEventInfo.link.label }}</a>
    </div>
  </div>

  <!-- Own message -->
  <UContextMenu v-else-if="isOwn" :items="contextItems" :disabled="isSystemEvent || isSending">
    <div class="flex justify-end">
      <div class="max-w-[70%]">
        <span class="mb-0.5 block text-right text-[10px] text-dimmed">
          {{ messageTime }}
        </span>
        <div class="rounded-2xl px-3.5 py-2" :class="sendFailed ? 'bg-red-500/15 ring-1 ring-red-500/30' : 'bg-accented'">
          <div v-if="hasRenderedContent" data-message-content class="break-words text-sm leading-relaxed text-highlighted" v-html="renderedContent" @click="handleContentClick" />
        </div>
        <div v-if="reactionGroups.length || canReact" ref="pickerRef" class="relative -mt-1.5 mb-1 flex items-center gap-0.5 justify-end">
          <button
            v-for="group in reactionGroups"
            :key="group.reactionType"
            type="button"
            class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors"
            :class="group.hasOwn
              ? 'bg-primary/15 text-primary'
              : 'bg-elevated text-dimmed hover:bg-elevated/80'"
            @click="toggleReaction(group.reactionType)"
          >
            <span class="text-[13px] leading-none">{{ group.emoji }}</span>
            <span>{{ group.count }}</span>
          </button>
          <button
            v-if="canReact"
            type="button"
            class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-elevated text-dimmed transition-colors hover:bg-elevated/80 hover:text-highlighted"
            @click="showReactionPicker = !showReactionPicker"
          >
            <UIcon name="i-lucide-smile-plus" class="h-3.5 w-3.5" />
          </button>
          <AppReactionPicker
            :visible="showReactionPicker"
            @select="toggleReaction"
          />
        </div>
        <div v-if="isSending" class="mt-1 flex items-center justify-end gap-1">
          <UIcon name="i-lucide-loader-circle" class="h-3 w-3 animate-spin text-muted" />
          <span class="text-[10px] text-muted">Sending</span>
        </div>
        <div v-else-if="sendFailed" class="mt-1 flex items-center justify-end gap-2">
          <p class="text-xs text-error">{{ sendFailed }}</p>
          <button class="text-xs font-medium text-error underline" @click="emit('retry')">Retry</button>
        </div>
      </div>
    </div>
  </UContextMenu>

  <!-- Other's message -->
  <UContextMenu v-else :items="contextItems" :disabled="isSystemEvent || isSending">
    <div class="flex justify-start">
      <div class="flex max-w-[70%] items-start gap-2">
        <UAvatar
          size="2xs"
          class="mt-1 flex-shrink-0"
        >
          {{ sender?.displayName?.charAt(0)?.toUpperCase() ?? '?' }}
        </UAvatar>
        <div class="flex flex-col items-start gap-0.5">
          <div class="flex items-baseline gap-2 px-3">
            <span class="text-xs font-medium text-highlighted">
              {{ sender?.displayName ?? 'Unknown' }}
            </span>
            <span class="text-[10px] text-dimmed">
              {{ messageTime }}
            </span>
          </div>
          <div class="rounded-2xl px-3.5 py-2" :class="sendFailed ? 'bg-red-500/15 ring-1 ring-red-500/30' : 'bg-elevated'">
            <div v-if="hasRenderedContent" data-message-content class="break-words text-sm leading-relaxed text-highlighted" v-html="renderedContent" @click="handleContentClick" />
          </div>
          <div v-if="reactionGroups.length || canReact" ref="pickerRef" class="relative -mt-1.5 mb-1 flex items-center gap-0.5">
            <button
              v-for="group in reactionGroups"
              :key="group.reactionType"
              type="button"
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors"
              :class="group.hasOwn
                ? 'bg-primary/15 text-primary'
                : 'bg-elevated text-dimmed hover:bg-elevated/80'"
              @click="toggleReaction(group.reactionType)"
            >
              <span class="text-[13px] leading-none">{{ group.emoji }}</span>
              <span>{{ group.count }}</span>
            </button>
            <button
              v-if="canReact"
              type="button"
              class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-elevated text-dimmed transition-colors hover:bg-elevated/80 hover:text-highlighted"
              @click="showReactionPicker = !showReactionPicker"
            >
              <UIcon name="i-lucide-smile-plus" class="h-3.5 w-3.5" />
            </button>
            <AppReactionPicker
              :visible="showReactionPicker"
              @select="toggleReaction"
            />
          </div>
          <p v-if="sendFailed" class="mt-1 text-xs text-red-400">
            {{ sendFailed }}
          </p>
        </div>
      </div>
    </div>
  </UContextMenu>
</template>
