export const CHAT_EDITOR_STARTER_KIT = {
  blockquote: false as const,
  codeBlock: false as const,
  heading: false as const,
  bulletList: false as const,
  orderedList: false as const,
}

export const CHAT_EDITOR_UI = {
  root: 'rounded-lg border border-default bg-elevated overflow-hidden',
  content: 'relative min-h-[38px] max-h-[120px] overflow-y-auto',
  base: 'w-full outline-none px-3 py-2.5 text-sm *:m-0 [&_p]:leading-6 [&_.mention]:text-primary [&_.mention]:font-medium [&_img]:max-h-[80px] [&_img]:rounded [&_img]:inline selection:bg-primary/20',
}

export const REPLY_EDITOR_UI = {
  root: 'rounded-lg border border-default bg-elevated overflow-hidden',
  content: 'relative min-h-[32px] max-h-[100px] overflow-y-auto',
  base: 'w-full outline-none px-2.5 py-1.5 text-sm *:m-0 [&_p]:leading-5 [&_.mention]:text-primary [&_.mention]:font-medium [&_img]:max-h-[80px] [&_img]:rounded [&_img]:inline selection:bg-primary/20',
}
