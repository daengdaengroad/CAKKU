import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { COLORS, FONT, RADIUS } from '../constants/theme';
import { API_BASE_URL } from '../constants/config';
import { showAlert } from '../utils/alert';

const SERVICE_TYPES = {
  reservation: { title: '정비소 예약 맡기기', placeholder: '원하는 날짜, 정비 내용을 알려주세요.\n예) 3월 25일 오전, 엔진오일 교체' },
  estimate: { title: '견적서 봐주세요', placeholder: '정비소에서 받은 견적 내용을 입력해주세요.\n예) 엔진오일 교체 15만원, 에어필터 5만원' },
  consult: { title: '매니저 상담', placeholder: '궁금한 점이나 상담 내용을 자유롭게 적어주세요.' },
};

export default function RequestScreen() {
  const router = useRouter();
  const { type, prefill, shopName } = useLocalSearchParams();
  const service = SERVICE_TYPES[type] || SERVICE_TYPES.consult;
  const [message, setMessage] = useState(prefill || '');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name || !phone || !message) {
      showAlert('입력 오류', '모든 항목을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/reservation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, message, type: type || 'consult', shopName: shopName || '' }),
      });
      if (!res.ok) throw new Error('접수 실패');
      router.push('/complete');
    } catch (e) {
      showAlert('전송 실패', '예약 접수에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
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

      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={COLORS.onDark} />
        ) : (
          <Text style={styles.submitBtnText}>요청 보내기</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.notice}>
        접수하시면 카꾸 담당자가 확인 후 연락드려요.
      </Text>
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
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontFamily: FONT.bodyBold, fontSize: 16, color: COLORS.onDark },
  notice: {
    fontFamily: FONT.bodyMed,
    fontSize: 12,
    color: COLORS.inkMuted,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});
