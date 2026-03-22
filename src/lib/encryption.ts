// ============================================
// SERVER-SIDE ENCRYPTION — AES-256-GCM + PBKDF2
//
// Security specs:
// - Algorithm: AES-256-GCM (authenticated encryption)
// - Key derivation: PBKDF2-SHA256, 100,000 iterations
//   (OWASP minimum for SHA-256; 600k is for password hashing —
//    here the attacker needs BOTH the DB dump AND the ENCRYPTION_SECRET
//    env var, making brute force irrelevant at any iteration count)
// - Salt: 16 bytes random per key
// - IV: 12 bytes random per encryption
// - Auth tag: 128-bit GCM
// ============================================

interface EncryptedData { encryptedKey: string; iv: string; tag: string; salt: string; }
interface DecryptInput { encryptedKey: string; iv: string; tag: string; salt: string; }

async function deriveKey(saltBytes: Uint8Array): Promise<CryptoKey> {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error('ENCRYPTION_SECRET is not set');
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer.slice(saltBytes.byteOffset, saltBytes.byteOffset + saltBytes.byteLength) as ArrayBuffer,
      iterations: 100_000, // Secure: attacker needs DB + ENCRYPTION_SECRET env var
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function serverEncrypt(plaintext: string): Promise<EncryptedData> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(saltBytes);
  const ciphertextWithTag = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBytes, tagLength: 128 },
    key,
    new TextEncoder().encode(plaintext)
  );
  const bytes = new Uint8Array(ciphertextWithTag);
  return {
    encryptedKey: Buffer.from(bytes.slice(0, -16)).toString('base64'),
    iv: Buffer.from(ivBytes).toString('base64'),
    tag: Buffer.from(bytes.slice(-16)).toString('base64'),
    salt: Buffer.from(saltBytes).toString('base64'),
  };
}

export async function serverDecrypt(input: DecryptInput): Promise<string> {
  const saltBytes = new Uint8Array(Buffer.from(input.salt, 'base64'));
  const ivBytes = new Uint8Array(Buffer.from(input.iv, 'base64'));
  const ciphertextBytes = new Uint8Array(Buffer.from(input.encryptedKey, 'base64'));
  const tagBytes = new Uint8Array(Buffer.from(input.tag, 'base64'));
  const key = await deriveKey(saltBytes);
  const fullCiphertext = new Uint8Array(ciphertextBytes.length + tagBytes.length);
  fullCiphertext.set(ciphertextBytes);
  fullCiphertext.set(tagBytes, ciphertextBytes.length);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes, tagLength: 128 },
    key,
    fullCiphertext
  );
  return new TextDecoder().decode(plaintext);
}
