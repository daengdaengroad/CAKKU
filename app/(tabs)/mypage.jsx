import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONSUMABLES } from '../../constants/carData';
import { COLORS, FONT, RADIUS } from '../../constants/theme';
import { showAlert } from '../../utils/alert';

export default function MypageScreen() {
  const router = useRouter();
  const [car, setCar] = useState(null);
  const [records, setRecords] = useState({});
  const [showMileageModal, setShowMileageModal] = useState(false);
  const [newMileage, setNewMileage] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [editKm, setEditKm] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadCar();
      loadRecords();
    }, [])
  );

  const loadCar = async () => {
    try {
      const data = await AsyncStorage.getItem('myCar');
      if (data) setCar(JSON.parse(data));
    } catch (e) {}
  };

  const loadRecords = async () => {
    try {
      const data = await AsyncStorage.getItem('consumableRecords');
      if (data) setRecords(JSON.parse(data));
    } catch (e) {}
  };

  const handleDelete = () => {
    showAlert('차량 삭제', '등록된 차량을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('myCar');
          await AsyncStorage.removeItem('consumableRecords');
          setCar(null);
          setRecords({});
        },
      },
    ]);
  };

  const handleMileageUpdate = async () => {
    if (!newMileage || isNaN(newMileage)) {
      showAlert('입력 오류', '올바른 주행거리를 입력해주세요.');
      return;
    }
    if (parseInt(newMileage) < car.mileage) {
      showAlert('입력 오류', '현재 주행거리보다 작을 수 없어요.');
      return;
    }
    const updated = { ...car, mileage: parseInt(newMileage), lastUpdated: new Date().toISOString() };
    await AsyncStorage.setItem('myCar', JSON.stringify(updated));
    setCar(updated);
    setShowMileageModal(false);
    setNewMileage('');
    showAlert('업데이트 완료', '소모품 현황이 새로 계산됐어요.');
  };

  const openEditItem = (item) => {
    setEditingItem(item);
    setEditKm(String(records[item.name]?.lastReplacedKm ?? ''));
  };

  const handleSaveRecord = async () => {
    if (!editKm || isNaN(editKm)) {
      showAlert('입력 오류', '올바른 키로수를 입력해주세요.');
      return;
    }
    const kmValue = parseInt(editKm);
    if (kmValue > car.mileage) {
      showAlert('입력 오류', '현재 주행거리보다 클 수 없어요.');
      return;
    }
    const updated = { ...records, [editingItem.name]: { lastReplacedKm: kmValue } };
    await AsyncStorage.setItem('consumableRecords', JSON.stringify(updated));
    setRecords(updated);
    setEditingItem(null);
    setEditKm('');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>마이페이지</Text>

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

      {car && (
        <View style={styles.section}>
          <View style={styles.consumableHeader}>
            <Text style={styles.sectionTitle}>소모품 현황</Text>
            <TouchableOpacity onPress={() => setShowMileageModal(true)}>
              <Text style={styles.mileageLink}>주행거리 업데이트</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.consumableHint}>항목을 눌러 교체 시점의 키로수를 수정할 수 있어요</Text>
          <ConsumableList mileage={car.mileage} records={records} onEditItem={openEditItem} />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>구독 플랜</Text>
        <View style={styles.planBox}>
          <Text style={styles.planBadge}>FREE</Text>
          <Text style={styles.planDesc}>현재 무료 플랜 이용 중</Text>
          <TouchableOpacity style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnText}>유료 플랜 업그레이드</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>고객 지원</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/request?type=consult')}>
          <Text style={styles.menuText}>매니저에게 문의</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>이용약관</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>개인정보처리방침</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>CarCare Agency v1.0.0</Text>

      <Modal visible={showMileageModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>주행거리 업데이트</Text>
            <Text style={styles.modalDesc}>현재 계기판의 주행거리를 입력해주세요</Text>
            <Text style={styles.modalCurrent}>현재 등록: {car?.mileage?.toLocaleString()}km</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="새 주행거리 입력 (km)"
              placeholderTextColor={COLORS.inkMuted}
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

      <Modal visible={!!editingItem} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{editingItem?.name} 교체 키로수</Text>
            <Text style={styles.modalDesc}>마지막으로 교체했을 때의 주행거리를 입력해주세요</Text>
            <Text style={styles.modalCurrent}>현재 주행거리: {car?.mileage?.toLocaleString()}km</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="예) 35000"
              placeholderTextColor={COLORS.inkMuted}
              value={editKm}
              onChangeText={setEditKm}
              keyboardType="numeric"
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setEditingItem(null); setEditKm(''); }}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveRecord}>
                <Text style={styles.modalSaveText}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function ConsumableList({ mileage, records, onEditItem }) {
  return (
    <View style={styles.consumableGrid}>
      {CONSUMABLES.filter((item) => item.intervalKm > 0).map((item) => {
        const lastReplacedKm = records[item.name]?.lastReplacedKm;
        const remaining =
          lastReplacedKm != null
            ? item.intervalKm - (mileage - lastReplacedKm)
            : item.intervalKm - (mileage % item.intervalKm);
        const percent = remaining / item.intervalKm;
        const status = remaining <= 0 ? 'overdue' : percent <= 0.2 ? 'urgent' : percent <= 0.4 ? 'warning' : 'ok';
        const statusColor = {
          overdue: '#c14545',
          urgent: '#c14545',
          warning: COLORS.severityMid,
          ok: '#3d7a4f',
        };
        const statusText = { overdue: '즉시 교체', urgent: '곧 교체', warning: '점검 필요', ok: '정상' };

        return (
          <TouchableOpacity key={item.name} style={styles.consumableItem} onPress={() => onEditItem(item)}>
            <Text style={styles.consumableName}>{item.name}</Text>
            <Text style={[styles.consumableRemaining, { color: statusColor[status] }]}>
              {status === 'overdue' ? '즉시 교체 필요' : `${remaining.toLocaleString()}km 남음`}
            </Text>
            <Text style={styles.consumableStatus}>{statusText[status]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 22, paddingBottom: 40 },
  title: { fontFamily: FONT.display, fontSize: 22, color: COLORS.ink, marginBottom: 24, marginTop: 6 },
  section: { marginBottom: 26 },
  sectionTitle: {
    fontFamily: FONT.bodyBold,
    fontSize: 12,
    color: COLORS.inkMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  consumableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 },
  mileageLink: { fontFamily: FONT.bodySemi, fontSize: 11.5, color: COLORS.accent, marginBottom: 12 },
  consumableHint: { fontFamily: FONT.bodyMed, fontSize: 11, color: COLORS.inkMuted, marginBottom: 12 },
  carBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.cardLg,
    padding: 20,
  },
  carName: { fontFamily: FONT.display, fontSize: 19, color: COLORS.ink, marginBottom: 4 },
  carDetail: { fontFamily: FONT.bodyMed, fontSize: 13, color: COLORS.inkMuted, marginBottom: 16 },
  carActions: { flexDirection: 'row', gap: 10 },
  editBtn: { backgroundColor: COLORS.accent, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20 },
  editBtnText: { fontFamily: FONT.bodyBold, color: COLORS.onDark },
  deleteBtn: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20 },
  deleteBtnText: { fontFamily: FONT.bodyBold, color: COLORS.inkMuted },
  emptyBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.cardLg,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderStyle: 'dashed',
  },
  emptyText: { color: COLORS.accent, fontFamily: FONT.bodyBold, fontSize: 15 },
  consumableGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  consumableItem: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    padding: 14,
    width: '47%',
  },
  consumableName: { fontFamily: FONT.bodySemi, fontSize: 12.5, color: COLORS.ink, marginBottom: 6 },
  consumableRemaining: { fontFamily: FONT.bodyBold, fontSize: 12, marginBottom: 2 },
  consumableStatus: { fontFamily: FONT.bodyMed, fontSize: 11, color: COLORS.inkMuted },
  planBox: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.cardLg, padding: 20 },
  planBadge: { fontFamily: FONT.bodyBold, fontSize: 11, color: COLORS.inkMuted, letterSpacing: 1.5, marginBottom: 4 },
  planDesc: { fontFamily: FONT.bodyMed, fontSize: 14, color: COLORS.ink, marginBottom: 14 },
  upgradeBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.button, padding: 12, alignItems: 'center' },
  upgradeBtnText: { fontFamily: FONT.bodyBold, color: COLORS.onDark, fontSize: 13.5 },
  menuItem: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  menuText: { fontFamily: FONT.bodyMed, fontSize: 14, color: COLORS.ink },
  menuArrow: { color: COLORS.inkMuted, fontSize: 18 },
  version: { textAlign: 'center', color: COLORS.inkMuted, fontFamily: FONT.body, fontSize: 11, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(20,20,20,0.4)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 26,
    paddingBottom: 38,
  },
  modalTitle: { fontFamily: FONT.display, fontSize: 19, color: COLORS.ink, marginBottom: 8 },
  modalDesc: { fontFamily: FONT.bodyMed, fontSize: 13, color: COLORS.inkMuted, marginBottom: 8 },
  modalCurrent: { fontFamily: FONT.bodySemi, fontSize: 12.5, color: COLORS.accent, marginBottom: 16 },
  modalInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.button,
    padding: 14,
    fontFamily: FONT.bodySemi,
    fontSize: 15,
    color: COLORS.ink,
    marginBottom: 18,
  },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.button, padding: 15, alignItems: 'center' },
  modalCancelText: { fontFamily: FONT.bodyBold, color: COLORS.inkMuted },
  modalSaveBtn: { flex: 2, backgroundColor: COLORS.dark, borderRadius: RADIUS.button, padding: 15, alignItems: 'center' },
  modalSaveText: { fontFamily: FONT.bodyBold, color: COLORS.onDark, fontSize: 15 },
});
