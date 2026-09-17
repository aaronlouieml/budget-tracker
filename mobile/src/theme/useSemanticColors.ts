import { useAppTheme } from './ThemeContext';
import { semanticColors } from './colors';

// The extra color roles MD3 doesn't have a native slot for (there's no
// "warning" role in Material's scheme). Kept out of the Paper theme object
// itself so reading them doesn't require type augmentation - just call this
// alongside Paper's own useTheme() wherever a screen needs the amber
// "upcoming/warning" role (e.g. a due-soon badge).
export function useSemanticColors() {
  const { isDark } = useAppTheme();
  return isDark ? semanticColors.dark : semanticColors.light;
}
