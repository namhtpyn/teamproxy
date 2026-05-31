import { computed, ref } from 'vue'

interface MsUser {
  id: string
  displayName: string
}

let inflightPromise: Promise<void> | null = null

export function useMsUser() {
  const { $orpcClient: $orpc } = useNuxtApp()
  const msUser = useState<MsUser | null>('ms-user', () => null)
  const loading = ref(false)

  async function ensure() {
    if (msUser.value) return msUser.value
    if (inflightPromise) {
      await inflightPromise
      return msUser.value
    }
    loading.value = true
    inflightPromise = (async () => {
      try {
        const me = await $orpc.chats.getMe().catch(() => null)
        msUser.value = me
      }
      finally {
        loading.value = false
        inflightPromise = null
      }
    })()
    await inflightPromise
    return msUser.value
  }

  return {
    msUser: computed(() => msUser.value),
    msUserId: computed(() => msUser.value?.id ?? null),
    loading: computed(() => loading.value),
    ensure,
  }
}
