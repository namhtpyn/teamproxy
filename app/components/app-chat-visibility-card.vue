<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { VisibilityChat, VisibilityChatRow } from '~/types/chat'
import { useAsyncState, watchDebounced } from '@vueuse/core'
import { getChatType } from '~/utils/graph-helpers'
import { getChatDisplayName } from '~/utils/chat-helpers'

const { $orpcClient: $orpc } = useNuxtApp()
const toast = useToast()

const PAGE_SIZE = 10

const togglingId = ref<string | null>(null)
const allowedTogglingId = ref<string | null>(null)
const { msUserId, ensure: ensureMsUser } = useMsUser()
const currentCursor = ref<string | undefined>(undefined)
const nextCursor = ref<string | undefined>(undefined)
const pageCursors = ref<(string | undefined)[]>([undefined])
const pageIndex = ref(0)
const search = ref('')

const { state: chats, isLoading: loading, error, execute: fetchPage } = useAsyncState(
  async () => {
    const [result] = await Promise.all([
      $orpc.chatVisibility.getVisibility({ limit: PAGE_SIZE, cursor: currentCursor.value }),
      ensureMsUser(),
    ])
    nextCursor.value = result.nextCursor
    return result.chats
  },
  [] as VisibilityChat[],
)

const allChats = ref<VisibilityChat[]>([])
const searchLoading = ref(false)
const isSearchActive = computed(() => search.value.trim().length > 0)

async function fetchAllChats() {
  searchLoading.value = true
  try {
    const all: VisibilityChat[] = []
    let cursor: string | undefined = undefined
    do {
      const result = await $orpc.chatVisibility.getVisibility({ limit: PAGE_SIZE, cursor })
      all.push(...result.chats)
      cursor = result.nextCursor
    } while (cursor)
    allChats.value = all
  } catch {
    toast.add({ title: 'Failed to search chats', color: 'error' })
  } finally {
    searchLoading.value = false
  }
}

watchDebounced(search, async (q) => {
  if (q.trim().length > 0 && allChats.value.length === 0) {
    await fetchAllChats()
  }
}, { debounce: 300 })

const displayedChats = computed(() => {
  if (!isSearchActive.value) return chats.value
  const q = search.value.trim().toLowerCase()
  return allChats.value.filter((c) => {
    const name = getChatDisplayName(c, msUserId.value).toLowerCase()
    const type = chatTypeLabel(getChatType(c)).toLowerCase()
    return name.includes(q) || type.includes(q)
  })
})

const hasMore = computed(() => !isSearchActive.value && nextCursor.value !== undefined)
const hasPrev = computed(() => !isSearchActive.value && pageIndex.value > 0)

async function goNext() {
  if (!nextCursor.value) return
  pageCursors.value.push(nextCursor.value)
  pageIndex.value++
  currentCursor.value = nextCursor.value
  await fetchPage()
}

async function goPrev() {
  if (pageIndex.value === 0) return
  pageIndex.value--
  currentCursor.value = pageCursors.value[pageIndex.value]
  await fetchPage()
}

function refresh() {
  allChats.value = []
  fetchPage()
}

const allowedCount = computed(() => displayedChats.value.filter((c) => c.allowed).length)

const tableData = computed(() =>
  displayedChats.value.map((chat) => ({
    ...chat,
    name: getChatDisplayName(chat, msUserId.value) || 'Unnamed chat',
  })),
)

const columns: TableColumn<VisibilityChatRow>[] = [
  { accessorKey: 'name', header: 'Chat' },
  { id: 'subscription', header: 'Subscription' },
  { id: 'allowed', header: 'Allowed' },
  { id: 'canRespond', header: 'Respond' },
]

function findChatIndex(chatId: string): number {
  return displayedChats.value.findIndex(c => c.id === chatId)
}

async function toggleChat(chat: VisibilityChat) {
  const chatId = chat.id!
  const idx = findChatIndex(chatId)
  if (idx === -1) return
  const original = displayedChats.value[idx]!
  const snapshot = { allowed: original.allowed, canRespond: original.canRespond }
  const newValue = !original.allowed
  const previousCanRespond = original.canRespond
  if (!newValue) original.canRespond = false
  original.allowed = newValue
  allowedTogglingId.value = chatId

  try {
    const result = await $orpc.chatVisibility.setVisibility({
      chatId,
      allowed: newValue,
      canRespond: newValue ? previousCanRespond : false,
      topic: chat.topic ?? '',
      chatType: getChatType(chat),
    })
    original.subscriptionStatus = result.subscriptionStatus
    if (result.subscriptionError) {
      toast.add({
        title: 'Subscription failed',
        description: result.subscriptionError,
        color: 'error',
        icon: 'i-lucide-alert-circle',
      })
    }
  } catch {
    original.allowed = snapshot.allowed
    original.canRespond = snapshot.canRespond
    toast.add({ title: 'Failed to update', color: 'error' })
  }

  allowedTogglingId.value = null
}

