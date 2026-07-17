import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/config';

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
      formData.append('image', {
        uri: asset.uri,
        name: 'damage.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
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
        JSON.stringify({ ...result, timestamp: new Date().toISOString() })
      );
      router.replace('/diagnose-result');
    } catch (err) {
      Alert.alert('진단 실패', err.message || '잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF4757" />
        <Text style={styles.loadingText}>AI가 사진을 분석하고 있어요...</Text>
        <Text style={styles.loadingSub}>주변 정비소도 함께 찾고 있어요</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>📸 사고/손상 AI 진단</Text>
      <Text style={styles.desc}>손상 부위 사진을 찍으면 AI가 수리비용을 추정하고{'\n'}주변 정비소도 찾아드려요</Text>

      {asset ? (
        <View style={styles.previewBox}>
          <Image source={{ uri: asset.uri }} style={styles.preview} />
          <TouchableOpacity style={styles.retakeBtn} onPress={() => setAsset(null)}>
            <Text style={styles.retakeBtnText}>다시 선택</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.pickRow}>
          <TouchableOpacity style={styles.pickBtn} onPress={() => handlePick('camera')}>
            <Text style={styles.pickBtnIcon}>📷</Text>
            <Text style={styles.pickBtnText}>사진 촬영</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pickBtn} onPress={() => handlePick('gallery')}>
            <Text style={styles.pickBtnIcon}>🖼️</Text>
            <Text style={styles.pickBtnText}>갤러리에서 선택</Text>
          </TouchableOpacity>
        </View>
      )}

      {asset && (
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
          <Text style={styles.submitBtnText}>AI 진단 시작</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0C10' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '900', color: '#FFF', marginBottom: 8, marginTop: 10 },
  desc: { fontSize: 14, color: '#888', marginBottom: 28, lineHeight: 20 },
  pickRow: { flexDirection: 'row', gap: 12 },
  pickBtn: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    paddingVertical: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  pickBtnIcon: { fontSize: 32, marginBottom: 10 },
  pickBtnText: { color: '#CCC', fontWeight: '700', fontSize: 14 },
  previewBox: { alignItems: 'center' },
  preview: { width: '100%', height: 280, borderRadius: 16, backgroundColor: '#1A1A2E', marginBottom: 16 },
  retakeBtn: {
    backgroundColor: '#2A2A3E',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retakeBtnText: { color: '#888', fontWeight: '700' },
  submitBtn: {
    backgroundColor: '#FF4757',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 28,
  },
  submitBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B0C10',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  loadingText: { color: '#FFF', fontSize: 16, fontWeight: '700', marginTop: 20 },
  loadingSub: { color: '#888', fontSize: 13, marginTop: 6 },
});
