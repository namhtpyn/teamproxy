<script setup lang="ts">
const { $orpcClient: $orpc } = useNuxtApp()


const msConnected = ref(false)
const msExpiresAt = ref<string | null>(null)
const msLoading = ref(false)
const msError = ref<string | null>(null)

async function fetchMsConnection() {
  msLoading.value = true
  msError.value = null
  try {
    const status = await $orpc.auth.getMsConnectionStatus()
    msConnected.value = status.connected
    msExpiresAt.value = status.expiresAt
  } catch (err: unknown) {
    msError.value = getErrorMessage(err, 'Failed to check Microsoft connection')
  } finally {
    msLoading.value = false
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
    msConnected.value = false
    msExpiresAt.value = null
    navigateTo('/settings?disconnected=true')
  } catch (err: unknown) {
    msError.value = getErrorMessage(err, 'Failed to disconnect Microsoft account')
  }
}

onMounted(() => {
  fetchMsConnection()
})
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
            <p v-if="msConnected && msExpiresAt" class="text-xs text-muted">
              Token expires {{ formatDateTime(msExpiresAt) }}
            </p>
            <p v-else-if="msConnected" class="text-xs text-muted">Connected</p>
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
        <UButton
          v-if="msConnected"
          color="error"
          variant="outline"
          size="sm"
          :loading="msLoading"
          @click="disconnectMicrosoft"
        >
          Disconnect
        </UButton>
        <UButton v-else size="sm" :loading="msLoading" @click="connectMicrosoft">
          <UIcon name="i-lucide-plug" class="mr-1 h-3 w-3" />
          Connect Microsoft
        </UButton>
      </div>
    </UCard>
  </section>
</template>
