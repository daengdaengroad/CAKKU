import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { CAR_BRANDS } from '../constants/carData';
import { saveCar } from '../constants/carService';

export default function RegisterScreen() {
  const router = useRouter();
  const [mode, setMode] = useState('manual'); // 기본: 직접 입력
  const [carNumber, setCarNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [mileage, setMileage] = useState('');

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!brand || !model || !year || !mileage) {
      Alert.alert('입력 오류', '모든 항목을 입력해주세요.');
      return;
    }
    const car = { brand, model, year, mileage: parseInt(mileage), carNumber };
    try {
      setSaving(true);
      await saveCar(car);
      Alert.alert('등록 완료! 🎉', '내 차가 등록됐어요!', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('오류', '저장에 실패했어요. 인터넷 연결을 확인해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🚗 내 차 등록</Text>

      {/* 모드 선택 탭 */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, mode === 'manual' && styles.tabActive]}
          onPress={() => setMode('manual')}
        >
          <Text style={[styles.tabText, mode === 'manual' && styles.tabTextActive]}>
            ✏️ 직접 입력
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, styles.tabDisabled]}
          onPress={() => Alert.alert('준비 중', '차량번호 자동 조회 기능은 곧 업데이트 예정이에요! 😊')}
        >
          <Text style={styles.tabTextDisabled}>🔍 번호 조회 (준비 중)</Text>
        </TouchableOpacity>
      </View>

      {/* 직접 입력 모드 */}
      <View>
        <Text style={styles.label}>차량번호 (선택)</Text>
        <TextInput
          style={styles.input}
          placeholder="예) 12가 3456"
          placeholderTextColor="#555"
          value={carNumber}
          onChangeText={setCarNumber}
        />

        <Text style={styles.label}>브랜드</Text>
        <View style={styles.brandGrid}>
          {CAR_BRANDS.map((b) => (
            <TouchableOpacity
              key={b}
              style={[styles.brandBtn, brand === b && styles.brandBtnActive]}
              onPress={() => setBrand(b)}
            >
              <Text style={[styles.brandBtnText, brand === b && styles.brandBtnTextActive]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>차종 (모델명)</Text>
        <TextInput
          style={styles.input}
          placeholder="예) 아반떼, 쏘나타, K5"
          placeholderTextColor="#555"
          value={model}
          onChangeText={setModel}
        />

        <Text style={styles.label}>연식</Text>
        <TextInput
          style={styles.input}
          placeholder="예) 2021"
          placeholderTextColor="#555"
          value={year}
          onChangeText={setYear}
          keyboardType="numeric"
          maxLength={4}
        />

        <Text style={styles.label}>현재 주행거리 (km)</Text>
        <TextInput
          style={styles.input}
          placeholder="예) 45000"
          placeholderTextColor="#555"
          value={mileage}
          onChangeText={setMileage}
          keyboardType="numeric"
        />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? '저장 중...' : '등록하기'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0C10' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '900', color: '#FFF', marginBottom: 20, marginTop: 10 },
  tabRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  tabActive: { backgroundColor: '#FF4757', borderColor: '#FF4757' },
  tabDisabled: { backgroundColor: '#111', borderColor: '#222' },
  tabText: { color: '#888', fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: '#FFF' },
  tabTextDisabled: { color: '#444', fontWeight: '600', fontSize: 13 },
  label: { fontSize: 14, color: '#CCC', fontWeight: '600', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  brandGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  brandBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#333',
  },
  brandBtnActive: { backgroundColor: '#FF4757', borderColor: '#FF4757' },
  brandBtnText: { color: '#888', fontSize: 13 },
  brandBtnTextActive: { color: '#FFF', fontWeight: '700' },
  saveBtn: {
    backgroundColor: '#FF4757',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 28,
  },
  saveBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
});
