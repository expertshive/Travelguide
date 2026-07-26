import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  Card,
  Divider,
  Layout,
  Spinner,
  Text,
  TopNavigation,
  TopNavigationAction,
} from '@ui-kitten/components';
import { useCallback, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getMyProfile, PLATFORM_LABELS, resolveMediaUrl } from '../lib/profile';
import type { UserProfile } from '../lib/types';
import type { AppStackParamList } from '../navigation/types';
import { Banner } from '../ui/Banner';
import { accessory, BackIcon, EditIcon } from '../ui/icons';

type Props = NativeStackScreenProps<AppStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setProfile(await getMyProfile());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const avatarUri = resolveMediaUrl(profile?.avatarUrl);
  const initials = (profile?.displayName || user?.name || user?.email || '?')
    .charAt(0)
    .toUpperCase();

  return (
    <Layout style={styles.root} level="2">
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <TopNavigation
          alignment="center"
          title="My profile"
          accessoryLeft={() => (
            <TopNavigationAction icon={accessory(BackIcon)} onPress={() => navigation.goBack()} />
          )}
          accessoryRight={() => (
            <TopNavigationAction
              icon={accessory(EditIcon)}
              onPress={() => navigation.navigate('EditProfile')}
            />
          )}
        />
        <Divider />

        {loading ? (
          <View style={styles.centered}>
            <Spinner size="large" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            {error ? <Banner tone="danger" message={error} /> : null}

            <Card style={styles.card} disabled>
              <View style={styles.identity}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text category="h4" status="control">
                      {initials}
                    </Text>
                  </View>
                )}
                <Text category="h6" style={styles.name}>
                  {profile?.displayName || user?.name}
                </Text>
                <Text appearance="hint" category="p2">
                  {user?.email}
                </Text>
                {profile?.location ? (
                  <Text appearance="hint" category="p2">
                    {profile.location}
                  </Text>
                ) : null}
              </View>

              <Button
                style={styles.editButton}
                size="small"
                accessoryLeft={accessory(EditIcon, { size: 18, color: '#fff' })}
                onPress={() => navigation.navigate('EditProfile')}
              >
                Edit profile
              </Button>
            </Card>

            <Card style={styles.card} disabled>
              <Text category="s1">Bio</Text>
              <Text style={styles.bio} appearance={profile?.bio ? 'default' : 'hint'}>
                {profile?.bio || 'No bio yet. Tap Edit to add one.'}
              </Text>

              {profile?.website ? (
                <>
                  <Divider style={styles.divider} />
                  <Text category="s1">Website</Text>
                  <Text
                    status="primary"
                    style={styles.link}
                    onPress={() => void Linking.openURL(profile.website!)}
                  >
                    {profile.website}
                  </Text>
                </>
              ) : null}
            </Card>

            <Card style={styles.card} disabled>
              <Text category="s1" style={styles.sectionTitle}>
                Social accounts
              </Text>
              {profile?.socialLinks.length ? (
                profile.socialLinks.map((link) => (
                  <View key={link.id} style={styles.socialRow}>
                    <Text category="label">{PLATFORM_LABELS[link.platform] ?? link.platform}</Text>
                    <Text
                      status="primary"
                      category="p2"
                      numberOfLines={1}
                      style={styles.link}
                      onPress={() => void Linking.openURL(link.url)}
                    >
                      {link.url}
                    </Text>
                  </View>
                ))
              ) : (
                <Text appearance="hint" category="p2">
                  No social accounts linked yet.
                </Text>
              )}
            </Card>

            <Card style={styles.card} disabled>
              <Text category="s1" style={styles.sectionTitle}>
                Photos
              </Text>
              {profile?.photos.length ? (
                <View style={styles.photoGrid}>
                  {profile.photos.map((photo) => (
                    <Image
                      key={photo.id}
                      source={{ uri: resolveMediaUrl(photo.url) ?? '' }}
                      style={styles.photo}
                    />
                  ))}
                </View>
              ) : (
                <Text appearance="hint" category="p2">
                  No photos yet.
                </Text>
              )}
            </Card>
          </ScrollView>
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
    marginBottom: 12,
  },
  avatarFallback: {
    backgroundColor: '#7551FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    marginBottom: 2,
  },
  editButton: {
    marginTop: 18,
    borderRadius: 14,
  },
  bio: {
    marginTop: 6,
    lineHeight: 21,
  },
  divider: {
    marginVertical: 14,
  },
  link: {
    marginTop: 4,
  },
  sectionTitle: {
    marginBottom: 10,
  },
  socialRow: {
    marginBottom: 12,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photo: {
    width: '47%',
    height: 120,
    borderRadius: 14,
    backgroundColor: '#E9EDF7',
  },
});
