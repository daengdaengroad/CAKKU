import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MypageScreen() {
  const router = useRouter();
  const [car, setCar] = useState(null);

  useEffect(() => {
    loadCar();
  }, []);

  const loadCar = async () => {
    try {
      const data = await AsyncStorage.getItem('myCar');
      if (data) setCar(JSON.parse(data));
    } catch (e) {}
  };

  const handleDelete = () => {
    Alert.alert('차량 삭제', '등록된 차량을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('myCar');
          setCar(null);
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>👤 마이페이지</Text>

      {/* 내 차 정보 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>내 차 정보</Text>
        {car ? (
          <View style={styles.carBox}>
            <Text style={styles.carName}>{car.brand} {car.model}</Text>
            <Text style={styles.carDetail}>{car.year}년식 · {car.mileage?.toLocaleString()}km</Text>
            <View style={styles.carActions}>
              <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/register')}>
                <Text style={styles.editBtnText}>수정</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Text style={styles.deleteBtnText}>삭제</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.emptyBox} onPress={() => router.push('/register')}>
            <Text style={styles.emptyText}>+ 차량 등록하기</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 구독 플랜 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>구독 플랜</Text>
        <View style={styles.planBox}>
          <Text style={styles.planBadge}>FREE</Text>
          <Text style={styles.planDesc}>현재 무료 플랜 이용 중</Text>
          <TouchableOpacity style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnText}>⭐ 유료 플랜 업그레이드</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 메뉴 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>고객 지원</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/request?type=consult')}>
          <Text style={styles.menuText}>💬 매니저에게 문의</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>📋 이용약관</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>🔒 개인정보처리방침</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>CarCare Agency v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0C10' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '900', color: '#FFF', marginBottom: 28, marginTop: 10 },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  carBox: { backgroundColor: '#1A1A2E', borderRadius: 16, padding: 20 },
  carName: { fontSize: 20, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  carDetail: { fontSize: 14, color: '#888', marginBottom: 16 },
  carActions: { flexDirection: 'row', gap: 10 },
  editBtn: { backgroundColor: '#FF4757', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20 },
  editBtnText: { color: '#FFF', fontWeight: '700' },
  deleteBtn: { backgroundColor: '#2A2A3E', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20 },
  deleteBtnText: { color: '#888', fontWeight: '700' },
  emptyBox: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  emptyText: { color: '#FF4757', fontSize: 15, fontWeight: '700' },
  planBox: { backgroundColor: '#1A1A2E', borderRadius: 16, padding: 20 },
  planBadge: { fontSize: 12, color: '#888', fontWeight: '800', letterSpacing: 2, marginBottom: 4 },
  planDesc: { fontSize: 15, color: '#CCC', marginBottom: 14 },
  upgradeBtn: {
    backgroundColor: '#FF4757',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  upgradeBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  menuItem: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  menuText: { color: '#CCC', fontSize: 15 },
  menuArrow: { color: '#555', fontSize: 20 },
  version: { textAlign: 'center', color: '#444', fontSize: 12, marginTop: 8 },
});
