import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { loadAssistantPrefs } from './src/lib/assistantPrefs';
import { setAssistantVoice } from './src/lib/tts';
import { AppNavigator } from './src/navigation/AppNavigator';
import { colors } from './src/ui';

export default function App() {
  // Apply the saved assistant voice (gender + language) on launch.
  useEffect(() => {
    void loadAssistantPrefs().then((p) => setAssistantVoice(p.gender, p.language));
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
