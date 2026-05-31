<script setup lang="ts">
import type { Chat } from '~/types/chat'

const props = defineProps<{
  chat: Chat | null
}>()

const emit = defineEmits<{
  back: []
}>()

const { msUserId, ensure: ensureMsUser } = useMsUser()
const { user } = useAuth()

const displayName = computed(() => getChatDisplayName(props.chat!, user.value?.id))
const initial = computed(() => getChatInitial(props.chat!, user.value?.id))
const chatType = computed(() => getChatType(props.chat!))
const chatMembers = computed(() => getChatMembers(props.chat!))

const {
  messages, messagesLoading, messagesError, loadingMore,
  messageListRef, sortedMessages, isNearBottom, pendingSends,
  loadMessages, loadMore, refreshMessages, appendIncomingMessage,
} = useConversationMessages(
  () => props.chat,
  { msUserId: () => msUserId.value },
)

watch(() => props.chat?.id, () => { if (props.chat) ensureMsUser() })

const {
  replyingTo, editingMessageId, pinnedMessageIds,
  handleSubmit, retryMessage, handleReaction,
  onReply, clearReply, onEdit, onSaveEdit, onCancelEdit,
  onDelete, onPin, onUnpin,
} = useMessageActions(
  () => props.chat,
  messages,
  pendingSends,
  messageListRef,
  () => msUserId.value ?? undefined,
)

defineExpose({ messagesContainer: messageListRef, refreshMessages, appendIncomingMessage, isNearBottom })
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col">
    <AppEmptyState v-if="!chat" icon="i-lucide-message-circle" message="Select a conversation to start chatting" size="lg" />

    <template v-else>
      <div class="flex-shrink-0 border-b border-default bg-default px-4 py-3">
        <div class="flex items-center gap-3">
          <UButton
            icon="i-lucide-arrow-left"
            variant="ghost"
            size="sm"
            aria-label="Go back"
            class="md:hidden"
            @click="emit('back')"
          />
          <UAvatar size="2xs" class="flex-shrink-0">
            {{ initial }}
          </UAvatar>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-highlighted">
              {{ displayName }}
            </p>
            <p v-if="chatType !== 'oneOnOne'" class="text-xs text-dimmed">
              {{ chatMembers.length }} members
            </p>
          </div>
          <UBadge v-if="chatType === 'meeting'" color="info" variant="outline" size="xs">Meeting</UBadge>
          <UBadge v-else-if="chatType === 'group'" color="neutral" variant="outline" size="xs">Group</UBadge>
        </div>
      </div>

      <div v-if="messagesLoading" class="flex flex-1 items-center justify-center">
        <AppLoadingSpinner>Loading messages...</AppLoadingSpinner>
      </div>

      <AppErrorAlert v-else-if="messagesError" :message="messagesError" @retry="loadMessages" />

      <AppEmptyState v-else-if="sortedMessages.length === 0" icon="i-lucide-message-circle" message="No messages in this conversation" />

      <AppMessageList
         v-else
         ref="messageListRef"
         :messages="sortedMessages"
         :loading-more="loadingMore"
          :editing-message-id="editingMessageId"
          :pinned-message-ids="pinnedMessageIds"
          :members="chatMembers"
         @load-more="loadMore"
         @retry="retryMessage"
         @react="handleReaction"
         @reply="onReply"
         @edit="onEdit"
         @delete="onDelete"
         @save-edit="onSaveEdit"
         @cancel-edit="onCancelEdit"
         @pin="onPin"
         @unpin="onUnpin"
       />

      <AppMessageInput
        :chat-id="chat.id!"
        :members="chatMembers"
        :disabled="!chat.canRespond"
        :replying-to="replyingTo"
        @submit="handleSubmit"
        @cancel-reply="clearReply"
      />
    </template>
  </div>
</template>
