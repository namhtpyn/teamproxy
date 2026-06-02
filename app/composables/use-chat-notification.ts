import { computed, ref, watch } from 'vue'
import { useDocumentVisibility, useWebNotification, whenever } from '@vueuse/core'

export function useChatNotification() {
  const unreadCount = ref(0)
  const visibility = useDocumentVisibility()
  const savedBaseTitle = ref<string | null>(null)

  const {
    isSupported,
    permissionGranted,
    ensurePermissions,
    show,
    close,
    notification,
  } = useWebNotification({ requestPermissions: false })

  const isSupportedComputed = computed(() => isSupported.value)

  watch(unreadCount, (count, prevCount) => {
    if (!import.meta.client) return

    if (count > 0) {
      if (prevCount === 0) {
        savedBaseTitle.value = document.title.replace(/^\(\d+\)\s*/, '')
      }
      document.title = `(${count}) ${savedBaseTitle.value}`
    } else if (savedBaseTitle.value) {
      document.title = savedBaseTitle.value
      savedBaseTitle.value = null
    }
  })

  whenever(
    computed(() => visibility.value === 'visible'),
    () => {
      unreadCount.value = 0
      if (notification.value) close()
    },
  )

  async function requestPermission(): Promise<boolean> {
    if (!import.meta.client) return false
    const result = await ensurePermissions()
    return result === true
  }

  async function notifyNewMessage(
    chatId: string,
    senderName: string,
    body: string,
    chatName: string | null,
  ): Promise<void> {
    if (!import.meta.client) return
    if (!permissionGranted.value) return
    if (visibility.value === 'visible') return

    const stripped = body.replace(/<[^>]*>/g, '').slice(0, 100)
    const notifTitle = chatName ? `${senderName} in ${chatName}` : senderName

    show({
      title: notifTitle,
      body: stripped,
      tag: `chat-${chatId}`,
      icon: '/favicon.ico',
    })
  }

  function incrementUnread(): void {
    unreadCount.value++
  }

  function clearUnread(): void {
    unreadCount.value = 0
  }

  return {
    isSupported: isSupportedComputed,
    permissionGranted,
    requestPermission,
    notifyNewMessage,
    unreadCount,
    incrementUnread,
    clearUnread,
  }
}
