import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DamageCard from '../components/DamageCard';
import { COLORS, FONT, RADIUS } from '../constants/theme';

const SEVERITY_PERCENT = { 경미: 0.3, 보통: 0.6, 심각: 0.9 };

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

  const { diagnosis, errors = {}, photoUri } = result;
  const damages = diagnosis?.damages || [];
  const totalMin = damages.reduce((sum, d) => sum + (Number(d.priceMin) || 0), 0);
  const totalMax = damages.reduce((sum, d) => sum + (Number(d.priceMax) || 0), 0);
  const severityPercent = SEVERITY_PERCENT[diagnosis?.severity] ?? 0.6;

  const handleReserve = () => {
    const prefill = [
      diagnosis?.summary && `AI 진단: ${diagnosis.summary}`,
      totalMax > 0 && `예상 수리비: 약 ${totalMin.toLocaleString()}~${totalMax.toLocaleString()}원`,
      damages.length > 0 && `손상 부위: ${damages.map((d) => d.name).join(', ')}`,
    ]
      .filter(Boolean)
      .join('\n');
    router.push(`/request?type=reservation&prefill=${encodeURIComponent(prefill)}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI 진단 결과</Text>
      </View>

      {diagnosis ? (
        <>
          <View style={styles.thumbRow}>
            {photoUri && <Image source={{ uri: photoUri }} style={styles.thumb} />}
            <View style={styles.completeBadge}>
              <Text style={styles.completeBadgeText}>분석 완료</Text>
            </View>
          </View>

          <View style={styles.resultCard}>
            <View>
              <Text style={styles.fieldLabel}>손상 요약</Text>
              <Text style={styles.fieldValue}>{diagnosis.summary}</Text>
            </View>

            <View>
              <Text style={styles.fieldLabel}>심각도 · {diagnosis.severity}</Text>
              <View style={styles.severityTrack}>
                <View style={[styles.severityFill, { width: `${severityPercent * 100}%` }]} />
              </View>
            </View>

            <View>
              <Text style={styles.fieldLabel}>예상 수리비</Text>
              <Text style={styles.priceValue}>
                {totalMin.toLocaleString()} ~ {totalMax.toLocaleString()}원
              </Text>
            </View>
          </View>

          <Text style={styles.disclaimer}>
            AI가 사진을 보고 추정한 참고용 금액이에요. 실제 정비소 견적과 다를 수 있어요.
          </Text>

          {damages.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>손상 부위 상세</Text>
              {damages.map((d, i) => (
                <DamageCard key={i} damage={d} />
              ))}
            </View>
          )}
        </>
      ) : (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>AI 진단에 실패했어요: {errors?.diagnosis}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/shops')}>
        <Text style={styles.primaryBtnText}>수리업체 찾기</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryBtn} onPress={handleReserve}>
        <Text style={styles.secondaryBtnText}>매니저에게 예약 맡기기</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 22, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  back: { fontFamily: FONT.bodySemi, fontSize: 22, color: COLORS.ink },
  headerTitle: { fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.ink },
  thumbRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  thumb: { width: 60, height: 60, borderRadius: RADIUS.thumb, backgroundColor: COLORS.viewfinderBg },
  completeBadge: { backgroundColor: COLORS.accentSoft, borderRadius: RADIUS.pill, paddingVertical: 5, paddingHorizontal: 10 },
  completeBadgeText: { fontFamily: FONT.bodyBold, fontSize: 11, color: COLORS.accent },
  resultCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.cardLg,
    padding: 20,
    gap: 16,
    marginBottom: 10,
  },
  fieldLabel: { fontFamily: FONT.bodySemi, fontSize: 11, color: COLORS.inkMuted, letterSpacing: 0.5, marginBottom: 6 },
  fieldValue: { fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.ink, lineHeight: 21 },
  severityTrack: { height: 7, borderRadius: 4, backgroundColor: COLORS.border },
  severityFill: { height: '100%', borderRadius: 4, backgroundColor: COLORS.severityMid },
  priceValue: { fontFamily: FONT.display, fontSize: 19, color: COLORS.ink },
  disclaimer: {
    fontFamily: FONT.bodyMed,
    fontSize: 11,
    color: COLORS.inkMuted,
    marginBottom: 24,
    lineHeight: 16,
  },
  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: FONT.bodyBold, fontSize: 14, color: COLORS.ink, marginBottom: 12 },
  errorBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 24,
  },
  errorText: { fontFamily: FONT.bodyMed, color: COLORS.accent, fontSize: 14 },
  primaryBtn: { backgroundColor: COLORS.dark, borderRadius: RADIUS.button, padding: 16, alignItems: 'center', marginBottom: 10 },
  primaryBtnText: { fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.onDark },
  secondaryBtn: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.button, padding: 15, alignItems: 'center' },
  secondaryBtnText: { fontFamily: FONT.bodyBold, fontSize: 14, color: COLORS.inkMuted },
  emptyContainer: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyText: { fontFamily: FONT.bodyMed, color: COLORS.inkMuted, fontSize: 15, marginBottom: 20 },
  emptyBtn: { backgroundColor: COLORS.dark, borderRadius: RADIUS.button, paddingVertical: 14, paddingHorizontal: 28 },
  emptyBtnText: { fontFamily: FONT.bodyBold, color: COLORS.onDark, fontSize: 15 },
});
