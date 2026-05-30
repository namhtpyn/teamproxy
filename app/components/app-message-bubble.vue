<script setup lang="ts">
import type { ChatMessage } from '@microsoft/microsoft-graph-types'
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
}>()

const sender = computed(() => getSender(props.msg))
const isOwn = computed(() => !!props.msUserId && sender.value?.id === props.msUserId)
const isSending = computed(() => props.msg.id?.startsWith('temp:') && !('sendFailed' in props.msg && props.msg.sendFailed))
const isSystemEvent = computed(() => !!getEventDetail(props.msg))
const systemEventInfo = computed(() => getSystemEventInfo(getEventDetail(props.msg)))

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

const content = computed(() => getMessageContent(props.msg))

const messageImages = computed(() => {
  if (!content.value) return []
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  const images: string[] = []
  let match
  while ((match = imgRegex.exec(content.value)) !== null) {
    const src = match[1]!
    if (src.startsWith(GRAPH_BASE)) {
      const apiPath = src.replace(GRAPH_BASE, '')
      images.push(`/api/graph-image?path=${encodeURIComponent(apiPath)}`)
    }
  }
  return images
})

const renderedContent = computed(() => {
  if (!content.value) return ''
  return content.value
    // Remove <img> tags (handled by messageImages)
    .replace(/<img[^>]*>/gi, '')
    // Convert <emoji alt="😆"> to the alt text (unicode emoji)
    .replace(/<emoji[^>]*\balt=["']([^"']*)["'][^>]*>/gi, '$1')
    // Convert <at id="0">Name</at> to placeholder (survives HTML stripping)
    .replace(/<at[^>]*>([^<]*)<\/at>/gi, '\x00MENTION@\x01$1\x02')
    // Convert <br> to placeholder, strip <p>/</p>
    .replace(/<br\s*\/?>/gi, '\x00BR\x02')
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '\x00BR\x02')
    // Strip ALL remaining HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Restore placeholders: newlines → <br>
    .replace(/\x00BR\x02/g, '<br>')
    // Restore placeholders: mentions → highlighted span
    .replace(/\x00MENTION@\x01([^\x02]*)\x02/g, '<span style="color:#c24e00;font-weight:600">@$1</span>')
    // Remove trailing line breaks
    .replace(/<br>\s*$/i, '')
    .trim()
})

const hasRenderedContent = computed(() => renderedContent.value.length > 0)

const sendFailed = computed(() => ('sendFailed' in props.msg ? props.msg.sendFailed : undefined))

const reactionGroups = computed(() => groupReactions(props.msg.reactions, props.msUserId))
const showReactionPicker = ref(false)
const canReact = computed(() => !isSystemEvent.value && !isSending.value && !props.msg.id?.startsWith('temp:'))

function toggleReaction(reactionType: string) {
  emit('react', reactionType)
  showReactionPicker.value = false
}

const pickerRef = ref<HTMLElement | null>(null)
onClickOutside(pickerRef, () => {
  showReactionPicker.value = false
})

const messageTime = computed(() => formatMessageTime(props.msg.createdDateTime ?? ''))

const { open } = useLightbox()

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

  <div v-else :class="isOwn ? 'flex justify-end' : 'flex justify-start'">
    <div v-if="isOwn" class="max-w-[70%]">
      <span class="mb-0.5 block text-right text-[10px] text-dimmed">
        {{ messageTime }}
      </span>
      <div class="rounded-2xl px-3.5 py-2" :class="sendFailed ? 'bg-red-500/15 ring-1 ring-red-500/30' : 'bg-accented'">
        <p v-if="hasRenderedContent" class="whitespace-pre-wrap break-words text-sm leading-relaxed text-highlighted" v-html="renderedContent" />
        <div v-if="messageImages.length" class="mt-2 space-y-2">
          <img
            v-for="(src, i) in messageImages"
            :key="i"
            :src="src"
            alt=""
            class="max-h-48 cursor-zoom-in rounded-lg object-contain"
            loading="lazy"
            @click="open(messageImages, i)"
          >
        </div>
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

    <div v-else class="flex max-w-[70%] items-start gap-2">
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
          <p v-if="hasRenderedContent" class="whitespace-pre-wrap break-words text-sm leading-relaxed text-highlighted" v-html="renderedContent" />
          <div v-if="messageImages.length" class="mt-2 space-y-2">
            <img
              v-for="(src, i) in messageImages"
              :key="i"
              :src="src"
              alt=""
              class="max-h-48 cursor-zoom-in rounded-lg object-contain"
              loading="lazy"
              @click="open(messageImages, i)"
            >
          </div>
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

</template>
