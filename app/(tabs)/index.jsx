import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONT, RADIUS } from '../../constants/theme';

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

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>AI 차량 손상 진단</Text>
        <Text style={styles.heroHeadline}>AI가 몇 초 만에{'\n'}손상을 진단합니다</Text>
        <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/diagnose')}>
          <Text style={styles.ctaBtnText}>사진 촬영하기</Text>
        </TouchableOpacity>
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
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 20 },
  logoDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.accent },
  logoText: { fontFamily: FONT.display, fontSize: 19, color: COLORS.ink, letterSpacing: 0.3 },
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
