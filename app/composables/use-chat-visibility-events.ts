import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'

export function useChatVisibilityEvents() {
  const { $orpc } = useNuxtApp()

  const { data: liveVisibilityEvent } = useQuery(
    computed(() => $orpc.chats.liveVisibility.experimental_liveOptions({
      retry: true,
      enabled: import.meta.client,
    })),
  )

  return { liveVisibilityEvent }
}
