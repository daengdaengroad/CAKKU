import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

const SERVICE_TYPES = {
  reservation: { title: '정비소 예약 맡기기', icon: '📅', placeholder: '원하는 날짜, 정비 내용을 알려주세요.\n예) 3월 25일 오전, 엔진오일 교체' },
  estimate: { title: '견적서 봐주세요', icon: '🧾', placeholder: '정비소에서 받은 견적 내용을 입력해주세요.\n예) 엔진오일 교체 15만원, 에어필터 5만원' },
  consult: { title: '매니저 상담', icon: '💬', placeholder: '궁금한 점이나 상담 내용을 자유롭게 적어주세요.' },
};

export default function RequestScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams();
  const service = SERVICE_TYPES[type] || SERVICE_TYPES.consult;
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = () => {
    if (!name || !phone || !message) {
      Alert.alert('입력 오류', '모든 항목을 입력해주세요.');
      return;
    }
    // 카카오톡 오픈채팅 또는 전화 연결 (추후 실제 링크로 교체)
    router.push('/complete');
  };

  const handleKakao = () => {
    // 실제 카카오톡 오픈채팅 링크로 교체하세요
    Linking.openURL('https://open.kakao.com/o/your-link');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.icon}>{service.icon}</Text>
      <Text style={styles.title}>{service.title}</Text>

      <View style={styles.form}>
        <Text style={styles.label}>이름</Text>
        <TextInput
          style={styles.input}
          placeholder="홍길동"
          placeholderTextColor="#555"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>연락처</Text>
        <TextInput
          style={styles.input}
          placeholder="010-0000-0000"
          placeholderTextColor="#555"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>요청 내용</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder={service.placeholder}
          placeholderTextColor="#555"
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
        <Text style={styles.kakaoBtnText}>💬 카카오톡으로 바로 문의</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0C10' },
  content: { padding: 20, paddingBottom: 40 },
  icon: { fontSize: 48, marginBottom: 8, marginTop: 10 },
  title: { fontSize: 22, fontWeight: '900', color: '#FFF', marginBottom: 24 },
  form: { gap: 8 },
  label: { fontSize: 14, color: '#CCC', fontWeight: '600', marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  textarea: { height: 120, paddingTop: 14 },
  submitBtn: {
    backgroundColor: '#FF4757',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 28,
  },
  submitBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#333' },
  dividerText: { color: '#555', fontSize: 13 },
  kakaoBtn: {
    backgroundColor: '#FEE500',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  kakaoBtnText: { color: '#1A1A1A', fontSize: 16, fontWeight: '700' },
});
