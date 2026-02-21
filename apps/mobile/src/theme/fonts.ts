import { useFonts } from 'expo-font';
import {
  Fraunces_700Bold,
  Fraunces_600SemiBold,
  Fraunces_400Regular_Italic,
} from '@expo-google-fonts/fraunces';
import {
  DMSans_600SemiBold,
  DMSans_400Regular,
  DMSans_300Light,
} from '@expo-google-fonts/dm-sans';
import {
  JetBrainsMono_500Medium,
  JetBrainsMono_400Regular,
} from '@expo-google-fonts/jetbrains-mono';

export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Fraunces_700Bold,
    Fraunces_600SemiBold,
    Fraunces_400Regular_Italic,
    DMSans_600SemiBold,
    DMSans_400Regular,
    DMSans_300Light,
    JetBrainsMono_500Medium,
    JetBrainsMono_400Regular,
  });

  if (error) console.error('Font loading error:', error);
  return loaded;
}
