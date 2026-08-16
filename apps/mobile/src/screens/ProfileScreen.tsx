import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { loadAssistantPrefs, languageLabel, type AssistantPrefs, DEFAULT_PREFS } from '../lib/assistantPrefs';
import { PLATFORM_LABELS, getMyProfile, resolveMediaUrl } from '../lib/profile';
import type { UserProfile } from '../lib/types';
import type { TabScreenProps } from '../navigation/types';
import {
  Avatar,
  Button,
  Card,
  Gradient,
  Icon,
  Txt,
  colors,
  radius,
  shadow,
  spacing,
} from '../ui';

type Props = TabScreenProps<'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [assistant, setAssistant] = useState<AssistantPrefs>(DEFAULT_PREFS);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getMyProfile()
        .then((p) => active && setProfile(p))
        .catch(() => {});
      void loadAssistantPrefs().then((p) => {
        if (active) setAssistant(p);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  if (!user) return null;

  const avatarUrl = resolveMediaUrl(profile?.avatarUrl);
  const displayName = profile?.displayName || user.name;
  const memberSince = new Date(user.createdAt).getFullYear();

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Gradient name="brand" style={styles.header}>
          <View style={styles.headerTop}>
            <Txt variant="title" color={colors.onPrimary}>
              Profile
            </Txt>
            <Pressable
              style={styles.editBtn}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Icon.EditIcon color={colors.onPrimary} size={16} />
              <Txt variant="small" color={colors.onPrimary}>
                Edit
              </Txt>
            </Pressable>
          </View>

          <View style={styles.identity}>
            <Avatar uri={avatarUrl} name={displayName} size={84} ring />
            <Txt variant="h2" color={colors.onPrimary} style={{ marginTop: spacing.md }}>
              {displayName}
            </Txt>
            <Txt variant="small" color="rgba(255,255,255,0.85)">
              {user.email}
            </Txt>
            {profile?.location ? (
              <View style={styles.locationRow}>
                <Icon.MapPinIcon color="rgba(255,255,255,0.85)" size={14} />
                <Txt variant="small" color="rgba(255,255,255,0.85)">
                  {profile.location}
                </Txt>
              </View>
            ) : null}
          </View>
        </Gradient>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Stat value={String(profile?.photos.length ?? 0)} label="Photos" />
          <View style={styles.statDivider} />
          <Stat value={String(profile?.socialLinks.length ?? 0)} label="Links" />
          <View style={styles.statDivider} />
          <Stat value={String(memberSince)} label="Since" />
        </View>

        {/* Bio */}
        {profile?.bio ? (
          <Section title="About">
            <Card elevation="soft">
              <Txt variant="body" color={colors.text}>
                {profile.bio}
              </Txt>
            </Card>
          </Section>
        ) : null}

        {/* Website */}
        {profile?.website ? (
          <Section title="Website">
            <Pressable onPress={() => void Linking.openURL(profile.website as string)}>
              <Card elevation="soft" style={styles.linkRow}>
                <View style={styles.linkIcon}>
                  <Icon.GlobeIcon color={colors.primary} size={18} />
                </View>
                <Txt variant="body" color={colors.primary} numberOfLines={1} style={{ flex: 1 }}>
                  {profile.website}
                </Txt>
                <Icon.ChevronRightIcon color={colors.textFaint} size={18} />
              </Card>
            </Pressable>
          </Section>
        ) : null}

        {/* Social links */}
        {profile?.socialLinks.length ? (
          <Section title="Social">
            <Card padded={false} elevation="soft">
              {profile.socialLinks.map((link, i) => (
                <Pressable
                  key={link.id}
                  style={[styles.social, i > 0 && styles.socialBorder]}
                  onPress={() => void Linking.openURL(link.url)}
                >
                  <View style={styles.linkIcon}>
                    <Icon.LinkIcon color={colors.primary} size={16} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">{PLATFORM_LABELS[link.platform] ?? link.platform}</Txt>
                    <Txt variant="small" color={colors.textDim} numberOfLines={1}>
                      {link.url}
                    </Txt>
                  </View>
                  <Icon.ChevronRightIcon color={colors.textFaint} size={18} />
                </Pressable>
              ))}
            </Card>
          </Section>
        ) : null}

        {/* Photos */}
        {profile?.photos.length ? (
          <Section title="Photos">
            <View style={styles.photoGrid}>
              {profile.photos.map((photo) => {
                const url = resolveMediaUrl(photo.url);
                return url ? (
                  <Image key={photo.id} source={{ uri: url }} style={styles.photo} />
                ) : null;
              })}
            </View>
          </Section>
        ) : null}

        {/* Settings */}
        <Section title="Settings">
          <Pressable onPress={() => navigation.navigate('AssistantSettings')}>
            <Card elevation="soft" style={styles.linkRow}>
              <View style={styles.linkIcon}>
                <Icon.SparkleIcon color={colors.primary} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="bodyStrong">Voice agent</Txt>
                <Txt variant="small" color={colors.textDim}>
                  {assistant.name} · {languageLabel(assistant.language)} ·{' '}
                  {assistant.gender === 'female' ? 'Female' : 'Male'}
                </Txt>
              </View>
              <Icon.ChevronRightIcon color={colors.textFaint} size={18} />
            </Card>
          </Pressable>
        </Section>

        {/* Account */}
        <Section title="Account">
          <Card padded={false} elevation="soft">
            <View style={styles.accountRow}>
              <Txt variant="body" color={colors.textDim}>
                Roles
              </Txt>
              <Txt variant="bodyStrong">{user.roles.join(', ') || 'None'}</Txt>
            </View>
            <View style={[styles.accountRow, styles.socialBorder]}>
              <Txt variant="body" color={colors.textDim}>
                Mobile
              </Txt>
              <Txt variant="bodyStrong">{user.mobile}</Txt>
            </View>
          </Card>

          <View style={{ marginTop: spacing.lg }}>
            <Button
              title="Sign out"
              variant="danger"
              left={<Icon.LogoutIcon color={colors.danger} size={18} />}
              onPress={() => void logout()}
            />
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Txt variant="h3" style={{ marginBottom: spacing.md }}>
        {title}
      </Txt>
      {children}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Txt variant="h3">{value}</Txt>
      <Txt variant="caption" color={colors.textFaint}>
        {label.toUpperCase()}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 120 },

  header: {
    paddingTop: spacing.xxxl + spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl + spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  identity: { alignItems: 'center', marginTop: spacing.lg },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    marginTop: -spacing.xxl,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    ...shadow.card,
  },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border },

  section: { paddingHorizontal: spacing.xl, marginTop: spacing.xxl },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  social: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  socialBorder: { borderTopWidth: 1, borderTopColor: colors.border },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photo: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },

  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
