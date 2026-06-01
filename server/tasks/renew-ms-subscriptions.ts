import { consola } from 'consola'
import { ensureMsSubscriptions } from '../utils/subscriptions/ensure-ms-subscriptions'

export default defineTask({
  meta: {
    name: 'renew-ms-subscriptions',
    description: 'Renew and create Graph subscriptions',
  },
  async run() {
    const result = await ensureMsSubscriptions()
    consola.info(`[renew-ms-subscriptions] Renewed: ${result.renewed}, Created: ${result.created}, Failed: ${result.failed}`)
    return {}
  },
})
