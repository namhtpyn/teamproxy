<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ChatType } from '#shared/utils/enums'
import type { VisibilityChat, VisibilityChatRow } from '~/types/chat'
import { useAsyncState } from '@vueuse/core'
import { getChatMembers, getChatTopic, getChatType } from '~/utils/graph-helpers'

const { $orpcClient: $orpc } = useNuxtApp()
const toast = useToast()

const loadingMore = ref(false)
const togglingId = ref<string | null>(null)
const allowedTogglingId = ref<string | null>(null)
const nextCursor = ref<string | undefined>(undefined)

const { state: chats, isLoading: loading, error, execute: fetchVisibility } = useAsyncState(
  async () => {
    nextCursor.value = undefined
    const result = await $orpc.chatVisibility.getVisibility({ limit: 20 })
    nextCursor.value = result.nextCursor
    return result.chats
  },
  [] as VisibilityChat[],
)

async function loadMore() {
  if (!nextCursor.value) return
  loadingMore.value = true
  try {
    const result = await $orpc.chatVisibility.getVisibility({ cursor: nextCursor.value, limit: 20 })
    chats.value.push(...result.chats)
    nextCursor.value = result.nextCursor
  } catch (err: unknown) {
    toast.add({ title: getErrorMessage(err, 'Failed to load more chats'), color: 'error' })
  } finally {
    loadingMore.value = false
  }
}

const allowedCount = computed(() => chats.value.filter((c) => c.allowed).length)

const tableData = computed<VisibilityChatRow[]>(() =>
  chats.value.map((chat) => ({
    ...chat,
    name: chatDisplayName(chat),
  })),
)

const columns: TableColumn<VisibilityChatRow>[] = [
  { accessorKey: 'name', header: 'Chat' },
  { id: 'subscription', header: 'Subscription' },
  { id: 'allowed', header: 'Allowed' },
  { id: 'canRespond', header: 'Respond' },
]

async function toggleChat(chat: VisibilityChat) {
  const chatId = chat.id!
  const idx = chats.value.findIndex(c => c.id === chatId)
  if (idx === -1) return
  const original = chats.value[idx]!
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
      chatType: getChatType(chat) as ChatType,
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
  const idx = chats.value.findIndex(c => c.id === chatId)
  if (idx === -1) return
  const original = chats.value[idx]!
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

function chatDisplayName(chat: VisibilityChat): string {
  const topic = getChatTopic(chat)
  if (topic) return topic
  const members = getChatMembers(chat)
  if (members.length > 0) return members[0]!.displayName
  return 'Unnamed chat'
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
              {{ allowedCount }} of {{ chats.length }} chats visible to users
            </p>
          </div>
        </div>
        <UButton variant="ghost" size="xs" aria-label="Refresh" :loading="loading" @click="fetchVisibility()">
          <UIcon name="i-lucide-refresh-cw" class="h-3 w-3" />
        </UButton>
      </div>

      <div v-if="loading && chats.length === 0" class="flex items-center justify-center py-8">
        <AppLoadingSpinner />
      </div>

      <AppEmptyState v-else-if="chats.length === 0" icon="i-lucide-message-square" message="No chats found" />

      <UTable v-else :data="tableData" :columns="columns" sticky class="max-h-80">
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

      <div v-if="nextCursor" class="mt-3 flex justify-center">
        <UButton
          variant="outline"
          size="sm"
          :loading="loadingMore"
          :disabled="loading"
          @click="loadMore()"
        >
          Load more
        </UButton>
      </div>
    </UCard>
  </section>
</template>
