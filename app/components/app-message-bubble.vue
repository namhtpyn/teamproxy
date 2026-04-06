<script setup lang="ts">
import type { Message } from '~/types/chat'

const props = defineProps<{
  msg: Message
  msUserId?: string | null
}>()

const isOwn = computed(() => !!props.msUserId && props.msg.sender?.id === props.msUserId)
const isSending = computed(() => props.msg.id.startsWith('temp:') && !props.msg.sendFailed)
const isSystemEvent = computed(() => !!props.msg.eventDetail)
const systemEventText = computed(() => getSystemEventText(props.msg.eventDetail))

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

const messageImages = computed(() => {
  if (!props.msg.content) return []
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  const images: string[] = []
  let match
  while ((match = imgRegex.exec(props.msg.content)) !== null) {
    const src = match[1]!
    if (src.startsWith(GRAPH_BASE)) {
      const apiPath = src.replace(GRAPH_BASE, '')
      images.push(`/api/graph-image?path=${encodeURIComponent(apiPath)}`)
    } else {
      images.push(src)
    }
  }
  return images
})

const textContent = computed(() => stripHtml(props.msg.content ?? ''))

const lightboxVisible = ref(false)
const lightboxIndex = ref(0)

function openLightbox(index: number) {
  lightboxIndex.value = index
  lightboxVisible.value = true
}

</script>

<template>
  <div v-if="isSystemEvent" class="flex justify-center">
    <p class="rounded-full bg-elevated/50 px-3 py-1 text-xs text-dimmed">
      {{ systemEventText }}
    </p>
  </div>

  <div v-else :class="isOwn ? 'flex justify-end' : 'flex justify-start'">
    <div v-if="isOwn" class="max-w-[70%]">
      <span class="mb-0.5 block text-right text-[10px] text-dimmed">
        {{ formatMessageTime(msg.createdDateTime) }}
      </span>
      <div class="rounded-2xl px-3.5 py-2" :class="msg.sendFailed ? 'bg-red-500/15 ring-1 ring-red-500/30' : 'bg-accented'">
        <p v-if="textContent" class="whitespace-pre-wrap break-words text-sm leading-relaxed text-highlighted">
          {{ textContent }}
        </p>
        <div v-if="messageImages.length" class="mt-2 space-y-2">
          <img
            v-for="(src, i) in messageImages"
            :key="i"
            :src="src"
            alt=""
            class="max-h-48 cursor-zoom-in rounded-lg object-contain"
            loading="lazy"
            @click="openLightbox(i)"
          >
        </div>
      </div>
      <div v-if="isSending" class="mt-1 flex items-center justify-end gap-1">
        <UIcon name="i-lucide-loader-circle" class="h-3 w-3 animate-spin text-muted" />
        <span class="text-[10px] text-muted">Sending</span>
      </div>
      <p v-else-if="msg.sendFailed" class="mt-1 text-right text-xs text-red-400">
        {{ msg.sendFailed }}
      </p>
    </div>

    <div v-else class="flex max-w-[70%] items-start gap-2">
      <UAvatar
        size="2xs"
        class="mt-1 flex-shrink-0"
      >
        {{ msg.sender?.displayName?.charAt(0)?.toUpperCase() ?? '?' }}
      </UAvatar>
      <div class="flex flex-col items-start gap-0.5">
        <div class="flex items-baseline gap-2 px-3">
          <span class="text-xs font-medium text-highlighted">
            {{ msg.sender?.displayName ?? 'Unknown' }}
          </span>
          <span class="text-[10px] text-dimmed">
            {{ formatMessageTime(msg.createdDateTime) }}
          </span>
        </div>
        <div class="rounded-2xl px-3.5 py-2" :class="msg.sendFailed ? 'bg-red-500/15 ring-1 ring-red-500/30' : 'bg-elevated'">
          <p v-if="textContent" class="whitespace-pre-wrap break-words text-sm leading-relaxed text-highlighted">
            {{ textContent }}
          </p>
          <div v-if="messageImages.length" class="mt-2 space-y-2">
            <img
              v-for="(src, i) in messageImages"
              :key="i"
              :src="src"
              alt=""
              class="max-h-48 cursor-zoom-in rounded-lg object-contain"
              loading="lazy"
              @click="openLightbox(i)"
            >
          </div>
        </div>
        <p v-if="msg.sendFailed" class="mt-1 text-xs text-red-400">
          {{ msg.sendFailed }}
        </p>
      </div>
    </div>
  </div>
  <ClientOnly v-if="messageImages.length">
    <VueEasyLightbox
      :visible="lightboxVisible"
      :imgs="messageImages"
      :index="lightboxIndex"
      @hide="lightboxVisible = false"
    />
  </ClientOnly>
</template>
