import { encrypt, decrypt } from './encryption';

describe('AES-256-GCM Encryption', () => {
  it('encrypts and decrypts secret string faithfully', () => {
    const secret = 'super-secret-smtp-password-12345!@#$%^&*()';
    const encrypted = encrypt(secret);

    expect(encrypted).not.toEqual(secret);
    expect(encrypted.split(':').length).toBe(3); // iv:authTag:ciphertext

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(secret);
  });

  it('throws on tampered ciphertext', () => {
    const secret = 'test-secret';
    const encrypted = encrypt(secret);
    const parts = encrypted.split(':');
    // Tamper with ciphertext
    const tampered = `${parts[0]}:${parts[1]}:badbeef`;

    expect(() => decrypt(tampered)).toThrow();
  });
});
