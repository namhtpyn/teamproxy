<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { VisibilityChat, VisibilityChatRow } from '~/types/chat'

const { $orpc } = useNuxtApp()
const toast = useToast()

const chats = ref<VisibilityChat[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const togglingId = ref<string | null>(null)
const allowedTogglingId = ref<string | null>(null)

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

async function fetchVisibility() {
  loading.value = true
  error.value = null
  try {
    const result = await $orpc.chatVisibility.getVisibility()
    chats.value = result.chats
  } catch (err: unknown) {
    error.value = getErrorMessage(err, 'Failed to load chat visibility')
  } finally {
    loading.value = false
  }
}

async function optimisticToggle<T>(currentValue: T, newValue: T, updateFn: () => Promise<unknown>, revertFn: (val: T) => void) {
  const previous = currentValue
  revertFn(newValue)
  try {
    await updateFn()
  } catch {
    revertFn(previous)
    toast.add({ title: 'Failed to update', color: 'error' })
  }
}

async function toggleChat(chat: VisibilityChat) {
  const original = chats.value.find(c => c.id === chat.id)
  if (!original) return
  const newValue = !original.allowed
  const previousCanRespond = original.canRespond
  if (!newValue) original.canRespond = false
  allowedTogglingId.value = chat.id

  await optimisticToggle(
    original.allowed,
    newValue,
    async () => {
      const result = await $orpc.chatVisibility.setVisibility({
        chatId: chat.id,
        allowed: newValue,
        canRespond: newValue ? previousCanRespond : false,
        topic: chat.topic,
        chatType: chat.chatType,
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
    },
    (val) => {
      original.allowed = val
      original.canRespond = val ? previousCanRespond : false
    },
  )

  allowedTogglingId.value = null
}

async function toggleRespond(chat: VisibilityChat) {
  const original = chats.value.find(c => c.id === chat.id)
  if (!original) return
  const newValue = !original.canRespond
  togglingId.value = chat.id

  await optimisticToggle(
    original.canRespond,
    newValue,
    () => $orpc.chatVisibility.setCanRespond({
      chatId: chat.id,
      canRespond: newValue,
    }),
    (val) => { original.canRespond = val },
  )

  togglingId.value = null
}

function chatDisplayName(chat: VisibilityChat): string {
  if (chat.topic) return chat.topic
  if (chat.members.length > 0) return chat.members[0]!
  return 'Unnamed chat'
}

function chatTypeLabel(chatType: string): string {
  if (chatType === 'group') return 'Group'
  if (chatType === 'meeting') return 'Meeting'
  return 'One-to-one'
}

onMounted(() => {
  fetchVisibility()
})
</script>

<template>
  <section class="mb-8">
    <h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-dimmed">
      Chat Visibility
    </h2>

    <UAlert v-if="error" :title="error" color="error" variant="soft" class="mb-3" />

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
        <UButton variant="ghost" size="xs" aria-label="Refresh" :loading="loading" @click="fetchVisibility">
          <UIcon name="i-lucide-refresh-cw" class="h-3 w-3" />
        </UButton>
      </div>

      <div v-if="loading && chats.length === 0" class="flex items-center justify-center py-8">
        <AppLoadingSpinner />
      </div>

      <AppEmptyState v-else-if="chats.length === 0" icon="i-lucide-message-square" message="No chats found" />

      <UTable v-else :data="tableData" :columns="columns" sticky class="max-h-80">
        <template #name-cell="{ row }">
          <div>
            <p class="text-sm font-medium text-highlighted">
              {{ row.original.name }}
            </p>
            <p class="text-xs text-dimmed">
              {{ chatTypeLabel(row.original.chatType) }}
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
    </UCard>
  </section>
</template>
