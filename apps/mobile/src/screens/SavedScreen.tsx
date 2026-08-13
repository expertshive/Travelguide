import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { deleteSavedPlace, listSavedPlaces, type SavedPlace } from '../lib/map';
import type { TabScreenProps } from '../navigation/types';
import { Button, Icon, Loader, Screen, Txt, colors, radius, shadow, spacing } from '../ui';

type Props = TabScreenProps<'Saved'>;
type IconType = (p: { color?: string; size?: number }) => React.ReactElement;

const META: Record<SavedPlace['label'], { title: string; icon: IconType }> = {
  HOME: { title: 'Home', icon: Icon.HomeIcon },
  WORK: { title: 'Work', icon: Icon.WorkIcon },
  CUSTOM: { title: 'Saved place', icon: Icon.MapPinIcon },
};

export function SavedScreen({ navigation }: Props) {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setPlaces(await listSavedPlaces());
    } catch {
      setPlaces([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const remove = (place: SavedPlace) => {
    Alert.alert('Remove place', `Remove "${place.name}" from saved places?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setPlaces(await deleteSavedPlace(place.id));
          } catch {
            /* keep current list on failure */
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen>
        <Header />
        <Loader label="Loading saved places…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={places}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<Header />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => {
          const meta = META[item.label];
          const MetaIcon = meta.icon;
          return (
            <Pressable
              style={styles.row}
              onPress={() =>
                navigation.navigate('PlaceDetail', {
                  place: {
                    id: item.id,
                    name: item.name,
                    address: item.address,
                    latitude: item.latitude,
                    longitude: item.longitude,
                  },
                })
              }
            >
              <View style={styles.icon}>
                <MetaIcon color={colors.primary} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowTitle}>
                  <Txt variant="bodyStrong" numberOfLines={1}>
                    {item.label === 'CUSTOM' ? item.name : meta.title}
                  </Txt>
                  {item.label !== 'CUSTOM' ? (
                    <View style={styles.tag}>
                      <Txt variant="caption" color={colors.primarySoftText}>
                        {meta.title.toUpperCase()}
                      </Txt>
                    </View>
                  ) : null}
                </View>
                <Txt variant="small" color={colors.textDim} numberOfLines={1}>
                  {item.address}
                </Txt>
              </View>
              <Pressable onPress={() => remove(item)} hitSlop={10} style={styles.delete}>
                <Icon.TrashIcon color={colors.danger} size={18} />
              </Pressable>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon.BookmarkIcon color={colors.textFaint} size={30} />
            </View>
            <Txt variant="title" center>
              Nothing saved yet
            </Txt>
            <Txt variant="body" color={colors.textDim} center style={{ marginTop: 4 }}>
              Save your Home, Work, and favourite spots for one-tap routes.
            </Txt>
            <View style={{ marginTop: spacing.xl, alignSelf: 'stretch' }}>
              <Button
                title="Find a place"
                left={<Icon.SearchIcon color={colors.onPrimary} size={18} />}
                onPress={() => navigation.navigate('Map', {})}
              />
            </View>
          </View>
        }
      />
    </Screen>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Txt variant="h1">Saved</Txt>
      <Txt variant="body" color={colors.textDim} style={{ marginTop: 2 }}>
        Your places, ready to navigate.
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  list: { paddingHorizontal: spacing.xl, paddingBottom: 120, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.soft,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  delete: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingTop: spacing.xxxl, paddingHorizontal: spacing.md },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
});
