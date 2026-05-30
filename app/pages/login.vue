<script setup lang="ts">
import { FetchError } from 'ofetch'
import { z } from 'zod'

useSeoMeta({ title: 'Sign In — TeamProxy' })

definePageMeta({
  layout: 'auth',
  auth: false,
})

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({ username: '', password: '' })
const error = ref('')
const { login, loading } = useAuth()

async function handleLogin() {
  error.value = ''
  try {
    await login(state.username ?? '', state.password ?? '')
    navigateTo('/chats')
  } catch (err: unknown) {
    if (err instanceof FetchError && err.statusCode === 401) {
      error.value = 'Invalid username or password'
    } else {
      error.value = getErrorMessage(err, 'Login failed')
    }
  }
}
</script>

<template>
  <div class="flex flex-col items-center text-center">
    <div class="mb-8 flex flex-col items-center gap-4">
      <div
        class="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20"
      >
        <UIcon name="i-lucide-message-square" class="h-8 w-8 text-inverted" />
      </div>

      <div class="space-y-2">
        <h1 class="text-2xl font-bold tracking-tight text-highlighted">
          TeamProxy
        </h1>
        <p class="max-w-xs text-sm leading-relaxed text-muted">
          A lightweight proxy for your Microsoft Teams conversations. Sign in to get started.
        </p>
      </div>
    </div>

    <UForm :schema="schema" :state="state" class="w-full max-w-xs space-y-4" @submit="handleLogin">
      <UFormField name="username" label="Username">
        <UInput
          v-model="state.username"
          placeholder="Enter username"
          autocomplete="username"
          :disabled="loading"
          class="w-full"
        />
      </UFormField>

      <UFormField name="password" label="Password">
        <UInput
          v-model="state.password"
          type="password"
          placeholder="Enter password"
          autocomplete="current-password"
          :disabled="loading"
          class="w-full"
        />
      </UFormField>

      <p v-if="error" class="text-sm text-error">
        {{ error }}
      </p>

      <UButton type="submit" block size="lg" :loading="loading">
        Sign in
      </UButton>
    </UForm>
  </div>
</template>
