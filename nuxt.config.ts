export default defineNuxtConfig({
  modules: ['@nuxt/ui', 'nuxt-easy-lightbox'],
  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  devServer: {
    host: '0.0.0.0',
  },

  runtimeConfig: {
    databaseUrl: '',
    appAdmin: '',
    appUser: '',
    msClientId: '',
    msClientSecret: '',
    msTenantId: '',
    encryptionKey: '',
    rateLimitMaxAttempts: 5,
    rateLimitWindowMs: 60000,
    sessionMaxAge: 2592000,
    sessionMaxAgeDays: 30,
    tokenInactiveDays: 7,
  },

  nitro: {
    experimental: {
      tasks: true,
    },
    scheduledTasks: {
      '*/5 * * * *': ['refresh-tokens'],
      '*/15 * * * *': ['renew-ms-subscriptions'],
      '0 3 * * *': ['cleanup-expired'],
    },
    routeRules: {
      '/**': {
        ssr: false,
        headers: {
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
          'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' https://graph.microsoft.com data: blob:",
            "connect-src 'self' https://graph.microsoft.com https://login.microsoftonline.com",
            "font-src 'self'",
            "frame-ancestors 'none'",
          ].join('; '),
        },
      },
    },
  },
})
