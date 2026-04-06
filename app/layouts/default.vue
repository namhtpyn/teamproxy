<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const { user, isAuthenticated, isAdmin, logout } = useAuth()

const items = computed<DropdownMenuItem[][]>(() => {
  const menu: DropdownMenuItem[][] = [
    [{ label: 'Chats', icon: 'i-lucide-message-square', onSelect: () => navigateTo('/chats') }],
  ]

  if (isAdmin.value && menu[0]) {
    menu[0].push({
      label: 'Settings',
      icon: 'i-lucide-settings',
      onSelect: () => navigateTo('/settings'),
    })
  }

  menu.push([
    { label: 'Sign out', icon: 'i-lucide-log-out', color: 'error', onSelect: () => logout() },
  ])

  return menu
})
</script>

<template>
  <div class="flex h-dvh overflow-hidden">
    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="flex h-14 flex-shrink-0 items-center gap-2 border-b border-default bg-default px-4"
      >
        <NuxtLink to="/" class="flex items-center gap-2">
          <div
            class="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-inverted"
          >
            <UIcon name="i-lucide-message-square" class="h-4 w-4" />
          </div>
          <span class="text-sm font-semibold tracking-tight text-highlighted">
            TeamProxy
          </span>
        </NuxtLink>

        <div class="flex-1" />

        <UDropdownMenu v-if="isAuthenticated" :items="items" :content="{ align: 'end' }">
          <UButton color="neutral" variant="ghost" size="sm">
            <UAvatar :alt="user?.displayName ?? ''" size="2xs">
              {{ user?.displayName?.charAt(0)?.toUpperCase() ?? 'U' }}
            </UAvatar>
          </UButton>
        </UDropdownMenu>
      </header>

      <main class="flex-1 overflow-hidden">
        <slot />
      </main>
    </div>
  </div>
</template>
