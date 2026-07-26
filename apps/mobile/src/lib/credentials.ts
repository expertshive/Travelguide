import * as Keychain from 'react-native-keychain';

/**
 * "Remember me" credentials live in the iOS Keychain / Android Keystore rather than
 * AsyncStorage, so the password is never written to app storage in plain text.
 */
const SERVICE = 'com.travelerguide.remembered-login';

export type SavedCredentials = {
  email: string;
  password: string;
};

export async function getSavedCredentials(): Promise<SavedCredentials | null> {
  try {
    const entry = await Keychain.getGenericPassword({ service: SERVICE });
    if (!entry) return null;
    return { email: entry.username, password: entry.password };
  } catch {
    return null;
  }
}

export async function saveCredentials({ email, password }: SavedCredentials): Promise<void> {
  try {
    await Keychain.setGenericPassword(email, password, { service: SERVICE });
  } catch {
    // Remembering is best-effort; a keychain failure must not block signing in.
  }
}

export async function clearSavedCredentials(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({ service: SERVICE });
  } catch {
    // Ignore: nothing stored, or the keychain is unavailable.
  }
}
