import * as eva from '@eva-design/eva';
import { ApplicationProvider } from '@ui-kitten/components';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import theme from './src/theme/theme.json';

export default function App() {
  return (
    <SafeAreaProvider>
      <ApplicationProvider {...eva} theme={{ ...eva.light, ...theme }}>
        <AuthProvider>
          <StatusBar barStyle="dark-content" />
          <AppNavigator />
        </AuthProvider>
      </ApplicationProvider>
    </SafeAreaProvider>
  );
}
