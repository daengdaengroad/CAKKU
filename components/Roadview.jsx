import React from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { API_BASE_URL } from '../constants/config';
import { COLORS, FONT, RADIUS } from '../constants/theme';

// 좌표를 넘기면 카카오 로드뷰로 업체 외관을 보여준다.
// 웹은 iframe으로 바로 임베드, 네이티브는 버튼으로 인앱 브라우저에서 연다.
export default function Roadview({ lat, lng, name }) {
  if (lat == null || lng == null) return null;

  const url = `${API_BASE_URL}/api/roadview?lat=${lat}&lng=${lng}&name=${encodeURIComponent(name || '')}`;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>로드뷰</Text>
      {Platform.OS === 'web' ? (
        <View style={styles.frameBox}>
          {React.createElement('iframe', {
            src: url,
            title: '로드뷰',
            loading: 'lazy',
            style: { border: 0, width: '100%', height: '100%', display: 'block' },
          })}
        </View>
      ) : (
        <TouchableOpacity style={styles.openBtn} onPress={() => WebBrowser.openBrowserAsync(url)} activeOpacity={0.85}>
          <Text style={styles.openBtnText}>로드뷰로 외관 보기</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.hint}>업체 앞 거리 모습이에요 · 촬영 시점에 따라 실제와 다를 수 있어요</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 22, marginTop: 20 },
  label: { fontFamily: FONT.bodyBold, fontSize: 13, color: COLORS.ink, marginBottom: 10 },
  frameBox: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.viewfinderBg,
  },
  openBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  openBtnText: { fontFamily: FONT.bodyBold, fontSize: 13.5, color: COLORS.ink },
  hint: { fontFamily: FONT.bodyMed, fontSize: 11, color: COLORS.inkMuted, marginTop: 8, lineHeight: 16 },
});
