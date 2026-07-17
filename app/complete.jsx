import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, FONT, RADIUS } from '../constants/theme';

export default function CompleteScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle} />
      <Text style={styles.title}>예약이 완료됐어요</Text>
      <Text style={styles.subtitle}>
        담당 매니저가 확인 후{'\n'}빠르게 연락드릴게요
      </Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>처리 순서</Text>
        <View style={styles.step}>
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <Text style={styles.stepText}>요청 접수 완료</Text>
        </View>
        <View style={styles.stepLine} />
        <View style={styles.step}>
          <View style={styles.stepDot} />
          <Text style={[styles.stepText, styles.stepTextPending]}>매니저 검토 중</Text>
        </View>
        <View style={styles.stepLine} />
        <View style={styles.step}>
          <View style={styles.stepDot} />
          <Text style={[styles.stepText, styles.stepTextPending]}>연락 드려요</Text>
        </View>
      </View>

      <Text style={styles.timeText}>평균 처리 시간: 2시간 이내</Text>

      <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/')}>
        <Text style={styles.homeBtnText}>홈으로</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.accent, marginBottom: 18 },
  title: { fontFamily: FONT.display, fontSize: 20, color: COLORS.ink, marginBottom: 10, textAlign: 'center' },
  subtitle: { fontFamily: FONT.bodyMed, fontSize: 13, color: COLORS.inkMuted, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  infoBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.cardLg,
    padding: 20,
    width: '100%',
    marginBottom: 20,
  },
  infoTitle: { fontFamily: FONT.bodyBold, fontSize: 14, color: COLORS.ink, marginBottom: 16 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.border, marginLeft: 4 },
  stepDotActive: { backgroundColor: COLORS.accent },
  stepLine: { width: 2, height: 16, backgroundColor: COLORS.border, marginLeft: 9 },
  stepText: { fontFamily: FONT.bodySemi, fontSize: 13.5, color: COLORS.ink },
  stepTextPending: { color: COLORS.inkMuted },
  timeText: { fontFamily: FONT.bodyMed, fontSize: 12.5, color: COLORS.inkMuted, marginBottom: 32 },
  homeBtn: {
    backgroundColor: COLORS.dark,
    borderRadius: RADIUS.button,
    padding: 13,
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  homeBtnText: { fontFamily: FONT.bodyBold, fontSize: 14, color: COLORS.onDark },
});
