<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import type { ChatMessage } from '@microsoft/microsoft-graph-types'
import type { ChatMember, OptimisticChatMessage } from '~/types/chat'

const props = withDefaults(defineProps<{
  chatId: string
  members: ChatMember[]
  msUserId?: string | null
  disabled: boolean
  replyingTo?: ChatMessage | OptimisticChatMessage | null
}>(), {
  replyingTo: null,
})

const emit = defineEmits<{
  submit: [payload: {
    content: string
    image: { contentBytes: string; contentType: string } | null
    mentions: Array<{ userId: string; displayName: string }> | undefined
    replyToId?: string
    hostedContents?: Array<{ temporaryId: string; contentBytes: string; contentType: string }>
  }]
  'cancel-reply': []
}>()

const editorContent = ref('')
let editorInstance: Editor | null = null

function extractMentionsFromEditor(): Array<{ userId: string; displayName: string }> {
  const editor = editorInstance
  if (!editor || editor.isDestroyed) return []
  const mentions: Array<{ userId: string; displayName: string }> = []
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'mention') {
      const userId = (node.attrs.id as string | undefined) ?? (node.attrs.userId as string | undefined)
      const displayName = node.attrs.label as string | undefined
      if (userId && displayName && !mentions.some(m => m.userId === userId)) {
        mentions.push({ userId, displayName })
      }
    }
  })
  return mentions
}

function extractPlainText(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent ?? '').trim()
}

function sendMessage() {
  const editor = editorInstance
  if (!editor || editor.isDestroyed) return

  const mentions = extractMentionsFromEditor()
  let html = editorContent.value

  const imageRegex = /<img[^>]+src="(data:image\/[^"]+)"[^>]*>/g
  const images: { dataUrl: string; tempId: string; original: string }[] = []
  let match: RegExpExecArray | null
  while ((match = imageRegex.exec(html)) !== null) {
    images.push({ dataUrl: match[1], tempId: String(images.length + 1), original: match[0] })
  }
  for (const img of images) {
    html = html.replace(img.original, `<img src="../hostedContents/${img.tempId}/$value">`)
  }

  const text = extractPlainText(html)
  if (!text && images.length === 0) return

  editorContent.value = ''

  const hasImages = images.length > 0
  const hasMentions = mentions.length > 0
  const content = html

  const hostedContents = images.map((img, i) => {
    const imgMatch = img.dataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
    if (!imgMatch) return null
    return {
      temporaryId: String(i + 1),
      contentBytes: imgMatch[2],
      contentType: imgMatch[1],
    }
  }).filter((hc): hc is NonNullable<typeof hc> => hc !== null)

  emit('submit', {
    content,
    image: null,
    mentions: hasMentions ? mentions : undefined,
    replyToId: props.replyingTo?.id?.startsWith('temp:') ? undefined : props.replyingTo?.id,
    hostedContents: hostedContents.length > 0 ? hostedContents : undefined,
  })
}

function handleEditorKeydown(_view: unknown, event: KeyboardEvent): boolean {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
    return true
  }
  return false
}

function handleEditorPaste(_view: unknown, event: ClipboardEvent): boolean {
  const files = Array.from(event.clipboardData?.files ?? [])
  const imageFile = files.find(f => f.type.startsWith('image/'))
  if (imageFile && editorInstance && !editorInstance.isDestroyed) {
    event.preventDefault()
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      editorInstance!.chain().focus().setImage({ src: dataUrl }).run()
    }
    reader.readAsDataURL(imageFile)
    return true
  }
  return false
}

const editorUi = {
  root: 'rounded-lg border border-default bg-elevated overflow-hidden',
  content: 'relative min-h-[38px] max-h-[120px] overflow-y-auto',
  base: 'w-full outline-none px-3 py-2.5 text-sm *:m-0 [&_p]:leading-6 [&_.mention]:text-primary [&_.mention]:font-medium [&_img]:max-h-[80px] [&_img]:rounded [&_img]:inline selection:bg-primary/20',
}

const editorStarterKit = {
  blockquote: false,
  codeBlock: false,
  heading: false,
  bulletList: false,
  orderedList: false,
}

const editorPropsConfig = {
  handleKeyDown: handleEditorKeydown,
  handlePaste: handleEditorPaste,
}

const mentionAppendTo = () => document.body

const mentionItems = computed(() =>
  props.members
    .filter((m): m is ChatMember & { userId: string } => m.userId != null && m.userId !== props.msUserId)
    .map(m => ({ label: m.displayName, id: m.userId })),
)

const replySenderName = computed(() => {
  if (!props.replyingTo) return ''
  const senderId = props.replyingTo.from?.user?.id
  const member = props.members.find(m => m.userId === senderId)
  return member?.displayName ?? props.replyingTo.from?.user?.displayName ?? 'Unknown'
})

const replyPreviewText = computed(() => {
  if (!props.replyingTo) return ''
  return (props.replyingTo.body?.content ?? '').replace(/<[^>]*>/g, '').slice(0, 80)
})

watch(() => props.chatId, () => {
  editorContent.value = ''
})
</script>

<template>
  <div
    v-if="!disabled"
    class="flex-shrink-0 border-t border-default bg-default p-4"
  >
    <form
      class="mx-auto flex max-w-3xl flex-col gap-2"
      @submit.prevent="sendMessage"
    >
      <div v-if="replyingTo" class="flex items-center gap-2 rounded-lg bg-elevated px-3 py-2">
        <UIcon name="i-lucide-reply" class="h-4 w-4 flex-shrink-0 text-dimmed" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-xs font-medium text-highlighted">{{ replySenderName }}</p>
          <p class="truncate text-xs text-dimmed">{{ replyPreviewText }}</p>
        </div>
        <button type="button" class="flex-shrink-0 text-dimmed hover:text-highlighted" @click="emit('cancel-reply')">
          <UIcon name="i-lucide-x" class="h-3.5 w-3.5" />
        </button>
      </div>
      <div class="flex items-end gap-2">
        <div class="flex-1">
          <UEditor
            v-model="editorContent"
            content-type="html"
            placeholder="Type a message..."
            :starter-kit="editorStarterKit"
            :editor-props="editorPropsConfig"
            :image="{ inline: true, allowBase64: true }"
            :ui="editorUi"
          >
            <template #default="{ editor }">
              <!-- Capture editor instance from slot prop — standard Vue workaround for binding slot props to local variables -->
              <Component :is="() => { editorInstance = editor; return null }" />
              <UEditorMentionMenu :editor="editor" :items="mentionItems" :append-to="mentionAppendTo" />
            </template>
          </UEditor>
        </div>
        <UButton
          type="submit"
          size="sm"
          aria-label="Send message"
          class="h-[38px]"
        >
          <UIcon name="i-lucide-send" class="h-4 w-4" />
        </UButton>
      </div>
    </form>
  </div>
  <div
    v-else
    class="flex-shrink-0 border-t border-default bg-default px-4 py-3"
  >
    <p class="text-center text-xs text-dimmed">
      Responses are disabled for this chat
    </p>
  </div>
</template>
