import { Keyboard, TouchableWithoutFeedback, View } from 'react-native';

// Wrap a screen's content so tapping anywhere outside a focused input
// dismisses the keyboard - decimal-pad/number-pad keyboards on iOS have no
// built-in dismiss key, so this (plus DoneAccessory) is the primary way out.
// TouchableWithoutFeedback requires a single real element child (it injects
// responder props into it), so the wrapper must be a plain View, not a
// Fragment, and must grow to fill the screen or later flex/ScrollView
// layout below it collapses to zero height.
export default function DismissKeyboardView({ children }: { children: React.ReactNode }) {
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ flex: 1 }}>{children}</View>
    </TouchableWithoutFeedback>
  );
}
