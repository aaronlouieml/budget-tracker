import { InputAccessoryView, Keyboard, Platform, StyleSheet, View } from 'react-native';
import { Button, useTheme } from 'react-native-paper';

// iOS decimal-pad/number-pad keyboards have no built-in dismiss key, unlike
// the alphabetic keyboard's Return key. This adds a "Done" bar above them.
// Pair every numeric TextInput with inputAccessoryViewID={DONE_ACCESSORY_ID}
// and mount one <DoneAccessory /> per screen that uses it.
export const DONE_ACCESSORY_ID = 'doneAccessory';

export default function DoneAccessory() {
  if (Platform.OS !== 'ios') return null;
  const theme = useTheme();

  return (
    <InputAccessoryView nativeID={DONE_ACCESSORY_ID}>
      <View style={[styles.bar, { backgroundColor: theme.colors.elevation.level2, borderTopColor: theme.colors.outlineVariant }]}>
        <Button onPress={Keyboard.dismiss} compact>
          Done
        </Button>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
