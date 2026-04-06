import { lazy } from '@orpc/server'

export const appRouter = {
  auth: lazy(() => import('./procedures/auth').then(m => ({ default: m.authRouter }))),
  chats: lazy(() => import('./procedures/chats').then(m => ({ default: m.chatsRouter }))),
  chatVisibility: lazy(() => import('./procedures/chat-visibility').then(m => ({ default: m.chatVisibilityRouter }))),
  subscriptions: lazy(() => import('./procedures/subscriptions').then(m => ({ default: m.subscriptionsRouter }))),
}

export type AppRouter = typeof appRouter
