import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CAR_BRANDS } from '../constants/carData';
import { COLORS, FONT, RADIUS } from '../constants/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const [mode, setMode] = useState('manual');
  const [carNumber, setCarNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [mileage, setMileage] = useState('');

  const handleSave = async () => {
    if (!brand || !model || !year || !mileage) {
      Alert.alert('입력 오류', '모든 항목을 입력해주세요.');
      return;
    }
    const car = { brand, model, year, mileage: parseInt(mileage), carNumber };
    await AsyncStorage.setItem('myCar', JSON.stringify(car));
    Alert.alert('등록 완료', '내 차가 등록됐어요!', [
      { text: '확인', onPress: () => router.back() },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>내 차 등록</Text>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, mode === 'manual' && styles.tabActive]}
          onPress={() => setMode('manual')}
        >
          <Text style={[styles.tabText, mode === 'manual' && styles.tabTextActive]}>직접 입력</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, styles.tabDisabled]}
          onPress={() => Alert.alert('준비 중', '차량번호 자동 조회 기능은 곧 업데이트 예정이에요.')}
        >
          <Text style={styles.tabTextDisabled}>번호 조회 (준비 중)</Text>
        </TouchableOpacity>
      </View>

      <View>
        <Text style={styles.label}>차량번호 (선택)</Text>
        <TextInput
          style={styles.input}
          placeholder="예) 12가 3456"
          placeholderTextColor={COLORS.inkMuted}
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
          placeholderTextColor={COLORS.inkMuted}
          value={model}
          onChangeText={setModel}
        />

        <Text style={styles.label}>연식</Text>
        <TextInput
          style={styles.input}
          placeholder="예) 2021"
          placeholderTextColor={COLORS.inkMuted}
          value={year}
          onChangeText={setYear}
          keyboardType="numeric"
          maxLength={4}
        />

        <Text style={styles.label}>현재 주행거리 (km)</Text>
        <TextInput
          style={styles.input}
          placeholder="예) 45000"
          placeholderTextColor={COLORS.inkMuted}
          value={mileage}
          onChangeText={setMileage}
          keyboardType="numeric"
        />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>등록하기</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 22, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  back: { fontFamily: FONT.bodySemi, fontSize: 22, color: COLORS.ink },
  headerTitle: { fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.ink },
  tabRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.button,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.dark, borderColor: COLORS.dark },
  tabDisabled: { backgroundColor: COLORS.bg, borderColor: COLORS.border },
  tabText: { fontFamily: FONT.bodySemi, color: COLORS.inkMuted, fontSize: 14 },
  tabTextActive: { color: COLORS.onDark },
  tabTextDisabled: { fontFamily: FONT.bodySemi, color: COLORS.inkMuted, fontSize: 13 },
  label: { fontFamily: FONT.bodySemi, fontSize: 13, color: COLORS.ink, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.button,
    padding: 14,
    fontFamily: FONT.bodyMed,
    fontSize: 15,
    color: COLORS.ink,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  brandGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  brandBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  brandBtnActive: { backgroundColor: COLORS.dark, borderColor: COLORS.dark },
  brandBtnText: { fontFamily: FONT.bodyMed, color: COLORS.inkMuted, fontSize: 13 },
  brandBtnTextActive: { fontFamily: FONT.bodyBold, color: COLORS.onDark },
  saveBtn: {
    backgroundColor: COLORS.dark,
    borderRadius: RADIUS.button,
    padding: 17,
    alignItems: 'center',
    marginTop: 28,
  },
  saveBtnText: { fontFamily: FONT.bodyBold, fontSize: 16, color: COLORS.onDark },
});
