import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  ASSISTANT_LANGUAGES,
  DEFAULT_NAME,
  loadAssistantPrefs,
  saveAssistantPrefs,
  spokenCopy,
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

  const sample = spokenCopy(language).preview(name.trim() || DEFAULT_NAME[gender]);

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <Icon.BackIcon color={colors.text} size={20} />
        </IconButton>
        <Txt variant="title">Agent settings</Txt>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <Txt variant="body" color={colors.textDim} style={{ marginBottom: spacing.lg }}>
          Change the voice agent language, name, and gender. The mic, spoken replies, and trip
          guidance all follow this language after you save.
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
          Agent language
        </Txt>
        <Txt variant="caption" color={colors.textFaint} style={{ marginBottom: spacing.sm }}>
          Listening, replies, and turn-by-turn speech use this language.
        </Txt>
        <View style={styles.langRow}>
          {ASSISTANT_LANGUAGES.map(({ code, label, native }) => {
            const on = language === code;
            return (
              <Pressable
                key={code}
                style={[styles.langChip, on && styles.langChipOn]}
                onPress={() => setLanguage(code)}
              >
                <Txt variant="bodyStrong" color={on ? colors.onPrimary : colors.text}>
                  {native}
                </Txt>
                {native !== label ? (
                  <Txt variant="caption" color={on ? 'rgba(255,255,255,0.85)' : colors.textDim}>
                    {label}
                  </Txt>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Button
          title="Preview voice"
          variant="secondary"
          left={<Icon.MicIcon color={colors.primarySoftText} size={18} />}
          onPress={() => void previewVoice(gender, language, sample)}
          style={{ marginTop: spacing.sm }}
        />
        <Button
          title={saving ? 'Saving…' : 'Save agent settings'}
          loading={saving}
          onPress={() => void save()}
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
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
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxxl },
  label: { marginBottom: spacing.sm, marginLeft: 2, marginTop: spacing.md },

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

  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  langChip: {
    minWidth: '30%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  langChipOn: { backgroundColor: colors.primary },
});
