import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONT, RADIUS } from '../constants/theme';
import { API_BASE_URL } from '../constants/config';

const STATUSES = ['대기', '확정', '완료', '취소'];
const STATUS_COLOR = {
  대기: COLORS.severityMid || '#C9922B',
  확정: COLORS.accent || '#2F7D5B',
  완료: COLORS.inkMuted || '#8b8b8b',
  취소: '#B94A48',
};

const PIN_KEY = 'cakku_admin_pin';

export default function AdminScreen() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [authed, setAuthed] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | error | ready
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (usePin) => {
      const p = usePin ?? pin;
      if (!p) return;
      setStatus('loading');
      try {
        const res = await fetch(`${API_BASE_URL}/api/admin/reservations`, {
          headers: { 'x-admin-pin': p },
        });
        if (res.status === 401) {
          setStatus('idle');
          setAuthed(false);
          await AsyncStorage.removeItem(PIN_KEY);
          return { error: 'PIN이 올바르지 않아요.' };
        }
        if (!res.ok) throw new Error('불러오기 실패');
        const data = await res.json();
        setReservations(data.reservations || []);
        setAuthed(true);
        setStatus('ready');
        await AsyncStorage.setItem(PIN_KEY, p);
        return { ok: true };
      } catch (e) {
        setStatus('error');
        return { error: '목록을 불러오지 못했어요.' };
      }
    },
    [pin]
  );

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(PIN_KEY);
      if (saved) {
        setPin(saved);
        load(saved);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeStatus = async (id, newStatus) => {
    setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
    try {
      await fetch(`${API_BASE_URL}/api/admin/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (e) {
      load();
    }
  };

  if (!authed) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>예약 관리</Text>
        </View>
        <View style={styles.gate}>
          <Text style={styles.gateTitle}>관리자 PIN 입력</Text>
          <Text style={styles.gateSub}>사장님만 접근하는 예약 관리 화면이에요.</Text>
          <TextInput
            style={styles.pinInput}
            placeholder="PIN"
            placeholderTextColor={COLORS.inkMuted}
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            keyboardType="number-pad"
          />
          <TouchableOpacity style={styles.gateBtn} onPress={() => load()} disabled={status === 'loading'}>
            {status === 'loading' ? (
              <ActivityIndicator color={COLORS.onDark} />
            ) : (
              <Text style={styles.gateBtnText}>확인</Text>
            )}
          </TouchableOpacity>
          {status === 'error' ? <Text style={styles.errText}>연결에 실패했어요. 다시 시도해주세요.</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>예약 관리 ({reservations.length})</Text>
      </View>

      {reservations.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>아직 접수된 예약이 없어요.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        >
          {reservations.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardName}>{r.name}</Text>
                <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[r.status] || COLORS.inkMuted) + '22' }]}>
                  <Text style={[styles.badgeText, { color: STATUS_COLOR[r.status] || COLORS.inkMuted }]}>{r.status}</Text>
                </View>
              </View>
              {r.shop_name ? <Text style={styles.cardShop}>🔧 {r.shop_name}</Text> : null}
              <Text style={styles.cardPhone}>{r.phone}</Text>
              <Text style={styles.cardMsg}>{r.message}</Text>
              <Text style={styles.cardDate}>
                {new Date(r.created_at).toLocaleString('ko-KR')}
              </Text>
              <View style={styles.statusRow}>
                {STATUSES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusBtn, r.status === s && styles.statusBtnActive]}
                    onPress={() => changeStatus(r.id, s)}
                  >
                    <Text style={[styles.statusBtnText, r.status === s && styles.statusBtnTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 8 },
  back: { fontFamily: FONT.bodySemi, fontSize: 22, color: COLORS.ink },
  headerTitle: { fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.ink },
  gate: { padding: 24, marginTop: 40, alignItems: 'stretch' },
  gateTitle: { fontFamily: FONT.bodyBold, fontSize: 17, color: COLORS.ink, textAlign: 'center' },
  gateSub: { fontFamily: FONT.bodyMed, fontSize: 12.5, color: COLORS.inkMuted, textAlign: 'center', marginTop: 6, marginBottom: 22 },
  pinInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.button,
    padding: 15,
    fontFamily: FONT.bodyMed,
    fontSize: 16,
    color: COLORS.ink,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlign: 'center',
  },
  gateBtn: { backgroundColor: COLORS.dark, borderRadius: RADIUS.button, padding: 16, alignItems: 'center', marginTop: 14 },
  gateBtnText: { fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.onDark },
  errText: { fontFamily: FONT.bodyMed, fontSize: 12.5, color: '#B94A48', textAlign: 'center', marginTop: 14 },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: FONT.bodyMed, fontSize: 13, color: COLORS.inkMuted },
  list: { padding: 18, paddingBottom: 40, gap: 12 },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    padding: 15,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.ink },
  badge: { borderRadius: RADIUS.pill, paddingVertical: 4, paddingHorizontal: 11 },
  badgeText: { fontFamily: FONT.bodyBold, fontSize: 11.5 },
  cardShop: { fontFamily: FONT.bodySemi, fontSize: 13, color: COLORS.accent, marginTop: 8 },
  cardPhone: { fontFamily: FONT.bodyMed, fontSize: 13, color: COLORS.ink, marginTop: 6 },
  cardMsg: { fontFamily: FONT.bodyMed, fontSize: 13, color: COLORS.inkMuted, marginTop: 6, lineHeight: 19 },
  cardDate: { fontFamily: FONT.bodyMed, fontSize: 11, color: COLORS.inkMuted, marginTop: 8 },
  statusRow: { flexDirection: 'row', gap: 7, marginTop: 12 },
  statusBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.button,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  statusBtnActive: { backgroundColor: COLORS.dark, borderColor: COLORS.dark },
  statusBtnText: { fontFamily: FONT.bodySemi, fontSize: 12, color: COLORS.inkMuted },
  statusBtnTextActive: { color: COLORS.onDark },
});
