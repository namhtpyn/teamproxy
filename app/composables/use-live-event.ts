import { computed, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'

type LiveEndpoint = 'liveMessages' | 'liveVisibility' | 'liveRespond' | 'liveDisconnect'

type MessageEvent = { type: 'message'; chatId: string; data: { id: string; [x: string]: unknown } | null }
type VisibilityEvent = { type: 'visibility'; chatId: string; data: { allowed: boolean } }
type RespondEvent = { type: 'respond'; chatId: string; data: { canRespond: boolean } }
type DisconnectEvent = { type: 'disconnect'; chatId?: string; data: { reason: string } }

export function useLiveEvent(endpoint: 'liveMessages'): Ref<MessageEvent | undefined>
export function useLiveEvent(endpoint: 'liveVisibility'): Ref<VisibilityEvent | undefined>
export function useLiveEvent(endpoint: 'liveRespond'): Ref<RespondEvent | undefined>
export function useLiveEvent(endpoint: 'liveDisconnect'): Ref<DisconnectEvent | undefined>
export function useLiveEvent(endpoint: LiveEndpoint) {
  const { $orpc } = useNuxtApp()
  const queries = {
    liveMessages: () => useQuery(computed(() => $orpc.chats.liveMessages.experimental_liveOptions({ retry: true, enabled: import.meta.client }))),
    liveVisibility: () => useQuery(computed(() => $orpc.chats.liveVisibility.experimental_liveOptions({ retry: true, enabled: import.meta.client }))),
    liveRespond: () => useQuery(computed(() => $orpc.chats.liveRespond.experimental_liveOptions({ retry: true, enabled: import.meta.client }))),
    liveDisconnect: () => useQuery(computed(() => $orpc.chats.liveDisconnect.experimental_liveOptions({ retry: true, enabled: import.meta.client }))),
  }
  const { data } = queries[endpoint]()
  return data
}
