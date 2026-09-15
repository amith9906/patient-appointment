const CryptoUtil = require('../utils/cryptoUtil');

describe('Phase 8: Security Hardening Test Suite', () => {
  test('CryptoUtil encrypts and decrypts sensitive PII field with AES-256-GCM', () => {
    const rawAadhaar = '9999-8888-7777';
    const encrypted = CryptoUtil.encrypt(rawAadhaar);

    expect(encrypted).not.toBe(rawAadhaar);
    expect(encrypted).toContain(':');

    const decrypted = CryptoUtil.decrypt(encrypted);
    expect(decrypted).toBe(rawAadhaar);
  });
});
