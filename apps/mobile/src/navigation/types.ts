import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
};

/** A place that can be opened in the detail / route-preview screen. */
export type PlaceParam = {
  id?: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type TabParamList = {
  Home: undefined;
  Map: { query?: string; destination?: PlaceParam } | undefined;
  Saved: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  PlaceDetail: { place: PlaceParam };
  EditProfile: undefined;
  AssistantSettings: undefined;
};

/** A tab screen can also reach the parent stack (PlaceDetail, EditProfile). */
export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<AppStackParamList>
>;

export type AppScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<
  AppStackParamList,
  T
>;

export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;
