import { describe, it, expect, vi } from 'vitest'

// Mock consola before importing crypto module (which now imports consola)
vi.mock('consola', () => ({ consola: { warn: vi.fn() } }))

// Mock Nitro auto-import before importing crypto module
const TEST_KEY = 'a'.repeat(32)
vi.stubGlobal('useRuntimeConfig', () => ({ encryptionKey: TEST_KEY }))

// eslint-disable-next-line import/first -- vi.stubGlobal must precede dynamic imports
import { encrypt, decrypt } from '../crypto'

describe('encrypt/decrypt', () => {
  it('round-trips: encrypt then decrypt returns original plaintext', () => {
    const plaintext = 'hello world'
    const ciphertext = encrypt(plaintext)
    expect(decrypt(ciphertext)).toBe(plaintext)
  })

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const plaintext = 'deterministic input'
    const results = new Set([encrypt(plaintext), encrypt(plaintext), encrypt(plaintext)])
    expect(results.size).toBe(3)
  })

  it('handles empty string', () => {
    const ciphertext = encrypt('')
    expect(decrypt(ciphertext)).toBe('')
  })

  it('handles unicode/emoji content', () => {
    const plaintext = '你好世界 🌍 café résumé naïve'
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })

  it('handles long strings (4KB+)', () => {
    const plaintext = 'x'.repeat(4096)
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })

  it('ciphertext format is iv:authTag:encrypted (three colon-separated hex parts)', () => {
    const ciphertext = encrypt('test')
    const parts = ciphertext.split(':')
    expect(parts).toHaveLength(3)
    for (const part of parts) {
      expect(part).toMatch(/^[0-9a-f]+$/)
    }
  })

  it('throws for non-encrypted values (wrong format)', () => {
    expect(() => decrypt('plaintext')).toThrow('[crypto] Invalid encrypted value format')
    expect(() => decrypt('one:two')).toThrow('[crypto] Invalid encrypted value format')
    expect(() => decrypt('one:two:three:four')).toThrow('[crypto] Invalid encrypted value format')
  })

  it('throws for tampered ciphertext (corrupted auth tag)', () => {
    const ciphertext = encrypt('secret data')
    const parts = ciphertext.split(':')
    parts[1] = '0'.repeat(parts[1]!.length)
    expect(() => decrypt(parts.join(':'))).toThrow()
  })

  it('throws for tampered ciphertext (corrupted encrypted data)', () => {
    const ciphertext = encrypt('secret data')
    const parts = ciphertext.split(':')
    const corrupted = parts[0] + ':' + parts[1] + ':' + 'deadbeef'
    expect(() => decrypt(corrupted)).toThrow()
  })
})
