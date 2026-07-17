import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONT, RADIUS } from '../../constants/theme';

const STEPS = [
  { title: '사진 촬영', desc: '손상 부위를 찍어주세요' },
  { title: 'AI 손상 진단', desc: '손상 종류와 예상 비용을 알려드려요' },
  { title: '정비소 연결', desc: '주변 정비소를 찾아 바로 예약하세요' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [recent, setRecent] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadRecent();
    }, [])
  );

  const loadRecent = async () => {
    try {
      const data = await AsyncStorage.getItem('lastDiagnosis');
      if (data) setRecent(JSON.parse(data));
    } catch (e) {}
  };

  const recentTitle = recent?.diagnosis?.damages?.[0]?.name || recent?.diagnosis?.summary || '진단 결과';
  const recentDate = recent?.timestamp ? new Date(recent.timestamp).toLocaleDateString('ko-KR') : '';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.logoRow}>
        <View style={styles.logoDot} />
        <Text style={styles.logoText}>CarCare</Text>
      </View>
      <Text style={styles.tagline}>내 차 시트 관리, AI로 더 쉽게</Text>

      <View style={styles.introHeader}>
        <Text style={styles.introHeadline}>사진 한 장으로{'\n'}내 차 손상 진단부터 정비소 예약까지</Text>
        <Text style={styles.introSubtext}>AI가 손상을 분석하고 주변 정비소를 바로 연결해드려요</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>AI 시트 손상 진단</Text>
        <Text style={styles.heroHeadline}>AI가 몇 초 만에{'\n'}시트 손상을 진단합니다</Text>
        <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/diagnose')}>
          <Text style={styles.ctaBtnText}>사진 촬영하기</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.howSection}>
        <Text style={styles.sectionTitle}>이렇게 작동해요</Text>
        <View style={styles.howCard}>
          {STEPS.map((step, i) => (
            <View key={step.title}>
              <View style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{i + 1}</Text>
                </View>
                <View style={styles.stepTextArea}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
              </View>
              {i < STEPS.length - 1 && <View style={styles.stepDivider} />}
            </View>
          ))}
        </View>
      </View>

      {recent && (
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>최근 진단</Text>
          <TouchableOpacity style={styles.recentCard} onPress={() => router.push('/diagnose-result')}>
            <Text style={styles.recentTitle}>{recentTitle}</Text>
            <Text style={styles.recentSub}>{recentDate} · 진단 완료</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 22, paddingBottom: 40 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 6 },
  logoDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.accent },
  logoText: { fontFamily: FONT.display, fontSize: 19, color: COLORS.ink, letterSpacing: 0.3 },
  tagline: { fontFamily: FONT.bodyMed, fontSize: 12.5, color: COLORS.inkMuted, marginBottom: 20 },
  introHeader: { marginBottom: 22 },
  introHeadline: {
    fontFamily: FONT.display,
    fontSize: 22,
    lineHeight: 30,
    color: COLORS.ink,
    marginBottom: 8,
  },
  introSubtext: { fontFamily: FONT.bodyMed, fontSize: 13, color: COLORS.inkMuted, lineHeight: 19 },
  hero: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.cardLg,
    padding: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
    marginBottom: 20,
  },
  heroLabel: { fontFamily: FONT.bodyBold, fontSize: 11, color: COLORS.accent, letterSpacing: 1, marginBottom: 12 },
  heroHeadline: { fontFamily: FONT.display, fontSize: 25, lineHeight: 34, color: COLORS.ink, marginBottom: 20 },
  ctaBtn: { backgroundColor: COLORS.dark, borderRadius: RADIUS.button, paddingVertical: 15, alignItems: 'center' },
  ctaBtnText: { fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.onDark },
  howSection: { marginBottom: 20, gap: 12 },
  howCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.cardLg,
    padding: 20,
  },
  stepRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { fontFamily: FONT.bodyBold, fontSize: 12.5, color: COLORS.accent },
  stepTextArea: { flex: 1, paddingTop: 2 },
  stepTitle: { fontFamily: FONT.bodyBold, fontSize: 14, color: COLORS.ink, marginBottom: 3 },
  stepDesc: { fontFamily: FONT.bodyMed, fontSize: 12.5, color: COLORS.inkMuted, lineHeight: 18 },
  stepDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16, marginLeft: 40 },
  recentSection: { gap: 12 },
  sectionTitle: { fontFamily: FONT.bodyBold, fontSize: 14, color: COLORS.ink },
  recentCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    padding: 16,
    gap: 5,
  },
  recentTitle: { fontFamily: FONT.bodySemi, fontSize: 13.5, color: COLORS.ink },
  recentSub: { fontFamily: FONT.bodyMed, fontSize: 11.5, color: COLORS.inkMuted },
});
