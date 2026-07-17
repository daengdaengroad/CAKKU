import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CarCard from '../components/CarCard';
import ServiceButton from '../components/ServiceButton';
import { CONSUMABLES } from '../constants/carData';

export default function HomeScreen() {
  const router = useRouter();
  const [car, setCar] = useState(null);
  const [showMileageModal, setShowMileageModal] = useState(false);
  const [newMileage, setNewMileage] = useState('');

  // 화면 포커스될 때마다 차량 정보 새로 불러오기
  useFocusEffect(
    useCallback(() => {
      loadCar();
    }, [])
  );

  const loadCar = async () => {
    try {
      const data = await AsyncStorage.getItem('myCar');
      if (data) {
        const carData = JSON.parse(data);
        setCar(carData);
        checkMileageUpdate(carData);
      }
    } catch (e) {}
  };

  // 마지막 업데이트로부터 30일 지났으면 알림
  const checkMileageUpdate = (carData) => {
    if (!carData.lastUpdated) return;
    const lastUpdated = new Date(carData.lastUpdated);
    const now = new Date();
    const diffDays = Math.floor((now - lastUpdated) / (1000 * 60 * 60 * 24));
    if (diffDays >= 30) {
      Alert.alert(
        '🚗 주행거리 업데이트',
        `마지막 업데이트로부터 ${diffDays}일이 지났어요!\n현재 주행거리를 업데이트해주세요.`,
        [
          { text: '나중에', style: 'cancel' },
          { text: '업데이트', onPress: () => setShowMileageModal(true) },
        ]
      );
    }
  };

  // 주행거리 업데이트 저장
  const handleMileageUpdate = async () => {
    if (!newMileage || isNaN(newMileage)) {
      Alert.alert('입력 오류', '올바른 주행거리를 입력해주세요.');
      return;
    }
    if (parseInt(newMileage) < car.mileage) {
      Alert.alert('입력 오류', '현재 주행거리보다 작을 수 없어요.');
      return;
    }
    const updated = { ...car, mileage: parseInt(newMileage), lastUpdated: new Date().toISOString() };
    await AsyncStorage.setItem('myCar', JSON.stringify(updated));
    setCar(updated);
    setShowMileageModal(false);
    setNewMileage('');
    Alert.alert('업데이트 완료! ✅', '소모품 현황이 새로 계산됐어요.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.logo}>🔧 CarCare</Text>
        <Text style={styles.subtitle}>내 차 전담 매니저</Text>
      </View>

      {/* 내 차 카드 */}
      {car ? (
        <CarCard car={car} onPress={() => router.push('/register')} />
      ) : (
        <TouchableOpacity style={styles.registerBanner} onPress={() => router.push('/register')}>
          <Text style={styles.registerBannerIcon}>🚗</Text>
          <Text style={styles.registerBannerText}>내 차를 등록해주세요</Text>
          <Text style={styles.registerBannerSub}>등록하면 소모품 알림을 받을 수 있어요</Text>
        </TouchableOpacity>
      )}

      {/* 주행거리 업데이트 버튼 */}
      {car && (
        <TouchableOpacity style={styles.mileageUpdateBtn} onPress={() => setShowMileageModal(true)}>
          <Text style={styles.mileageUpdateText}>📍 주행거리 업데이트</Text>
          <Text style={styles.mileageUpdateSub}>
            {car.lastUpdated
              ? `마지막 업데이트: ${new Date(car.lastUpdated).toLocaleDateString('ko-KR')}`
              : '한 달에 한 번 업데이트해주세요'}
          </Text>
        </TouchableOpacity>
      )}

      {/* 소모품 현황 */}
      {car && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ 소모품 현황</Text>
          <ConsumableList mileage={car.mileage} />
        </View>
      )}

      {/* 서비스 요청 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🛎️ 에이전시 서비스</Text>
        <ServiceButton
          icon="📸"
          title="사고/손상 AI 진단"
          desc="사진 찍으면 AI가 즉시 진단해드려요"
          onPress={() => router.push('/diagnose')}
        />
        <ServiceButton
          icon="📅"
          title="정비소 예약 맡기기"
          desc="원하는 날짜에 대신 예약해드려요"
          onPress={() => router.push('/request?type=reservation')}
        />
        <ServiceButton
          icon="🧾"
          title="견적서 봐주세요"
          desc="바가지인지 전문가가 확인해드려요"
          onPress={() => router.push('/request?type=estimate')}
        />
        <ServiceButton
          icon="💬"
          title="매니저에게 문의"
          desc="카카오톡으로 바로 연결돼요"
          onPress={() => router.push('/request?type=consult')}
        />
      </View>

      {/* 마이페이지 */}
      <TouchableOpacity style={styles.mypage} onPress={() => router.push('/mypage')}>
        <Text style={styles.mypageText}>👤 마이페이지</Text>
      </TouchableOpacity>

      {/* 주행거리 업데이트 모달 */}
      <Modal visible={showMileageModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>📍 주행거리 업데이트</Text>
            <Text style={styles.modalDesc}>현재 계기판의 주행거리를 입력해주세요</Text>
            <Text style={styles.modalCurrent}>현재 등록: {car?.mileage?.toLocaleString()}km</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="새 주행거리 입력 (km)"
              placeholderTextColor="#555"
              value={newMileage}
              onChangeText={setNewMileage}
              keyboardType="numeric"
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setShowMileageModal(false); setNewMileage(''); }}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleMileageUpdate}>
                <Text style={styles.modalSaveText}>업데이트</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function ConsumableList({ mileage }) {
  return (
    <View style={styles.consumableGrid}>
      {CONSUMABLES.filter(item => item.intervalKm > 0).map((item) => {
        const remaining = item.intervalKm - (mileage % item.intervalKm);
        const percent = remaining / item.intervalKm;
        const status = remaining <= 0 ? 'overdue' : percent <= 0.2 ? 'urgent' : percent <= 0.4 ? 'warning' : 'ok';
        const statusColor = { overdue: '#FF4757', urgent: '#FF4757', warning: '#FFA502', ok: '#2ED573' };
        const statusText = { overdue: '🚨 즉시 교체', urgent: '⚠️ 곧 교체', warning: '🟡 점검 필요', ok: '✅ 정상' };

        return (
          <View key={item.name} style={[styles.consumableItem, { borderColor: statusColor[status] + '40' }]}>
            <Text style={styles.consumableIcon}>{item.icon}</Text>
            <Text style={styles.consumableName}>{item.name}</Text>
            <Text style={[styles.consumableRemaining, { color: statusColor[status] }]}>
              {status === 'overdue' ? '즉시 교체 필요' : `${remaining.toLocaleString()}km 남음`}
            </Text>
            <Text style={styles.consumableStatus}>{statusText[status]}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0C10' },
  content: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 24, marginTop: 10 },
  logo: { fontSize: 28, fontWeight: '900', color: '#FF4757' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 2 },
  registerBanner: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF4757',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  registerBannerIcon: { fontSize: 40, marginBottom: 8 },
  registerBannerText: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 4 },
  registerBannerSub: { fontSize: 13, color: '#888' },
  mileageUpdateBtn: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2A2A3E',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mileageUpdateText: { color: '#CCC', fontWeight: '700', fontSize: 14 },
  mileageUpdateSub: { color: '#555', fontSize: 12 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 12 },
  consumableGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  consumableItem: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 14,
    width: '47%',
    alignItems: 'center',
    borderWidth: 1,
  },
  consumableIcon: { fontSize: 24, marginBottom: 6 },
  consumableName: { fontSize: 13, color: '#CCC', marginBottom: 4 },
  consumableRemaining: { fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  consumableStatus: { fontSize: 11, color: '#888' },
  mypage: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  mypageText: { color: '#CCC', fontSize: 15, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000AA',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#FFF', marginBottom: 8 },
  modalDesc: { fontSize: 14, color: '#888', marginBottom: 8 },
  modalCurrent: { fontSize: 13, color: '#FF4757', marginBottom: 16 },
  modalInput: {
    backgroundColor: '#0B0C10',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 20,
  },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#2A2A3E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalCancelText: { color: '#888', fontWeight: '700' },
  modalSaveBtn: {
    flex: 2,
    backgroundColor: '#FF4757',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalSaveText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
