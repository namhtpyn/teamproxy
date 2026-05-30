import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'

export function useDisconnectEvents() {
  const { $orpc } = useNuxtApp()

  const { data: liveDisconnectEvent } = useQuery(
    computed(() => $orpc.chats.liveDisconnect.experimental_liveOptions({
      retry: true,
      enabled: import.meta.client,
    })),
  )

  return { liveDisconnectEvent }
}
