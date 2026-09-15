'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = Buffer.from(process.env.PII_ENCRYPTION_KEY || '12345678901234567890123456789012', 'utf8');

class CryptoUtil {
  /**
   * Encrypt sensitive PII text with AES-256-GCM
   */
  static encrypt(plainText) {
    if (!plainText) return plainText;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt AES-256-GCM encrypted text
   */
  static decrypt(cipherText) {
    if (!cipherText || !cipherText.includes(':')) return cipherText;
    const [ivHex, authTagHex, encryptedText] = cipherText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

module.exports = CryptoUtil;
