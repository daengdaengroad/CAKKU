import { View, Text, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../constants/config';
import { COLORS, FONT, RADIUS } from '../../constants/theme';

export default function DiagnoseScreen() {
  const router = useRouter();
  const [asset, setAsset] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePick = async (source) => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('권한 필요', '사진을 사용하려면 권한을 허용해주세요.');
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });

    if (!result.canceled && result.assets?.length) {
      setAsset(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    if (!asset) return;
    setSubmitting(true);
    try {
      const locationPermission = await Location.requestForegroundPermissionsAsync();
      if (!locationPermission.granted) {
        Alert.alert('권한 필요', '주변 정비소를 찾으려면 위치 권한을 허용해주세요.');
        setSubmitting(false);
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });

      let car = '';
      try {
        const carData = await AsyncStorage.getItem('myCar');
        if (carData) {
          const parsed = JSON.parse(carData);
          car = `${parsed.brand || ''} ${parsed.model || ''}`.trim();
        }
      } catch (e) {}

      const formData = new FormData();
      if (Platform.OS === 'web') {
        const blob = await (await fetch(asset.uri)).blob();
        formData.append('image', blob, 'damage.jpg');
      } else {
        formData.append('image', {
          uri: asset.uri,
          name: 'damage.jpg',
          type: asset.mimeType || 'image/jpeg',
        });
      }
      formData.append('lat', String(position.coords.latitude));
      formData.append('lng', String(position.coords.longitude));
      if (car) formData.append('car', car);

      const response = await fetch(`${API_BASE_URL}/api/diagnose`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`서버 오류 (${response.status})`);
      }

      const result = await response.json();

      if (!result.diagnosis) {
        throw new Error(result.errors?.diagnosis || 'AI 진단에 실패했어요.');
      }

      await AsyncStorage.setItem(
        'lastDiagnosis',
        JSON.stringify({
          ...result,
          photoUri: asset.uri,
          timestamp: new Date().toISOString(),
        })
      );
      router.push('/diagnose-result');
      setAsset(null);
    } catch (err) {
      console.error('진단 요청 실패:', err);
      Alert.alert('진단 실패', err.message || '잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>AI가 사진을 분석하고 있어요...</Text>
        <Text style={styles.loadingSub}>주변 정비소도 함께 찾고 있어요</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>손상 부위 촬영</Text>

      <View style={styles.viewfinder}>
        {asset ? (
          <Image source={{ uri: asset.uri }} style={styles.viewfinderImage} />
        ) : (
          <View style={styles.viewfinderPlaceholder}>
            <Text style={styles.viewfinderPlaceholderText}>손상 부위 사진</Text>
          </View>
        )}
        <View style={styles.guideFrame} pointerEvents="none" />
      </View>

      <Text style={styles.guideText}>손상 부위를 프레임 안에 맞춰주세요</Text>

      {asset ? (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.retakeBtn} onPress={() => setAsset(null)}>
            <Text style={styles.retakeBtnText}>다시 촬영</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            <Text style={styles.submitBtnText}>AI 진단 시작</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.tips}>
            <Text style={styles.tip}>· 밝은 곳에서 촬영하세요</Text>
            <Text style={styles.tip}>· 30cm 거리를 유지하세요</Text>
          </View>
          <TouchableOpacity onPress={() => handlePick('gallery')}>
            <Text style={styles.galleryLink}>갤러리에서 선택</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shutterWrap} onPress={() => handlePick('camera')}>
            <View style={styles.shutter} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 22, paddingBottom: 26 },
  title: { fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.ink, marginBottom: 14 },
  viewfinder: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.viewfinderBg,
    position: 'relative',
  },
  viewfinderImage: { width: '100%', height: '100%' },
  viewfinderPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewfinderPlaceholderText: { fontFamily: FONT.bodyMed, fontSize: 13, color: COLORS.inkMuted },
  guideFrame: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    bottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(168,103,47,0.7)',
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  guideText: {
    fontFamily: FONT.bodyMed,
    fontSize: 12,
    color: COLORS.inkMuted,
    textAlign: 'center',
    marginTop: 14,
  },
  tips: { marginTop: 12, gap: 6 },
  tip: { fontFamily: FONT.bodyMed, fontSize: 11.5, color: COLORS.inkMuted },
  galleryLink: {
    fontFamily: FONT.bodySemi,
    fontSize: 12.5,
    color: COLORS.accent,
    textAlign: 'center',
    marginTop: 14,
  },
  shutterWrap: { alignItems: 'center', paddingTop: 18 },
  shutter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accent,
    borderWidth: 5,
    borderColor: COLORS.border,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  retakeBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.button,
    paddingVertical: 15,
    alignItems: 'center',
  },
  retakeBtnText: { fontFamily: FONT.bodyBold, fontSize: 14, color: COLORS.inkMuted },
  submitBtn: {
    flex: 2,
    backgroundColor: COLORS.dark,
    borderRadius: RADIUS.button,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitBtnText: { fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.onDark },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  loadingText: { fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.ink, marginTop: 20 },
  loadingSub: { fontFamily: FONT.bodyMed, fontSize: 12.5, color: COLORS.inkMuted, marginTop: 6 },
});
