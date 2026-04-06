import { describe, it, expect } from 'vitest'
import { validateCredentials } from '../../utils/validate-credentials'

describe('validateCredentials', () => {
  it('does not throw for valid format "admin:password123"', () => {
    expect(() => validateCredentials('admin:password123', 'user:pass456')).not.toThrow()
  })

  it('does not throw when password contains colons', () => {
    expect(() => validateCredentials('admin:pass:with:colons', 'user@domain:p:a:s:s')).not.toThrow()
  })

  it('throws for empty appAdmin string', () => {
    expect(() => validateCredentials('', 'user:pass'))
      .toThrow('NUXT_APP_ADMIN must be in format username:password')
  })

  it('throws for appAdmin with no colon', () => {
    expect(() => validateCredentials('admin', 'user:pass'))
      .toThrow('NUXT_APP_ADMIN must be in format username:password')
  })

  it('throws for appAdmin with empty username', () => {
    expect(() => validateCredentials(':password', 'user:pass'))
      .toThrow('NUXT_APP_ADMIN must be in format username:password')
  })

  it('throws for appAdmin with empty password', () => {
    expect(() => validateCredentials('admin:', 'user:pass'))
      .toThrow('NUXT_APP_ADMIN must be in format username:password')
  })

  it('throws for empty appUser string', () => {
    expect(() => validateCredentials('admin:pass', ''))
      .toThrow('NUXT_APP_USER must be in format username:password')
  })

  it('throws for appUser with no colon', () => {
    expect(() => validateCredentials('admin:pass', 'user'))
      .toThrow('NUXT_APP_USER must be in format username:password')
  })

  it('throws for appUser with empty username', () => {
    expect(() => validateCredentials('admin:pass', ':secret'))
      .toThrow('NUXT_APP_USER must be in format username:password')
  })

  it('throws for appUser with empty password', () => {
    expect(() => validateCredentials('admin:pass', 'user:'))
      .toThrow('NUXT_APP_USER must be in format username:password')
  })
})
