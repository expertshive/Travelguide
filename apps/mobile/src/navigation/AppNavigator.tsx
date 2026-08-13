import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { AssistantSettingsScreen } from '../screens/AssistantSettingsScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MapScreen } from '../screens/MapScreen';
import { PlaceDetailScreen } from '../screens/PlaceDetailScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';
import { SavedScreen } from '../screens/SavedScreen';
import { Loader, colors } from '../ui';
import { TabBar } from './TabBar';
import type { AppStackParamList, AuthStackParamList, TabParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const navTheme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary },
};

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function TabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Saved" component={SavedScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function MainNavigator() {
  return (
    <AppStack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
    >
      <AppStack.Screen name="Tabs" component={TabsNavigator} />
      <AppStack.Screen
        name="PlaceDetail"
        component={PlaceDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <AppStack.Screen name="EditProfile" component={EditProfileScreen} />
      <AppStack.Screen name="AssistantSettings" component={AssistantSettingsScreen} />
    </AppStack.Navigator>
  );
}

export function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Loader label="Loading…" />
      </View>
    );
  }

  return (
    <NavigationContainer key={user ? 'app' : 'auth'} theme={navTheme}>
      {user ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
