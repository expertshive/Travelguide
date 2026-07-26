import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  Card,
  Divider,
  Layout,
  Text,
  TopNavigation,
  TopNavigationAction,
} from '@ui-kitten/components';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../lib/auth';
import type { AppStackParamList } from '../navigation/types';
import { accessory, LogoutIcon, PersonIcon } from '../ui/icons';

type Props = NativeStackScreenProps<AppStackParamList, 'Home'>;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text category="c1" appearance="hint" style={styles.rowLabel}>
        {label.toUpperCase()}
      </Text>
      <Text category="s1">{children}</Text>
    </View>
  );
}

export function HomeScreen({ navigation }: Props) {
  const { user, logout } = useAuth();

  if (!user) return null;

  const initial = (user.name || user.email).charAt(0).toUpperCase();

  return (
    <Layout style={styles.root} level="2">
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <TopNavigation
          alignment="center"
          title="Traveler Guide"
          accessoryRight={() => (
            <TopNavigationAction
              icon={accessory(LogoutIcon, { size: 22 })}
              onPress={() => void logout()}
            />
          )}
        />
        <Divider />

        <ScrollView contentContainerStyle={styles.scroll}>
          <Card style={styles.hero} disabled>
            <View style={styles.heroRow}>
              <View style={styles.avatarFallback}>
                <Text category="h5" status="control">
                  {initial}
                </Text>
              </View>
              <View style={styles.heroText}>
                <Text category="h6">{user.name}</Text>
                <Text appearance="hint" category="p2">
                  {user.email}
                </Text>
              </View>
            </View>

            <Button
              style={styles.heroButton}
              accessoryLeft={accessory(PersonIcon, { size: 20, color: '#fff' })}
              onPress={() => navigation.navigate('Profile')}
            >
              My profile
            </Button>
          </Card>

          <Card style={styles.card} disabled>
            <Text category="s1" style={styles.cardTitle}>
              Account
            </Text>
            <Row label="Roles">{user.roles.length ? user.roles.join(', ') : 'None'}</Row>
            <Row label="Permissions">
              {user.permissions.length ? user.permissions.join(', ') : 'None'}
            </Row>
            <Row label="API">{API_BASE}</Row>
          </Card>

          <Button
            appearance="outline"
            status="basic"
            style={styles.signOut}
            onPress={() => void logout()}
          >
            Sign out
          </Button>
        </ScrollView>
      </SafeAreaView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  hero: {
    borderRadius: 20,
    borderWidth: 0,
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7551FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    marginLeft: 14,
    flex: 1,
  },
  heroButton: {
    marginTop: 18,
    borderRadius: 14,
  },
  card: {
    borderRadius: 20,
    borderWidth: 0,
    marginBottom: 16,
  },
  cardTitle: {
    marginBottom: 6,
  },
  row: {
    marginTop: 12,
  },
  rowLabel: {
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  signOut: {
    borderRadius: 14,
  },
});
