import {
  decryptSecret,
  encryptSecret,
  isEncryptionConfigured,
  previewSecret,
} from '@traveler-guide/integrations';

const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);

/** The master key is read from the environment on every call, so set it per test. */
const withKey = <T>(key: string | undefined, run: () => T): T => {
  const previous = process.env.SETTINGS_ENCRYPTION_KEY;
  if (key === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY;
  else process.env.SETTINGS_ENCRYPTION_KEY = key;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY;
    else process.env.SETTINGS_ENCRYPTION_KEY = previous;
  }
};

describe('integration secret encryption', () => {
  it('round-trips a secret', () => {
    withKey(KEY_A, () => {
      const secret = 'AIzaSyExampleGoogleMapsKey1234567890';
      expect(decryptSecret(encryptSecret(secret))).toBe(secret);
    });
  });

  it('never stores the secret in readable form', () => {
    withKey(KEY_A, () => {
      const secret = 'sk.super-secret-mapbox-token';
      const stored = encryptSecret(secret);
      expect(stored).not.toContain(secret);
      expect(stored.startsWith('v1:')).toBe(true);
      expect(stored.split(':')).toHaveLength(4);
    });
  });

  it('produces a different ciphertext each time, so equal keys are not obvious', () => {
    withKey(KEY_A, () => {
      const secret = 'same-value-twice';
      expect(encryptSecret(secret)).not.toBe(encryptSecret(secret));
    });
  });

  it('refuses a payload whose ciphertext has been tampered with', () => {
    withKey(KEY_A, () => {
      const stored = encryptSecret('original-value');
      const [version, iv, tag, ciphertext] = stored.split(':');
      const flipped = Buffer.from(ciphertext, 'base64url');
      flipped[0] ^= 0xff;
      const tampered = [version, iv, tag, flipped.toString('base64url')].join(':');

      expect(() => decryptSecret(tampered)).toThrow();
    });
  });

  it('refuses a payload encrypted under a different master key', () => {
    const stored = withKey(KEY_A, () => encryptSecret('rotated-away'));
    withKey(KEY_B, () => {
      expect(() => decryptSecret(stored)).toThrow();
    });
  });

  it('rejects a malformed payload rather than returning something wrong', () => {
    withKey(KEY_A, () => {
      expect(() => decryptSecret('not-encrypted-at-all')).toThrow(/expected format/i);
      expect(() => decryptSecret('v2:a:b:c')).toThrow(/expected format/i);
    });
  });

  it('reports whether encryption is usable', () => {
    expect(withKey(KEY_A, isEncryptionConfigured)).toBe(true);
    expect(withKey(undefined, isEncryptionConfigured)).toBe(false);
    // Too short to stretch into a sound key.
    expect(withKey('short', isEncryptionConfigured)).toBe(false);
  });

  it('accepts a passphrase and derives a stable key from it', () => {
    const passphrase = 'a-long-enough-passphrase-for-scrypt';
    const stored = withKey(passphrase, () => encryptSecret('via-passphrase'));
    expect(withKey(passphrase, () => decryptSecret(stored))).toBe('via-passphrase');
  });
});

describe('previewSecret', () => {
  it('shows enough of a long key to recognise it, and no more', () => {
    const preview = previewSecret('AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ6Hk');
    expect(preview).toBe('AIzaSy…6Hk');
    expect(preview).not.toContain('MNOPQRST');
  });

  it('withholds short values entirely, where a hint would give away too much', () => {
    expect(previewSecret('short-key')).toBe('••••••');
    expect(previewSecret('123456789012')).toBe('••••••');
  });
});
