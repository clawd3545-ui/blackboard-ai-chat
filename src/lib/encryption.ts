// ============================================
// SERVER-SIDE ENCRYPTION — AES-256-GCM + PBKDF2
//
// Security specs (2024 OWASP compliant):
// - Algorithm: AES-256-GCM (authenticated encryption)
// - Key derivation: PBKDF2-SHA256, 600,000 iterations
// - Salt: 16 bytes random per key (128-bit)
// - IV: 12 bytes random per encryption (96-bit)
// - Auth tag: 128-bit (GCM default)
//
// What this means for users:
// - Even if DB is leaked, keys cannot be decrypted
//   without ENCRYPTION_SECRET env var
// - Each key has its own salt → rainbow tables useless
// - GCM tag prevents ciphertext tampering
// ============================================

interface EncryptedData { encryptedKey: string; iv: string; tag: string; salt: string; }
interface DecryptInput { encryptedKey: string; iv: string; tag: string; salt: string; }

// ============================================
// KEY DERIVATION — PBKDF2-SHA256
// 600,000 iterations = OWASP 2023 minimum for SHA-256
// Takes ~200ms per operation on modern hardware
// This is intentional: makes brute force infeasible
// ============================================
async function deriveKey(saltBytes: Uint8Array): Promise<CryptoKey> {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error('ENCRYPTION_SECRET environment variable is not set');

  const encoder = new TextEncoder();

  // Import the master secret as PBKDF2 material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive 256-bit AES-GCM key
  // FIX: Use saltBytes.buffer.slice() to get a clean ArrayBuffer
  // (Node.js Buffer.buffer can point to a shared pool — this was the bug)
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer.slice(saltBytes.byteOffset, saltBytes.byteOffset + saltBytes.byteLength) as ArrayBuffer,
      iterations: 600_000, // OWASP 2023: min 600k for SHA-256
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ============================================
// ENCRYPT — Returns separate ciphertext + tag
// ============================================
export async function serverEncrypt(plaintext: string): Promise<EncryptedData> {
  // Random salt per key — each user key has unique derivation
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));

  // Random IV per encryption — never reuse with same key
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(saltBytes);
  const encoder = new TextEncoder();

  // AES-GCM encrypts + appends 16-byte auth tag at the end
  const ciphertextWithTag = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBytes, tagLength: 128 },
    key,
    encoder.encode(plaintext)
  );

  // Split ciphertext and tag for separate storage
  const ciphertextWithTagBytes = new Uint8Array(ciphertextWithTag);
  const ciphertextBytes = ciphertextWithTagBytes.slice(0, -16);
  const tagBytes = ciphertextWithTagBytes.slice(-16);

  return {
    encryptedKey: Buffer.from(ciphertextBytes).toString('base64'),
    iv: Buffer.from(ivBytes).toString('base64'),
    tag: Buffer.from(tagBytes).toString('base64'),
    salt: Buffer.from(saltBytes).toString('base64'),
  };
}

// ============================================
// DECRYPT — Reconstructs ciphertext+tag, decrypts
// Throws if tag is invalid (tampered data)
// ============================================
export async function serverDecrypt(input: DecryptInput): Promise<string> {
  // Decode from base64
  const saltBytes = new Uint8Array(Buffer.from(input.salt, 'base64'));
  const ivBytes = new Uint8Array(Buffer.from(input.iv, 'base64'));
  const ciphertextBytes = new Uint8Array(Buffer.from(input.encryptedKey, 'base64'));
  const tagBytes = new Uint8Array(Buffer.from(input.tag, 'base64'));

  const key = await deriveKey(saltBytes);

  // Reconstruct ciphertext+tag (what AES-GCM expects)
  const fullCiphertext = new Uint8Array(ciphertextBytes.length + tagBytes.length);
  fullCiphertext.set(ciphertextBytes);
  fullCiphertext.set(tagBytes, ciphertextBytes.length);

  // Decrypt — throws DOMException if auth tag is wrong
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes, tagLength: 128 },
    key,
    fullCiphertext
  );

  return new TextDecoder().decode(plaintext);
}
