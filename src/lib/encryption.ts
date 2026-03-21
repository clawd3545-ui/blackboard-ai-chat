// ============================================
// SERVER-SIDE ENCRYPTION UTILITIES
// AES-GCM encryption for API keys
// ============================================

interface EncryptedData { encryptedKey: string; iv: string; tag: string; salt: string; }
interface DecryptInput { encryptedKey: string; iv: string; tag: string; salt: string; }

async function deriveKey(salt: Buffer): Promise<CryptoKey> {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error("ENCRYPTION_SECRET environment variable is not set");
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function serverEncrypt(plaintext: string): Promise<EncryptedData> {
  const salt = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(salt);
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, encoder.encode(plaintext));
  const encryptedArray = new Uint8Array(encrypted);
  const encryptedData = encryptedArray.slice(0, -16);
  const tag = encryptedArray.slice(-16);
  return {
    encryptedKey: Buffer.from(encryptedData).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
    tag: Buffer.from(tag).toString("base64"),
    salt: salt.toString("base64"),
  };
}

export async function serverDecrypt(input: DecryptInput): Promise<string> {
  const salt = Buffer.from(input.salt, "base64");
  const iv = Buffer.from(input.iv, "base64");
  const encryptedData = Buffer.from(input.encryptedKey, "base64");
  const tag = Buffer.from(input.tag, "base64");
  const key = await deriveKey(salt);
  const fullEncrypted = new Uint8Array(encryptedData.length + tag.length);
  fullEncrypted.set(encryptedData);
  fullEncrypted.set(tag, encryptedData.length);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv), tagLength: 128 }, key, fullEncrypted);
  return new TextDecoder().decode(decrypted);
}
