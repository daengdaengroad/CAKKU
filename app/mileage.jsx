import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MileageScreen() {
  const router = useRouter();
  const [car, setCar] = useState(null);
  const [newMileage, setNewMileage] = useState('');

  useEffect(() => {
    loadCar();
  }, []);

  const loadCar = async () => {
    const data = await AsyncStorage.getItem('myCar');
    if (data) setCar(JSON.parse(data));
  };

  const handleUpdate = async () => {
    if (!newMileage) {
      Alert.alert('입력 오류', '숫자를 입력해주세요.');
      return;
    }
    const updated = {
      ...car,
      mileage: parseInt(newMileage),
      lastUpdated: new Date().toISOString(),
    };
    await AsyncStorage.setItem('myCar', JSON.stringify(updated));
    Alert.alert('업데이트 완료! ✅', '소모품 현황이 새로 계산됐어요.', [
      { text: '확인', onPress: () => router.back() },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📍 주행거리 업데이트</Text>
      <Text style={styles.desc}>계기판의 현재 주행거리를 입력해주세요</Text>

      {car && (
        <View style={styles.currentBox}>
          <Text style={styles.currentLabel}>현재 등록된 주행거리</Text>
          <Text style={styles.currentValue}>{car.mileage?.toLocaleString()} km</Text>
        </View>
      )}

      <Text style={styles.label}>새 주행거리 (km)</Text>
      <TextInput
        style={styles.input}
        placeholder="예) 115000"
        placeholderTextColor="#555"
        value={newMileage}
        onChangeText={setNewMileage}
      />

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>💡 한 달에 한 번 업데이트하면</Text>
        <Text style={styles.infoText}>   소모품 교체 시기를 정확하게 알 수 있어요</Text>
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate}>
        <Text style={styles.saveBtnText}>업데이트하기</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={styles.cancelBtnText}>취소</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0C10', padding: 24, paddingTop: 40 },
  title: { fontSize: 24, fontWeight: '900', color: '#FFF', marginBottom: 8 },
  desc: { fontSize: 14, color: '#888', marginBottom: 28 },
  currentBox: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FF475730',
  },
  currentLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  currentValue: { fontSize: 24, fontWeight: '900', color: '#FF4757' },
  label: { fontSize: 14, color: '#CCC', fontWeight: '600', marginBottom: 10 },
  input: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 16,
  },
  infoBox: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 28,
  },
  infoText: { color: '#888', fontSize: 13, lineHeight: 22 },
  saveBtn: {
    backgroundColor: '#FF4757',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  cancelBtn: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#888', fontSize: 15 },
});
