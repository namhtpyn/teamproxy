import { consola } from 'consola'
import { setWebhookOrigin } from '../utils/webhook-origin'
import { ensureMsSubscriptions } from '../utils/subscriptions/ensure-ms-subscriptions'

export default defineNitroPlugin((nitroApp) => {
  let initialEnsureTriggered = false

  nitroApp.hooks.hook('request', (event) => {
    const origin = getRequestURL(event).origin
    setWebhookOrigin(origin)

    if (!initialEnsureTriggered) {
      initialEnsureTriggered = true
      consola.info(`[ensure-ms-subscriptions] Origin captured: ${origin}, running initial ensure...`)
      ensureMsSubscriptions().catch(err => {
        consola.error('[ensure-ms-subscriptions] Initial ensure failed:', err)
      })
    }
  })
})
