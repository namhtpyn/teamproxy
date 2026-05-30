<script setup lang="ts">
useSeoMeta({ title: 'TeamProxy' })

definePageMeta({
  layout: 'auth',
  auth: false,
})

const { isAuthenticated, fetchStatus } = useAuth()

if (import.meta.client) {
  if (isAuthenticated.value) {
    navigateTo('/chats')
  } else {
    fetchStatus().then(() => {
      if (isAuthenticated.value) {
        navigateTo('/chats')
      } else {
        navigateTo('/login')
      }
    })
  }
}
</script>

<template>
  <div />
</template>
