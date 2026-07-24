import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { API_BASE_URL } from '../constants/config';
import { COLORS, FONT, RADIUS } from '../constants/theme';

const GREETING =
  '안녕하세요! 카꾸 AI 상담 매니저예요. 차량 시트나 실내 손상, 복원 방법, 대략적인 수리 비용 등 궁금한 점을 편하게 물어보세요.';

export default function ChatScreen() {
  const router = useRouter();
  const scrollRef = useRef(null);
  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const scrollToEnd = () => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    scrollToEnd();

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data = await res.json();
      const reply =
        (data.reply || '').trim() || '죄송해요, 답변을 준비하지 못했어요. 다시 시도해주세요.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, shops: data.shops || [] }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '지금 상담 연결이 원활하지 않아요. 잠시 후 다시 시도해주세요.' },
      ]);
    } finally {
      setSending(false);
      scrollToEnd();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>AI 상담 매니저</Text>
          <Text style={styles.headerSub}>카꾸 · 보통 몇 초 안에 답해요</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={scrollToEnd}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((m, i) => {
            const hasShops = m.role === 'assistant' && m.shops?.length > 0;
            return (
              <View
                key={`${i}-${m.role}`}
                style={[styles.bubbleRow, m.role === 'user' ? styles.rowUser : styles.rowAssistant]}
              >
                <View style={styles.msgCol}>
                  <View
                    style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}
                  >
                    <Text
                      style={[
                        styles.bubbleText,
                        m.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant,
                      ]}
                    >
                      {m.content}
                    </Text>
                  </View>

                  {hasShops && (
                    <View style={styles.shopCards}>
                      {m.shops.map((s) => (
                        <TouchableOpacity
                          key={s.id}
                          style={styles.shopCard}
                          activeOpacity={0.8}
                          onPress={() =>
                            router.push({ pathname: '/shop-detail', params: { shop: JSON.stringify(s) } })
                          }
                        >
                          <View style={styles.shopCardBody}>
                            <Text style={styles.shopCardName} numberOfLines={1}>{s.name}</Text>
                            <Text style={styles.shopCardMeta} numberOfLines={1}>
                              {(s.address || '').split(' ').slice(0, 2).join(' ')}
                              {s.phone ? ` · ${s.phone}` : ''}
                            </Text>
                          </View>
                          <Text style={styles.shopCardArrow}>›</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
          {sending && (
            <View style={[styles.bubbleRow, styles.rowAssistant]}>
              <View style={[styles.bubble, styles.bubbleAssistant]}>
                <ActivityIndicator size="small" color={COLORS.inkMuted} />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="메시지를 입력하세요"
            placeholderTextColor={COLORS.inkMuted}
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            <Text style={styles.sendBtnText}>전송</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  back: { fontFamily: FONT.bodySemi, fontSize: 24, color: COLORS.ink },
  headerTitle: { fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.ink },
  headerSub: { fontFamily: FONT.bodyMed, fontSize: 11, color: COLORS.inkMuted, marginTop: 1 },
  messages: { flex: 1 },
  messagesContent: { padding: 18, gap: 10 },
  bubbleRow: { flexDirection: 'row' },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: RADIUS.card, paddingVertical: 11, paddingHorizontal: 14 },
  bubbleUser: { backgroundColor: COLORS.dark, borderBottomRightRadius: 4 },
  bubbleAssistant: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontFamily: FONT.bodyMed, fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: COLORS.onDark },
  bubbleTextAssistant: { color: COLORS.ink },
  msgCol: { maxWidth: '86%' },
  shopCards: { marginTop: 8, gap: 7 },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: RADIUS.card,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  shopCardBody: { flex: 1, marginRight: 10 },
  shopCardName: { fontFamily: FONT.bodyBold, fontSize: 13.5, color: COLORS.ink },
  shopCardMeta: { fontFamily: FONT.bodyMed, fontSize: 11.5, color: COLORS.inkMuted, marginTop: 3 },
  shopCardArrow: { fontFamily: FONT.bodySemi, fontSize: 18, color: COLORS.accent },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: FONT.bodyMed,
    fontSize: 14,
    color: COLORS.ink,
  },
  sendBtn: {
    backgroundColor: COLORS.dark,
    borderRadius: RADIUS.card,
    paddingHorizontal: 18,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { fontFamily: FONT.bodyBold, fontSize: 14, color: COLORS.onDark },
});
