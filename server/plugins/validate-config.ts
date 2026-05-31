import { validateCredentials } from '../utils/validate-credentials'

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()

  const required = [
    { key: 'databaseUrl', name: 'NUXT_DATABASE_URL' },
    { key: 'appAdmin', name: 'NUXT_APP_ADMIN' },
    { key: 'appUser', name: 'NUXT_APP_USER' },
    { key: 'msClientId', name: 'NUXT_MS_CLIENT_ID' },
    { key: 'msClientSecret', name: 'NUXT_MS_CLIENT_SECRET' },
    { key: 'msTenantId', name: 'NUXT_MS_TENANT_ID' },
  ]

  const missing = required.filter((r) => !config[r.key as keyof typeof config])

  if (missing.length > 0) {
    const list = missing.map((r) => `  - ${r.name} (runtimeConfig.${r.key})`).join('\n')
    throw new Error(`Missing required environment variables:\n${list}\n\nCheck your .env file.`)
  }

  validateCredentials(config.appAdmin, config.appUser)
})
