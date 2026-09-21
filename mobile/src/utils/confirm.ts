import { Alert, Platform } from 'react-native';

// React Native Web stubs Alert.alert as a no-op, so fall back to window.confirm on web.
// Native platforms use the real native confirmation dialog.
export function confirmDestructive(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

// Same shape as confirmDestructive, but without the red "destructive"
// button style - for confirmations where nothing is being lost (e.g.
// releasing Set Aside money just un-earmarks it, the money was never gone).
export function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, onPress: onConfirm },
  ]);
}
