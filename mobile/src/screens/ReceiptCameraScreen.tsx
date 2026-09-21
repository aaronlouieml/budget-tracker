import { useRef, useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, IconButton, Text } from 'react-native-paper';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { ExpensesStackParamList } from '../navigation/ExpensesNavigator';
import { parseReceipt, type OcrBlock } from '../utils/receiptParser';

type Props = NativeStackScreenProps<ExpensesStackParamList, 'ReceiptCamera'>;

// Runs on-device text recognition (Apple Vision on iOS, Google ML Kit on
// Android via @react-native-ml-kit/text-recognition - fully offline, no
// backend) on the captured photo, then hands the parsed guess to the expense
// form for the user to review and correct before saving. A recognition
// failure of any kind degrades to the same "couldn't read this receipt"
// manual-entry state the app has always had - never crashes, never blocks.
export default function ReceiptCameraScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [photo, setPhoto] = useState<CameraCapturedPicture | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

  async function handleUsePhoto() {
    if (!photo?.uri || !photo?.base64) return;
    const imageBase64 = photo.base64;
    setIsProcessing(true);
    try {
      const result = await TextRecognition.recognize(photo.uri);
      const blocks: OcrBlock[] = result.blocks
        .filter((b) => b.frame)
        .map((b) => ({
          text: b.text,
          frame: { x: b.frame!.left, y: b.frame!.top, width: b.frame!.width, height: b.frame!.height },
        }));
      const parsed = parseReceipt({ text: result.text, blocks });
      navigation.replace('ExpenseForm', {
        scanned: {
          amount: parsed.amount,
          date: parsed.date,
          merchant: parsed.merchant,
          imageBase64,
          ocrFailed: false,
          confidence: parsed.confidence,
        },
      });
    } catch {
      // Recognition itself failed (permissions, corrupt image, ML Kit
      // runtime error) - fall back to the same manual-entry state this
      // screen has always used, rather than blocking the user.
      navigation.replace('ExpenseForm', {
        scanned: {
          amount: null,
          date: null,
          merchant: null,
          imageBase64,
          ocrFailed: true,
          confidence: 'none',
        },
      });
    } finally {
      setIsProcessing(false);
    }
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
          Pocketcakes needs camera access to scan receipts.
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
          <Button mode="outlined" onPress={handleRetake} style={styles.reviewButton} disabled={isProcessing}>
            Retake
          </Button>
          <Button mode="contained" onPress={handleUsePhoto} style={styles.reviewButton} loading={isProcessing} disabled={isProcessing}>
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
