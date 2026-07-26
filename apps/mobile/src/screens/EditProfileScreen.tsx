import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  Card,
  Divider,
  IndexPath,
  Input,
  Layout,
  Select,
  SelectItem,
  Spinner,
  Text,
  TopNavigation,
  TopNavigationAction,
} from '@ui-kitten/components';
import { useCallback, useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  addPhoto,
  getMyProfile,
  PLATFORM_LABELS,
  removeAvatar,
  removePhoto,
  removeSocialLink,
  resolveMediaUrl,
  setSocialLink,
  SOCIAL_PLATFORMS,
  updateProfile,
  uploadAvatar,
} from '../lib/profile';
import type { UploadableImage, UserProfile } from '../lib/types';
import type { AppStackParamList } from '../navigation/types';
import { Banner } from '../ui/Banner';
import { accessory, BackIcon, CameraIcon, LinkIcon, TrashIcon } from '../ui/icons';

type Props = NativeStackScreenProps<AppStackParamList, 'EditProfile'>;

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
  const [platformIndex, setPlatformIndex] = useState(new IndexPath(0));
  const [socialUrl, setSocialUrl] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');

  const platform = SOCIAL_PLATFORMS[platformIndex.row];

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
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load profile'),
      )
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
    <Layout style={styles.root} level="2">
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <TopNavigation
          alignment="center"
          title="Edit profile"
          accessoryLeft={() => (
            <TopNavigationAction icon={accessory(BackIcon)} onPress={() => navigation.goBack()} />
          )}
        />
        <Divider />

        {loading ? (
          <View style={styles.centered}>
            <Spinner size="large" />
          </View>
        ) : (
          <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
            >
              {error ? <Banner tone="danger" message={error} /> : null}
              {notice ? <Banner tone="success" message={notice} /> : null}

              <Card style={styles.card} disabled>
                <View style={styles.identity}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text category="h4" status="control">
                        {(displayName || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.buttonRow}>
                  <Button
                    style={styles.flexButton}
                    size="small"
                    disabled={busy}
                    accessoryLeft={accessory(CameraIcon, { size: 18, color: '#fff' })}
                    onPress={() => void onChangeAvatar()}
                  >
                    {profile?.avatarUrl ? 'Change' : 'Upload'}
                  </Button>
                  {profile?.avatarUrl ? (
                    <Button
                      style={styles.flexButton}
                      size="small"
                      status="danger"
                      appearance="outline"
                      disabled={busy}
                      onPress={() => void run(() => removeAvatar(), 'Profile picture removed')}
                    >
                      Remove
                    </Button>
                  ) : null}
                </View>
              </Card>

              <Card style={styles.card} disabled>
                <Text category="s1" style={styles.sectionTitle}>
                  Details
                </Text>

                <Input
                  style={styles.field}
                  label="Display name"
                  placeholder="How your name appears"
                  value={displayName}
                  onChangeText={setDisplayName}
                />
                <Input
                  style={styles.field}
                  label="Bio"
                  placeholder="Tell people about yourself and the trips you love."
                  multiline
                  numberOfLines={4}
                  textStyle={styles.bioText}
                  maxLength={BIO_LIMIT}
                  caption={`${bio.length}/${BIO_LIMIT}`}
                  value={bio}
                  onChangeText={setBio}
                />
                <Input
                  style={styles.field}
                  label="Location"
                  placeholder="Riyadh, Saudi Arabia"
                  value={location}
                  onChangeText={setLocation}
                />
                <Input
                  style={styles.field}
                  label="Website"
                  placeholder="https://example.com"
                  autoCapitalize="none"
                  keyboardType="url"
                  value={website}
                  onChangeText={setWebsite}
                />

                <Button
                  style={styles.submit}
                  disabled={busy}
                  onPress={() => void onSaveDetails()}
                >
                  {busy ? 'Saving…' : 'Save changes'}
                </Button>
              </Card>

              <Card style={styles.card} disabled>
                <Text category="s1" style={styles.sectionTitle}>
                  Social accounts
                </Text>

                {profile?.socialLinks.length ? (
                  profile.socialLinks.map((link) => (
                    <View key={link.id} style={styles.listRow}>
                      <View style={styles.listText}>
                        <Text category="label">
                          {PLATFORM_LABELS[link.platform] ?? link.platform}
                        </Text>
                        <Text appearance="hint" category="c1" numberOfLines={1}>
                          {link.url}
                        </Text>
                      </View>
                      <Button
                        size="tiny"
                        status="danger"
                        appearance="ghost"
                        disabled={busy}
                        accessoryLeft={accessory(TrashIcon, { size: 18, color: '#FF3B5C' })}
                        onPress={() =>
                          void run(
                            () => removeSocialLink(link.platform),
                            'Social account removed',
                          )
                        }
                      />
                    </View>
                  ))
                ) : (
                  <Text appearance="hint" category="p2" style={styles.field}>
                    No social accounts linked yet.
                  </Text>
                )}

                <Select
                  style={styles.field}
                  label="Platform"
                  selectedIndex={platformIndex}
                  value={PLATFORM_LABELS[platform] ?? platform}
                  onSelect={(index) => setPlatformIndex(index as IndexPath)}
                >
                  {SOCIAL_PLATFORMS.map((value) => (
                    <SelectItem key={value} title={PLATFORM_LABELS[value] ?? value} />
                  ))}
                </Select>

                <Input
                  style={styles.field}
                  label="Profile URL"
                  placeholder="https://instagram.com/username"
                  autoCapitalize="none"
                  keyboardType="url"
                  value={socialUrl}
                  onChangeText={setSocialUrl}
                />

                <Button
                  style={styles.submit}
                  disabled={busy}
                  accessoryLeft={accessory(LinkIcon, { size: 18, color: '#fff' })}
                  onPress={() => void onLinkSocial()}
                >
                  Link account
                </Button>
              </Card>

              <Card style={styles.card} disabled>
                <Text category="s1" style={styles.sectionTitle}>
                  Photos
                </Text>

                {profile?.photos.length ? (
                  <View style={styles.photoGrid}>
                    {profile.photos.map((photo) => (
                      <View key={photo.id} style={styles.photoTile}>
                        <Image
                          source={{ uri: resolveMediaUrl(photo.url) ?? '' }}
                          style={styles.photo}
                        />
                        <Button
                          size="tiny"
                          status="danger"
                          appearance="ghost"
                          disabled={busy}
                          onPress={() => void run(() => removePhoto(photo.id), 'Photo deleted')}
                        >
                          Delete
                        </Button>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text appearance="hint" category="p2" style={styles.field}>
                    No photos yet.
                  </Text>
                )}

                <Input
                  style={styles.field}
                  label="Caption"
                  placeholder="Optional caption"
                  value={photoCaption}
                  onChangeText={setPhotoCaption}
                />

                <Button
                  style={styles.submit}
                  disabled={busy}
                  accessoryLeft={accessory(CameraIcon, { size: 18, color: '#fff' })}
                  onPress={() => void onAddPhoto()}
                >
                  Add photo
                </Button>
              </Card>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 20,
    borderWidth: 0,
    marginBottom: 16,
  },
  identity: {
    alignItems: 'center',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarFallback: {
    backgroundColor: '#7551FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  flexButton: {
    flex: 1,
    borderRadius: 12,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  field: {
    marginBottom: 14,
  },
  bioText: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  submit: {
    borderRadius: 14,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  listText: {
    flex: 1,
    marginRight: 8,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  photoTile: {
    width: '47%',
  },
  photo: {
    width: '100%',
    height: 110,
    borderRadius: 14,
    backgroundColor: '#E9EDF7',
  },
});
