<script setup lang="ts">
import { useAsyncState, useClipboard } from '@vueuse/core'

const { $orpcClient: $orpc } = useNuxtApp()
const toast = useToast()
const { copy } = useClipboard()

const msError = ref<string | null>(null)

const { state: msAccount, isLoading: msLoading, execute: fetchAccountInfo } = useAsyncState(
  async () => {
    const info = await $orpc.auth.getMsAccountInfo()
    return info
  },
  { connected: false as boolean, accountInfo: null as { displayName: string; email: string | null } | null, accessTokenExpiresAt: null as string | null, refreshTokenExpiresAt: null as string | null },
)

const msConnected = computed(() => msAccount.value.connected)
const msAccountInfo = computed(() => msAccount.value.accountInfo)
const msAccessTokenExpiresAt = computed(() => msAccount.value.accessTokenExpiresAt)
const msRefreshTokenExpiresAt = computed(() => msAccount.value.refreshTokenExpiresAt)

const exportModalOpen = ref(false)
const exportData = ref('')
const exporting = ref(false)

async function openExportModal() {
  exporting.value = true
  try {
    const result = await $orpc.auth.exportSession()
    exportData.value = result.data
    exportModalOpen.value = true
  } catch (err: unknown) {
    msError.value = getErrorMessage(err, 'Failed to export session')
  } finally {
    exporting.value = false
  }
}

function copyExportData() {
  copy(exportData.value)
  toast.add({ title: 'Copied to clipboard', color: 'success' })
}

const importModalOpen = ref(false)
const importData = ref('')
const importing = ref(false)
const confirmOverwriteOpen = ref(false)

function openImportModal() {
  importData.value = ''
  importModalOpen.value = true
}

async function handleImport() {
  if (msConnected.value) {
    confirmOverwriteOpen.value = true
    return
  }
  await doImport()
}

async function doImport() {
  confirmOverwriteOpen.value = false
  importing.value = true
  try {
    await $orpc.auth.importSession({ data: importData.value })
    importModalOpen.value = false
    toast.add({ title: 'Session imported successfully', color: 'success' })
    await fetchAccountInfo()
  } catch (err: unknown) {
    toast.add({ title: getErrorMessage(err, 'Failed to import session'), color: 'error' })
  } finally {
    importing.value = false
  }
}

async function connectMicrosoft() {
  msError.value = null
  try {
    const result = await $orpc.auth.getMicrosoftAuthUrl()
    window.location.href = result.url
  } catch (err: unknown) {
    msError.value = getErrorMessage(err, 'Failed to connect Microsoft account')
  }
}

async function disconnectMicrosoft() {
  try {
    await $orpc.auth.disconnectMs()
    msAccount.value = { connected: false, accountInfo: null, accessTokenExpiresAt: null, refreshTokenExpiresAt: null }
    navigateTo('/settings?disconnected=true')
  } catch (err: unknown) {
    msError.value = getErrorMessage(err, 'Failed to disconnect Microsoft account')
  }
}
</script>

<template>
  <section class="mb-8">
    <h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-dimmed">
      Microsoft Teams
    </h2>

    <UAlert v-if="msError" :title="msError" color="error" variant="soft" class="mb-3" />

    <UCard>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
            <UIcon name="i-lucide-message-square" class="h-5 w-5 text-info" />
          </div>
          <div>
            <p class="text-sm font-semibold text-highlighted">
              Microsoft Graph
            </p>
            <template v-if="msConnected && msAccountInfo">
              <p class="text-sm text-default">
                {{ msAccountInfo.displayName }}
              </p>
              <p v-if="msAccountInfo.email" class="text-xs text-muted">
                {{ msAccountInfo.email }}
              </p>
            </template>
            <p v-if="msConnected && msAccessTokenExpiresAt" class="text-xs text-muted">
              Access token expires {{ formatDateTime(msAccessTokenExpiresAt) }}
            </p>
            <p v-if="msConnected && msRefreshTokenExpiresAt" class="text-xs text-muted">
              Refresh token expires {{ formatDateTime(msRefreshTokenExpiresAt) }}
            </p>
          </div>
        </div>

        <UBadge v-if="msLoading" color="neutral" variant="outline" size="sm">
          Checking...
        </UBadge>
        <UBadge v-else-if="msConnected" color="success" variant="soft" size="sm">
          Connected
        </UBadge>
        <UBadge v-else color="neutral" variant="outline" size="sm"> Not connected </UBadge>
      </div>

      <div class="mt-4 flex gap-2">
        <template v-if="msConnected">
          <UButton
            variant="outline"
            size="sm"
            :loading="exporting"
            @click="openExportModal"
          >
            Export
          </UButton>
          <UButton
            variant="outline"
            size="sm"
            @click="openImportModal"
          >
            Import
          </UButton>
          <UButton
            color="error"
            variant="outline"
            size="sm"
            :loading="msLoading"
            @click="disconnectMicrosoft"
          >
            Disconnect
          </UButton>
        </template>
        <template v-else>
          <UButton size="sm" :loading="msLoading" @click="connectMicrosoft">
            <UIcon name="i-lucide-plug" class="mr-1 h-3 w-3" />
            Connect Microsoft
          </UButton>
          <UButton
            variant="outline"
            size="sm"
            @click="openImportModal"
          >
            Import
          </UButton>
        </template>
      </div>
    </UCard>

    <UModal v-model:open="exportModalOpen">
      <template #header>
        <h3 class="text-lg font-semibold">Export Session</h3>
      </template>
      <template #body>
        <div class="-mx-4 -my-1.5 px-4 sm:-mx-6 sm:px-6">
          <UTextarea
            :model-value="exportData"
            readonly
            :rows="8"
            class="font-mono text-xs"
          />
        </div>
      </template>
      <template #footer>
        <div class="flex gap-2">
          <UButton size="sm" @click="copyExportData">
            <UIcon name="i-lucide-copy" class="mr-1 h-3 w-3" />
            Copy
          </UButton>
          <UButton color="neutral" variant="outline" size="sm" @click="exportModalOpen = false">
            Close
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="importModalOpen">
      <template #header>
        <h3 class="text-lg font-semibold">Import Session</h3>
      </template>
      <template #body>
        <div class="-mx-4 -my-1.5 px-4 sm:-mx-6 sm:px-6">
          <UTextarea
            v-model="importData"
            placeholder="Paste base64-encoded session data here..."
            :rows="8"
            class="font-mono text-xs"
          />
        </div>
      </template>
      <template #footer>
        <div class="flex gap-2">
          <UButton size="sm" :loading="importing" :disabled="!importData" @click="handleImport">
            Import
          </UButton>
          <UButton color="neutral" variant="outline" size="sm" @click="importModalOpen = false">
            Cancel
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="confirmOverwriteOpen">
      <template #header>
        <h3 class="text-lg font-semibold">Replace Session?</h3>
      </template>
      <template #body>
        <p class="text-sm text-muted">
          This will replace your current session. Continue?
        </p>
      </template>
      <template #footer>
        <div class="flex gap-2">
          <UButton size="sm" :loading="importing" @click="doImport">
            Confirm
          </UButton>
          <UButton color="neutral" variant="outline" size="sm" @click="confirmOverwriteOpen = false">
            Cancel
          </UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>
