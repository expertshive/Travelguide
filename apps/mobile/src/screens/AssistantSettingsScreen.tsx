import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  DEFAULT_NAME,
  loadAssistantPrefs,
  saveAssistantPrefs,
  type AssistantGender,
  type AssistantLanguage,
} from '../lib/assistantPrefs';
import { previewVoice, setAssistantVoice } from '../lib/tts';
import type { AppScreenProps } from '../navigation/types';
import {
  Button,
  Field,
  Gradient,
  Icon,
  IconButton,
  Screen,
  Txt,
  colors,
  radius,
  shadow,
  spacing,
} from '../ui';

type Props = AppScreenProps<'AssistantSettings'>;

const SAMPLE: Record<AssistantLanguage, (name: string) => string> = {
  'en-US': (name) => `Hi, I'm ${name}, your travel co-pilot. Where would you like to go?`,
  'ar-SA': (name) => `مرحباً، أنا ${name}، مساعدك في الرحلة. إلى أين تود الذهاب؟`,
};

export function AssistantSettingsScreen({ navigation }: Props) {
  const [gender, setGender] = useState<AssistantGender>('female');
  const [name, setName] = useState(DEFAULT_NAME.female);
  const [language, setLanguage] = useState<AssistantLanguage>('en-US');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadAssistantPrefs().then((p) => {
      setGender(p.gender);
      setName(p.name);
      setLanguage(p.language);
    });
  }, []);

  function chooseGender(g: AssistantGender) {
    setGender(g);
    // Swap to the default name when the user hasn't set a custom one.
    if (name === DEFAULT_NAME.female || name === DEFAULT_NAME.male || !name.trim()) {
      setName(DEFAULT_NAME[g]);
    }
  }

  async function save() {
    setSaving(true);
    const prefs = { gender, name: name.trim() || DEFAULT_NAME[gender], language };
    await saveAssistantPrefs(prefs);
    await setAssistantVoice(prefs.gender, prefs.language);
    setSaving(false);
    navigation.goBack();
  }

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <Icon.BackIcon color={colors.text} size={20} />
        </IconButton>
        <Txt variant="title">Voice Assistant</Txt>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <Txt variant="body" color={colors.textDim} style={{ marginBottom: spacing.lg }}>
          Choose how your co-pilot sounds. It speaks with the phone's voice now, and upgrades to a
          natural ElevenLabs voice once a key is added.
        </Txt>

        <Txt variant="small" color={colors.textDim} style={styles.label}>
          Assistant
        </Txt>
        <View style={styles.genderRow}>
          {(['female', 'male'] as AssistantGender[]).map((g) => {
            const active = gender === g;
            return (
              <Pressable key={g} style={{ flex: 1 }} onPress={() => chooseGender(g)}>
                {active ? (
                  <Gradient name={g === 'female' ? 'candy' : 'ocean'} style={styles.genderCard}>
                    <View style={styles.genderIcon}>
                      <Icon.PersonIcon color={colors.onPrimary} size={26} />
                    </View>
                    <Txt variant="bodyStrong" color={colors.onPrimary}>
                      {g === 'female' ? 'Female' : 'Male'}
                    </Txt>
                    <Txt variant="small" color="rgba(255,255,255,0.85)">
                      {DEFAULT_NAME[g]}
                    </Txt>
                  </Gradient>
                ) : (
                  <View style={[styles.genderCard, styles.genderIdle]}>
                    <View style={[styles.genderIcon, styles.genderIconIdle]}>
                      <Icon.PersonIcon color={colors.textDim} size={26} />
                    </View>
                    <Txt variant="bodyStrong">{g === 'female' ? 'Female' : 'Male'}</Txt>
                    <Txt variant="small" color={colors.textDim}>
                      {DEFAULT_NAME[g]}
                    </Txt>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Give your assistant a name"
        />

        <Txt variant="small" color={colors.textDim} style={styles.label}>
          Language
        </Txt>
        <View style={styles.langRow}>
          {(
            [
              ['en-US', 'English'],
              ['ar-SA', 'العربية'],
            ] as [AssistantLanguage, string][]
          ).map(([code, labelText]) => (
            <Pressable
              key={code}
              style={[styles.langChip, language === code && styles.langChipOn]}
              onPress={() => setLanguage(code)}
            >
              <Txt variant="bodyStrong" color={language === code ? colors.onPrimary : colors.text}>
                {labelText}
              </Txt>
            </Pressable>
          ))}
        </View>

        <Button
          title="Preview voice"
          variant="secondary"
          left={<Icon.MicIcon color={colors.primarySoftText} size={18} />}
          onPress={() => void previewVoice(gender, language, SAMPLE[language](name.trim() || DEFAULT_NAME[gender]))}
          style={{ marginTop: spacing.sm }}
        />
        <Button
          title={saving ? 'Saving…' : 'Save assistant'}
          loading={saving}
          onPress={() => void save()}
          style={{ marginTop: spacing.md }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  label: { marginBottom: spacing.sm, marginLeft: 2 },

  genderRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  genderCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 4,
    ...shadow.soft,
  },
  genderIdle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  genderIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  genderIconIdle: { backgroundColor: colors.surfaceAlt },

  langRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  langChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  langChipOn: { backgroundColor: colors.primary },
});
