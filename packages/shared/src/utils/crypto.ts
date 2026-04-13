import crypto from 'crypto'
import zlib from 'zlib'

/**
 * 解密 Kook Webhook 消息体（AES-256-CBC）
 * 官方文档步骤：
 * 1. Base64 解码整个 encrypt 字符串
 * 2. 前16字节为 IV（字符串形式）
 * 3. 第16字节后的内容再做一次 Base64 解码，得到真正的密文
 * 4. AES-256-CBC 解密
 */
export function decryptWebhookBody(encryptedStr: string, encryptKey: string): string {
  if (!encryptKey) return encryptedStr

  // 1. Base64 解码
  const decoded = Buffer.from(encryptedStr, 'base64').toString('utf-8')

  // 2. 前16字节为 IV（取字符串，不是 buffer slice）
  const iv = Buffer.from(decoded.slice(0, 16), 'utf-8')

  // 3. 第16字节后再做一次 Base64 解码
  const ciphertext = Buffer.from(decoded.slice(16), 'base64')

  // 4. key 补全到 32 字节
  const key = Buffer.alloc(32)
  Buffer.from(encryptKey, 'utf-8').copy(key)

  // 5. AES-256-CBC 解密
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf-8')
}

/**
 * 解压 zlib deflate 压缩数据
 */
export function decompressBody(data: Buffer): string {
  try {
    return zlib.inflateSync(data).toString('utf-8')
  } catch {
    return data.toString('utf-8')
  }
}

/**
 * 生成随机字符串
 */
export function randomString(length: number): string {
  return crypto.randomBytes(length).toString('hex').slice(0, length)
}

/**
 * 加密 Bot Token（用于存储到平台数据库）
 */
export function encryptToken(token: string, secret: string): string {
  const iv = crypto.randomBytes(16)
  const key = crypto.scryptSync(secret, 'kook-saas-salt', 32)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf-8'), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

/**
 * 解密 Bot Token
 */
export function decryptToken(encrypted: string, secret: string): string {
  const [ivHex, dataHex] = encrypted.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const key = crypto.scryptSync(secret, 'kook-saas-salt', 32)
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf-8')
}
