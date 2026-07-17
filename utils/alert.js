import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert is a no-op (does nothing at all), so on web
// every confirmation dialog AND every onPress callback chained off it (like
// navigation after saving) silently never fires. This wraps window.alert /
// window.confirm on web and falls back to the native Alert everywhere else.
export function showAlert(title, message, buttons) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = [title, message].filter(Boolean).join('\n\n');

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  const cancelButton = buttons.find((b) => b.style === 'cancel');
  const confirmButton = buttons.find((b) => b !== cancelButton) || buttons[0];

  if (window.confirm(text)) {
    confirmButton?.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
}
