import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'

export function useChatRespondEvents() {
  const { $orpc } = useNuxtApp()

  const { data: liveRespondEvent } = useQuery(
    computed(() => $orpc.chats.liveRespond.experimental_liveOptions({
      retry: true,
      enabled: import.meta.client,
    })),
  )

  return { liveRespondEvent }
}
