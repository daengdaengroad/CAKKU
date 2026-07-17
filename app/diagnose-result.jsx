import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DamageCard from '../components/DamageCard';
import ShopListItem from '../components/ShopListItem';

const SEVERITY_COLOR = { 심각: '#FF4757', 보통: '#FFA502', 경미: '#2ED573' };

export default function DiagnoseResultScreen() {
  const router = useRouter();
  const [result, setResult] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadResult();
    }, [])
  );

  const loadResult = async () => {
    try {
      const data = await AsyncStorage.getItem('lastDiagnosis');
      if (data) setResult(JSON.parse(data));
    } catch (e) {}
  };

  if (!result) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>진단 결과가 없어요</Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={() => router.replace('/diagnose')}>
          <Text style={styles.emptyBtnText}>진단 시작하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { diagnosis, shops = [], errors = {} } = result;
  const damages = diagnosis?.damages || [];
  const total = damages.reduce((sum, d) => sum + (Number(d.price) || 0), 0);
  const severityColor = SEVERITY_COLOR[diagnosis?.severity] || '#FF4757';

  const handleReserve = () => {
    const prefill = [
      diagnosis?.summary && `AI 진단: ${diagnosis.summary}`,
      total > 0 && `예상 수리비: 약 ${total.toLocaleString()}원`,
      damages.length > 0 && `손상 부위: ${damages.map((d) => d.name).join(', ')}`,
    ]
      .filter(Boolean)
      .join('\n');
    router.push(`/request?type=reservation&prefill=${encodeURIComponent(prefill)}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🔍 AI 진단 결과</Text>

      {diagnosis ? (
        <>
          <View style={styles.summaryBox}>
            <View style={[styles.severityBadge, { backgroundColor: severityColor + '20' }]}>
              <Text style={[styles.severityText, { color: severityColor }]}>{diagnosis.severity}</Text>
            </View>
            <Text style={styles.summaryText}>{diagnosis.summary}</Text>
            {diagnosis.confidence != null && (
              <Text style={styles.confidenceText}>AI 신뢰도 {diagnosis.confidence}%</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🛠️ 손상 부위 및 예상 비용</Text>
            {damages.map((d, i) => (
              <DamageCard key={i} damage={d} />
            ))}
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>총 예상 수리비</Text>
              <Text style={styles.totalValue}>{total.toLocaleString()}원</Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>AI 진단에 실패했어요: {errors?.diagnosis}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📍 주변 정비소</Text>
        {shops.length > 0 ? (
          shops.map((shop) => <ShopListItem key={shop.id} shop={shop} />)
        ) : (
          <Text style={styles.noShopsText}>
            {errors?.shops ? '주변 정비소를 불러오지 못했어요.' : '주변에서 정비소를 찾지 못했어요.'}
          </Text>
        )}
      </View>

      <TouchableOpacity style={styles.reserveBtn} onPress={handleReserve}>
        <Text style={styles.reserveBtnText}>정비소 예약 맡기기</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/')}>
        <Text style={styles.homeBtnText}>홈으로 돌아가기</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0C10' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '900', color: '#FFF', marginBottom: 20, marginTop: 10 },
  summaryBox: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  severityBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10, marginBottom: 10 },
  severityText: { fontSize: 13, fontWeight: '800' },
  summaryText: { fontSize: 15, color: '#FFF', lineHeight: 22, marginBottom: 8 },
  confidenceText: { fontSize: 12, color: '#888' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 12 },
  totalBox: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF475730',
    marginTop: 4,
  },
  totalLabel: { fontSize: 14, color: '#CCC', fontWeight: '600' },
  totalValue: { fontSize: 20, fontWeight: '900', color: '#FF4757' },
  errorBox: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FF475730',
  },
  errorText: { color: '#FF4757', fontSize: 14 },
  noShopsText: { color: '#888', fontSize: 13 },
  reserveBtn: {
    backgroundColor: '#FF4757',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  reserveBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  homeBtn: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  homeBtnText: { color: '#888', fontSize: 15 },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#0B0C10',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  emptyText: { color: '#888', fontSize: 16, marginBottom: 20 },
  emptyBtn: { backgroundColor: '#FF4757', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  emptyBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});
