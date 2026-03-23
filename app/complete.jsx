import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function CompleteScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.checkIcon}>✅</Text>
      <Text style={styles.title}>요청이 접수됐어요!</Text>
      <Text style={styles.subtitle}>
        담당 매니저가 확인 후{'\n'}빠르게 연락드릴게요
      </Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>📋 처리 순서</Text>
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

      <Text style={styles.timeText}>⏱️ 평균 처리 시간: 2시간 이내</Text>

      <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/')}>
        <Text style={styles.homeBtnText}>홈으로 돌아가기</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C10',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  checkIcon: { fontSize: 72, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '900', color: '#FFF', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 24, marginBottom: 36 },
  infoBox: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 20,
  },
  infoTitle: { fontSize: 15, fontWeight: '700', color: '#FFF', marginBottom: 16 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#333',
    marginLeft: 4,
  },
  stepDotActive: { backgroundColor: '#FF4757' },
  stepLine: { width: 2, height: 16, backgroundColor: '#333', marginLeft: 9 },
  stepText: { fontSize: 14, color: '#FFF', fontWeight: '600' },
  stepTextPending: { color: '#555' },
  timeText: { fontSize: 13, color: '#888', marginBottom: 32 },
  homeBtn: {
    backgroundColor: '#FF4757',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    width: '100%',
  },
  homeBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
});