async function toggleRespond(chat: VisibilityChat) {
  const chatId = chat.id!
  const idx = findChatIndex(chatId)
  if (idx === -1) return
  const original = displayedChats.value[idx]!
  const snapshot = original.canRespond
  const newValue = !original.canRespond
  original.canRespond = newValue
  togglingId.value = chatId

  try {
    await $orpc.chatVisibility.setCanRespond({ chatId, canRespond: newValue })
  } catch {
    original.canRespond = snapshot
    toast.add({ title: 'Failed to update', color: 'error' })
  }

  togglingId.value = null
}

function chatTypeLabel(chatType: string): string {
  if (chatType === 'group') return 'Group'
  if (chatType === 'meeting') return 'Meeting'
  return 'One-to-one'
}
</script>

<template>
  <section class="mb-8">
    <h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-dimmed">
      Chat Visibility
    </h2>

    <UAlert v-if="error" :title="String(error)" color="error" variant="soft" class="mb-3" />

    <UCard>
      <div class="mb-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
            <UIcon name="i-lucide-eye" class="h-5 w-5 text-secondary" />
          </div>
          <div>
            <p class="text-sm font-semibold text-highlighted">
              Allowed Chats
            </p>
            <p class="text-xs text-muted">
              {{ allowedCount }} {{ isSearchActive ? 'of ' + displayedChats.length + ' results' : 'of ' + chats.length + ' chats on this page' }}
            </p>
          </div>
        </div>
        <UButton variant="ghost" size="xs" aria-label="Refresh" :loading="loading" @click="refresh()">
          <UIcon name="i-lucide-refresh-cw" class="h-3 w-3" />
        </UButton>
      </div>

      <div class="mb-3">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search chats..."
          size="sm"
          :loading="searchLoading"
        />
      </div>

      <div v-if="(loading || searchLoading) && displayedChats.length === 0" class="flex items-center justify-center py-8">
        <AppLoadingSpinner />
      </div>

      <AppEmptyState v-else-if="displayedChats.length === 0" icon="i-lucide-message-square" :message="isSearchActive ? 'No chats match your search' : 'No chats found'" />

      <template v-else>
        <UTable
          :data="tableData"
          :columns="columns"
          :loading="loading"
        >
        >
          <template #name-cell="{ row }">
            <div class="min-w-0 break-words">
              <p class="text-sm font-medium text-highlighted">
                {{ row.original.name }}
              </p>
              <p class="text-xs text-dimmed">
                {{ chatTypeLabel(getChatType(row.original)) }}
              </p>
            </div>
          </template>

          <template #subscription-cell="{ row }">
            <UIcon
              v-if="allowedTogglingId === row.original.id"
              name="i-lucide-loader-circle"
              class="h-4 w-4 animate-spin text-muted"
            />
            <UBadge
              v-else
              :color="row.original.subscriptionStatus === 'active' ? 'success' : row.original.subscriptionStatus === 'expired' ? 'warning' : 'neutral'"
              variant="subtle"
              size="sm"
            >
              {{ row.original.subscriptionStatus === 'active' ? 'Active' : row.original.subscriptionStatus === 'expired' ? 'Expired' : 'None' }}
            </UBadge>
          </template>

          <template #canRespond-cell="{ row }">
            <USwitch
              v-if="row.original.allowed"
              :model-value="row.original.canRespond"
              :disabled="togglingId !== null"
              :loading="togglingId === row.original.id"
              :aria-label="`Toggle respond for ${row.original.name}`"
              color="primary"
              @update:model-value="toggleRespond(row.original)"
            />
            <span v-else class="text-xs text-dimmed">—</span>
          </template>

          <template #allowed-cell="{ row }">
            <USwitch
              :model-value="row.original.allowed"
              :disabled="allowedTogglingId !== null"
              :loading="allowedTogglingId === row.original.id"
              :aria-label="`Toggle visibility for ${row.original.name}`"
              color="primary"
              @update:model-value="toggleChat(row.original)"
            />
          </template>
        </UTable>

        <div v-if="!isSearchActive && (hasPrev || hasMore)" class="flex items-center justify-between border-t border-default pt-3">
          <UButton variant="outline" size="xs" :disabled="!hasPrev" :loading="loading && hasPrev" @click="goPrev()">
            <UIcon name="i-lucide-chevron-left" class="h-3 w-3" />
            Previous
          </UButton>
          <span class="text-xs text-dimmed">Page {{ pageIndex + 1 }}</span>
          <UButton variant="outline" size="xs" :disabled="!hasMore" :loading="loading && !hasPrev" @click="goNext()">
            Next
            <UIcon name="i-lucide-chevron-right" class="h-3 w-3" />
          </UButton>
        </div>
      </template>
    </UCard>
  </section>
</template>
