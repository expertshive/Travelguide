import AsyncStorage from '@react-native-async-storage/async-storage';

export type AssistantGender = 'female' | 'male';
export type AssistantLanguage = 'en-US' | 'ar-SA';

export type AssistantPrefs = {
  gender: AssistantGender;
  name: string;
  language: AssistantLanguage;
};

const KEY = 'tg_assistant_prefs';

export const DEFAULT_NAME: Record<AssistantGender, string> = {
  female: 'Layla',
  male: 'Sami',
};

export const DEFAULT_PREFS: AssistantPrefs = {
  gender: 'female',
  name: DEFAULT_NAME.female,
  language: 'en-US',
};

export async function loadAssistantPrefs(): Promise<AssistantPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<AssistantPrefs>) };
  } catch {
    /* fall through to defaults */
  }
  return DEFAULT_PREFS;
}

export async function saveAssistantPrefs(prefs: AssistantPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* best-effort persistence */
  }
}
