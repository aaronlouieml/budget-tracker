import { useRef, useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, IconButton, Text } from 'react-native-paper';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { ExpensesStackParamList } from '../navigation/ExpensesNavigator';

type Props = NativeStackScreenProps<ExpensesStackParamList, 'ReceiptCamera'>;

// Receipt OCR is not implemented in this local-only version (it required a
// backend to call an OCR provider). The camera still attaches the photo to
// the expense as before - the user just fills in the details manually,
// reusing the existing "couldn't read this receipt" review banner.
export default function ReceiptCameraScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [photo, setPhoto] = useState<CameraCapturedPicture | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  async function handleCapture() {
    if (!cameraRef.current) return;
    setIsCapturing(true);
    try {
      const result = await cameraRef.current.takePictureAsync({ quality: 0.5, base64: true });
      if (result) setPhoto(result);
    } finally {
      setIsCapturing(false);
    }
  }

  function handleRetake() {
    setPhoto(null);
  }

  function handleUsePhoto() {
    if (!photo?.base64) return;
    navigation.replace('ExpenseForm', {
      scanned: {
        amount: null,
        date: null,
        merchant: null,
        imageBase64: photo.base64,
        ocrFailed: true,
      },
    });
  }

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text variant="titleMedium" style={styles.permissionTitle}>
          Camera access needed
        </Text>
        <Text variant="bodyMedium" style={styles.permissionBody}>
          Budget Tracker needs camera access to scan receipts.
        </Text>
        {permission.canAskAgain ? (
          <Button mode="contained" onPress={requestPermission} style={styles.permissionButton}>
            Grant Permission
          </Button>
        ) : (
          <Button mode="contained" onPress={() => Linking.openSettings()} style={styles.permissionButton}>
            Open Settings
          </Button>
        )}
      </View>
    );
  }

  if (photo) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="contain" />
        <View style={styles.reviewActions}>
          <Button mode="outlined" onPress={handleRetake} style={styles.reviewButton}>
            Retake
          </Button>
          <Button mode="contained" onPress={handleUsePhoto} style={styles.reviewButton}>
            Use Photo
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      <View style={styles.captureBar}>
        <IconButton
          icon="camera"
          mode="contained"
          size={36}
          onPress={handleCapture}
          loading={isCapturing}
          disabled={isCapturing}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  preview: {
    flex: 1,
  },
  captureBar: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  reviewActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    padding: 16,
  },
  reviewButton: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionBody: {
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 16,
  },
  permissionButton: {
    marginTop: 4,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 8,
  },
});
