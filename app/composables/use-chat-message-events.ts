import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'

export function useChatMessageEvents() {
  const { $orpc } = useNuxtApp()

  const { data: liveMessageEvent } = useQuery(
    computed(() => $orpc.chats.liveMessages.experimental_liveOptions({
      retry: true,
      enabled: import.meta.client,
    })),
  )

  return { liveMessageEvent }
}
