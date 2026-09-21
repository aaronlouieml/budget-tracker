import { Keyboard, Pressable } from 'react-native';

// Wrap a screen's content so tapping anywhere outside a focused input
// dismisses the keyboard - decimal-pad/number-pad keyboards on iOS have no
// built-in dismiss key, so this (plus DoneAccessory) is the primary way out.
// Uses Pressable (not the legacy TouchableWithoutFeedback) since the old
// responder-based Touchable can intermittently race with a ScrollView's own
// gesture recognizer under the New Architecture, making scrolling feel
// unresponsive; Pressable's responder negotiation doesn't have that issue.
export default function DismissKeyboardView({ children }: { children: React.ReactNode }) {
  return (
    <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }} accessible={false}>
      {children}
    </Pressable>
  );
}
