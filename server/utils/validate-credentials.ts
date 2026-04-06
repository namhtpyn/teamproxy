const CREDENTIAL_FORMAT = /^[^:]+:.+$/

export function validateCredentials(appAdmin: string, appUser: string): void {
  if (!CREDENTIAL_FORMAT.test(appAdmin)) {
    throw new Error('NUXT_APP_ADMIN must be in format username:password')
  }
  if (!CREDENTIAL_FORMAT.test(appUser)) {
    throw new Error('NUXT_APP_USER must be in format username:password')
  }
}
