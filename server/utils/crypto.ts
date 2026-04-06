import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

let _key: Buffer | null = null

function getEncryptionKey(): Buffer {
  if (_key) return _key
  const secret = useRuntimeConfig().encryptionKey
  if (!secret) {
    throw new Error('ENCRYPTION_KEY environment variable is required')
  }
  _key = createHash('sha256').update(secret).digest()
  return _key
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error(`[crypto] Invalid encrypted value format (expected iv:tag:ciphertext, got ${parts.length} parts)`)
  }

  const key = getEncryptionKey()
  const [ivHex, authTagHex, encrypted] = parts
  const iv = Buffer.from(ivHex!, 'hex')
  const authTag = Buffer.from(authTagHex!, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted!, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
