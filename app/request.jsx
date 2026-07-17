import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { COLORS, FONT, RADIUS } from '../constants/theme';
import { showAlert } from '../utils/alert';

const SERVICE_TYPES = {
  reservation: { title: '정비소 예약 맡기기', placeholder: '원하는 날짜, 정비 내용을 알려주세요.\n예) 3월 25일 오전, 엔진오일 교체' },
  estimate: { title: '견적서 봐주세요', placeholder: '정비소에서 받은 견적 내용을 입력해주세요.\n예) 엔진오일 교체 15만원, 에어필터 5만원' },
  consult: { title: '매니저 상담', placeholder: '궁금한 점이나 상담 내용을 자유롭게 적어주세요.' },
};

export default function RequestScreen() {
  const router = useRouter();
  const { type, prefill } = useLocalSearchParams();
  const service = SERVICE_TYPES[type] || SERVICE_TYPES.consult;
  const [message, setMessage] = useState(prefill || '');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = () => {
    if (!name || !phone || !message) {
      showAlert('입력 오류', '모든 항목을 입력해주세요.');
      return;
    }
    router.push('/complete');
  };

  const handleKakao = () => {
    Linking.openURL('https://open.kakao.com/o/your-link');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{service.title}</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>이름</Text>
        <TextInput
          style={styles.input}
          placeholder="홍길동"
          placeholderTextColor={COLORS.inkMuted}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>연락처</Text>
        <TextInput
          style={styles.input}
          placeholder="010-0000-0000"
          placeholderTextColor={COLORS.inkMuted}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>요청 내용</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder={service.placeholder}
          placeholderTextColor={COLORS.inkMuted}
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />
      </View>

      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
        <Text style={styles.submitBtnText}>요청 보내기</Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>또는</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity style={styles.kakaoBtn} onPress={handleKakao}>
        <Text style={styles.kakaoBtnText}>카카오톡으로 바로 문의</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 22, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  back: { fontFamily: FONT.bodySemi, fontSize: 22, color: COLORS.ink },
  headerTitle: { fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.ink },
  form: { gap: 8 },
  label: { fontFamily: FONT.bodySemi, fontSize: 13, color: COLORS.ink, marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.button,
    padding: 14,
    fontFamily: FONT.bodyMed,
    fontSize: 15,
    color: COLORS.ink,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textarea: { height: 120, paddingTop: 14 },
  submitBtn: {
    backgroundColor: COLORS.dark,
    borderRadius: RADIUS.button,
    padding: 17,
    alignItems: 'center',
    marginTop: 28,
  },
  submitBtnText: { fontFamily: FONT.bodyBold, fontSize: 16, color: COLORS.onDark },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontFamily: FONT.bodyMed, color: COLORS.inkMuted, fontSize: 13 },
  kakaoBtn: {
    backgroundColor: '#FEE500',
    borderRadius: RADIUS.button,
    padding: 17,
    alignItems: 'center',
  },
  kakaoBtnText: { fontFamily: FONT.bodyBold, color: '#1c1c1e', fontSize: 15 },
});
