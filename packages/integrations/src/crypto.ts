import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const FORMAT_VERSION = 'v1';

/**
 * Fixed salt for passphrase derivation. The salt's job is to make precomputed
 * tables useless, and a per-value salt cannot be used here because the same key
 * has to be re-derived on every process start from the passphrase alone.
 */
const KEY_SALT = 'traveler-guide/integration-settings';

/**
 * Reads the master key from the environment.
 *
 * A 64-character hex string is used as 32 raw bytes; anything else is treated as
 * a passphrase and stretched with scrypt.
 */
function masterKey(): Buffer {
  const configured = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!configured) {
    throw new Error(
      'SETTINGS_ENCRYPTION_KEY is not set — integration secrets cannot be encrypted or read.',
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(configured)) {
    return Buffer.from(configured, 'hex');
  }
  if (configured.length < 16) {
    throw new Error('SETTINGS_ENCRYPTION_KEY must be at least 16 characters, or 64 hex characters.');
  }
  return scryptSync(configured, KEY_SALT, 32);
}

/** Encrypts a secret for storage. Output is `v1:iv:tag:ciphertext`, base64url parts. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, masterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    FORMAT_VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

/**
 * Reverses {@link encryptSecret}. Throws when the payload has been tampered
 * with or the master key has changed, which is deliberate: silently returning a
 * wrong value would look like a provider outage.
 */
export function decryptSecret(payload: string): string {
  const [version, iv, tag, ciphertext] = payload.split(':');
  if (version !== FORMAT_VERSION || !iv || !tag || !ciphertext) {
    throw new Error('Stored secret is not in the expected format.');
  }
  const decipher = createDecipheriv(ALGORITHM, masterKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function isEncryptionConfigured(): boolean {
  try {
    masterKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * A hint that lets an admin recognise which key is stored without exposing it.
 * Short values are withheld entirely, since revealing most of a short secret
 * defeats the purpose.
 */
export function previewSecret(value: string): string {
  if (value.length <= 12) return '••••••';
  return `${value.slice(0, 6)}…${value.slice(-3)}`;
}
