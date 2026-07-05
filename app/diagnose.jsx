import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Image, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { runDiagnosis } from '../constants/diagnosisService';

export default function DiagnoseScreen() {
  const router = useRouter();
  const [photo, setPhoto] = useState(null);
  const [symptomText, setSymptomText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const pickFrom = async (source) => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('권한 필요', '사진 접근 권한을 허용해주세요.');
      return;
    }

    const options = { mediaTypes: ['images'], quality: 0.5, base64: true };
    const picked =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (picked.canceled || !picked.assets?.[0]) return;

    const asset = picked.assets[0];
    setResult(null);
    setPhoto(asset);
    await analyze(asset);
  };

  const analyze = async (asset) => {
    try {
      setAnalyzing(true);
      const mimeType = asset.mimeType || 'image/jpeg';
      const data = await runDiagnosis(asset.base64, mimeType, symptomText);
      setResult(data);
    } catch (e) {
      Alert.alert('분석 실패', 'AI 진단 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.');
      setPhoto(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setPhoto(null);
    setResult(null);
    setSymptomText('');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>📸 AI 사진 진단</Text>
      <Text style={styles.desc}>차량의 손상이나 증상 사진을 찍으면 AI가 즉시 예상 수리비를 알려드려요</Text>

      {!photo && (
        <>
          <Text style={styles.label}>증상 설명 (선택)</Text>
          <TextInput
            style={styles.input}
            placeholder="예) 운전석 문에서 끼익 소리가 나요"
            placeholderTextColor="#555"
            value={symptomText}
            onChangeText={setSymptomText}
            multiline
          />

          <TouchableOpacity style={styles.actionBtn} onPress={() => pickFrom('camera')}>
            <Text style={styles.actionIcon}>📷</Text>
            <Text style={styles.actionText}>사진 촬영</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => pickFrom('library')}>
            <Text style={styles.actionIcon}>🖼️</Text>
            <Text style={styles.actionText}>갤러리에서 선택</Text>
          </TouchableOpacity>
        </>
      )}

      {photo && (
        <View style={styles.previewBox}>
          <Image source={{ uri: photo.uri }} style={styles.previewImage} />

          {analyzing && (
            <View style={styles.analyzingBox}>
              <ActivityIndicator color="#FF4757" size="large" />
              <Text style={styles.analyzingText}>AI가 분석 중이에요...</Text>
            </View>
          )}

          {result && (
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>예상 문제</Text>
              <Text style={styles.resultIssue}>{result.issue}</Text>

              <Text style={styles.resultLabel}>예상 수리비</Text>
              <Text style={styles.resultCost}>
                {result.costMin?.toLocaleString()}원 ~ {result.costMax?.toLocaleString()}원
              </Text>

              <Text style={styles.resultNote}>{result.note}</Text>
              <Text style={styles.disclaimer}>
                * AI 추정치이며 실제 수리비는 정비소 확인이 필요해요
              </Text>

              <TouchableOpacity style={styles.retryBtn} onPress={reset}>
                <Text style={styles.retryBtnText}>다시 진단하기</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={styles.cancelBtnText}>홈으로</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0C10' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '900', color: '#FFF', marginBottom: 8, marginTop: 10 },
  desc: { fontSize: 14, color: '#888', marginBottom: 24, lineHeight: 20 },
  label: { fontSize: 14, color: '#CCC', fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 20,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actionBtn: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A3E',
  },
  actionIcon: { fontSize: 28, marginRight: 14 },
  actionText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  previewBox: { marginBottom: 20 },
  previewImage: { width: '100%', height: 240, borderRadius: 16, marginBottom: 16 },
  analyzingBox: { alignItems: 'center', padding: 24 },
  analyzingText: { color: '#888', marginTop: 12, fontSize: 14 },
  resultBox: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FF475730',
  },
  resultLabel: { fontSize: 12, color: '#888', fontWeight: '600', marginBottom: 4, marginTop: 12 },
  resultIssue: { fontSize: 17, fontWeight: '800', color: '#FFF' },
  resultCost: { fontSize: 22, fontWeight: '900', color: '#FF4757' },
  resultNote: { fontSize: 13, color: '#CCC', marginTop: 12, lineHeight: 20 },
  disclaimer: { fontSize: 11, color: '#555', marginTop: 12 },
  retryBtn: {
    backgroundColor: '#FF4757',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  retryBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  cancelBtn: { alignItems: 'center', padding: 16, marginTop: 8 },
  cancelBtnText: { color: '#888', fontSize: 14 },
});
