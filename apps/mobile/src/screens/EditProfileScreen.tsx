import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  PLATFORM_LABELS,
  SOCIAL_PLATFORMS,
  addPhoto,
  getMyProfile,
  removeAvatar,
  removePhoto,
  removeSocialLink,
  resolveMediaUrl,
  setSocialLink,
  updateProfile,
  uploadAvatar,
} from '../lib/profile';
import type { UploadableImage, UserProfile } from '../lib/types';
import type { AppScreenProps } from '../navigation/types';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Icon,
  IconButton,
  Field,
  Loader,
  Screen,
  Txt,
  colors,
  radius,
  spacing,
} from '../ui';
import { Banner } from '../ui/Banner';

type Props = AppScreenProps<'EditProfile'>;

const BIO_LIMIT = 500;

async function pickImage(): Promise<UploadableImage | null> {
  const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
  if (result.didCancel) return null;
  if (result.errorMessage) throw new Error(result.errorMessage);
  const asset = result.assets?.[0];
  if (!asset?.uri) return null;
  return { uri: asset.uri, fileName: asset.fileName, type: asset.type };
}

export function EditProfileScreen({ navigation }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [platform, setPlatform] = useState<string>(SOCIAL_PLATFORMS[0]);
  const [socialUrl, setSocialUrl] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');

  const applyProfile = useCallback((next: UserProfile) => {
    setProfile(next);
    setDisplayName(next.displayName ?? '');
    setBio(next.bio ?? '');
    setLocation(next.location ?? '');
    setWebsite(next.website ?? '');
  }, []);

  useEffect(() => {
    getMyProfile()
      .then(applyProfile)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, [applyProfile]);

  async function run(action: () => Promise<UserProfile | null>, successMessage: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await action();
      if (next) {
        applyProfile(next);
        setNotice(successMessage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveDetails() {
    if (bio.length > BIO_LIMIT) {
      setError(`Bio must be ${BIO_LIMIT} characters or fewer.`);
      return;
    }
    if (website && !/^https?:\/\/.+/.test(website)) {
      setError('Website must start with https://');
      return;
    }
    await run(() => updateProfile({ displayName, bio, location, website }), 'Profile updated');
  }

  async function onChangeAvatar() {
    await run(async () => {
      const image = await pickImage();
      return image ? uploadAvatar(image) : null;
    }, 'Profile picture updated');
  }

  async function onAddPhoto() {
    const caption = photoCaption;
    await run(async () => {
      const image = await pickImage();
      if (!image) return null;
      setPhotoCaption('');
      return addPhoto(image, caption);
    }, 'Photo added');
  }

  async function onLinkSocial() {
    if (!/^https?:\/\/.+/.test(socialUrl)) {
      setError('Enter a full URL including https://');
      return;
    }
    await run(async () => {
      const next = await setSocialLink(platform, socialUrl);
      setSocialUrl('');
      return next;
    }, 'Social account linked');
  }

  const avatarUri = resolveMediaUrl(profile?.avatarUrl);

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <Icon.BackIcon color={colors.text} size={20} />
        </IconButton>
        <Txt variant="title">Edit profile</Txt>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <Loader label="Loading profile…" />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {error ? <Banner tone="danger" message={error} /> : null}
            {notice ? <Banner tone="success" message={notice} /> : null}

            {/* Avatar */}
            <Card style={styles.avatarCard} elevation="soft">
              <Avatar uri={avatarUri} name={displayName} size={88} ring />
              <View style={styles.avatarButtons}>
                <Button
                  title={profile?.avatarUrl ? 'Change' : 'Upload'}
                  variant="secondary"
                  size="md"
                  full={false}
                  disabled={busy}
                  left={<Icon.CameraIcon color={colors.primarySoftText} size={18} />}
                  onPress={() => void onChangeAvatar()}
                  style={{ flex: 1 }}
                />
                {profile?.avatarUrl ? (
                  <Button
                    title="Remove"
                    variant="danger"
                    size="md"
                    full={false}
                    disabled={busy}
                    onPress={() => void run(() => removeAvatar(), 'Profile picture removed')}
                    style={{ flex: 1 }}
                  />
                ) : null}
              </View>
            </Card>

            {/* Details */}
            <Card style={styles.card} elevation="soft">
              <Txt variant="title" style={styles.sectionTitle}>
                Details
              </Txt>
              <Field
                label="Display name"
                placeholder="How your name appears"
                value={displayName}
                onChangeText={setDisplayName}
              />
              <Field
                label="Bio"
                placeholder="Tell people about the trips you love."
                multiline
                maxLength={BIO_LIMIT}
                hint={`${bio.length}/${BIO_LIMIT}`}
                value={bio}
                onChangeText={setBio}
                style={styles.bio}
              />
              <Field
                label="Location"
                placeholder="Riyadh, Saudi Arabia"
                value={location}
                onChangeText={setLocation}
              />
              <Field
                label="Website"
                placeholder="https://example.com"
                autoCapitalize="none"
                keyboardType="url"
                value={website}
                onChangeText={setWebsite}
              />
              <Button
                title={busy ? 'Saving…' : 'Save changes'}
                loading={busy}
                onPress={() => void onSaveDetails()}
              />
            </Card>

            {/* Social */}
            <Card style={styles.card} elevation="soft">
              <Txt variant="title" style={styles.sectionTitle}>
                Social accounts
              </Txt>

              {profile?.socialLinks.length ? (
                <View style={{ marginBottom: spacing.lg }}>
                  {profile.socialLinks.map((link) => (
                    <View key={link.id} style={styles.linkRow}>
                      <View style={{ flex: 1 }}>
                        <Txt variant="bodyStrong">
                          {PLATFORM_LABELS[link.platform] ?? link.platform}
                        </Txt>
                        <Txt variant="small" color={colors.textDim} numberOfLines={1}>
                          {link.url}
                        </Txt>
                      </View>
                      <Pressable
                        style={styles.deleteBtn}
                        disabled={busy}
                        onPress={() =>
                          void run(() => removeSocialLink(link.platform), 'Social account removed')
                        }
                      >
                        <Icon.TrashIcon color={colors.danger} size={18} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Txt variant="small" color={colors.textDim} style={{ marginBottom: spacing.lg }}>
                  No social accounts linked yet.
                </Txt>
              )}

              <Txt variant="small" color={colors.textDim} style={styles.pickerLabel}>
                Platform
              </Txt>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                {SOCIAL_PLATFORMS.map((value) => (
                  <Chip
                    key={value}
                    label={PLATFORM_LABELS[value] ?? value}
                    active={platform === value}
                    onPress={() => setPlatform(value)}
                  />
                ))}
              </ScrollView>

              <Field
                label="Profile URL"
                placeholder="https://instagram.com/username"
                autoCapitalize="none"
                keyboardType="url"
                value={socialUrl}
                onChangeText={setSocialUrl}
                style={{ marginTop: spacing.md }}
              />
              <Button
                title="Link account"
                loading={busy}
                left={<Icon.LinkIcon color={colors.onPrimary} size={18} />}
                onPress={() => void onLinkSocial()}
              />
            </Card>

            {/* Photos */}
            <Card style={styles.card} elevation="soft">
              <Txt variant="title" style={styles.sectionTitle}>
                Photos
              </Txt>

              {profile?.photos.length ? (
                <View style={styles.photoGrid}>
                  {profile.photos.map((photo) => {
                    const url = resolveMediaUrl(photo.url);
                    return (
                      <View key={photo.id} style={styles.photoTile}>
                        <Image source={{ uri: url ?? '' }} style={styles.photo} />
                        <Pressable
                          style={styles.photoDelete}
                          disabled={busy}
                          onPress={() => void run(() => removePhoto(photo.id), 'Photo deleted')}
                        >
                          <Icon.TrashIcon color={colors.onPrimary} size={14} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Txt variant="small" color={colors.textDim} style={{ marginBottom: spacing.lg }}>
                  No photos yet.
                </Txt>
              )}

              <Field
                label="Caption"
                placeholder="Optional caption"
                value={photoCaption}
                onChangeText={setPhotoCaption}
              />
              <Button
                title="Add photo"
                loading={busy}
                left={<Icon.CameraIcon color={colors.onPrimary} size={18} />}
                onPress={() => void onAddPhoto()}
              />
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
  scroll: { padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: 40, gap: spacing.lg },

  avatarCard: { alignItems: 'center' },
  avatarButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },

  card: {},
  sectionTitle: { marginBottom: spacing.lg },
  bio: { minHeight: 96, textAlignVertical: 'top', paddingTop: spacing.md },

  pickerLabel: { marginBottom: spacing.sm, marginLeft: 2 },
  chips: { gap: spacing.sm, paddingRight: spacing.sm },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  photoTile: { width: '31.5%', aspectRatio: 1 },
  photo: { width: '100%', height: '100%', borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  photoDelete: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
