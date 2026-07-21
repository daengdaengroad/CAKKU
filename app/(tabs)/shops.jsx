import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import * as Location from 'expo-location';
import ShopListItem from '../../components/ShopListItem';
import { API_BASE_URL } from '../../constants/config';
import { COLORS, FONT, RADIUS } from '../../constants/theme';

export default function ShopsScreen() {
  const [mode, setMode] = useState('nearby'); // 'nearby' | 지역명
  const [regions, setRegions] = useState([]);
  const [shops, setShops] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | denied | error | ready
  const [subtitle, setSubtitle] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadRegions();
      if (mode === 'nearby') loadNearby();
      else loadRegion(mode);
    }, [])
  );

  const loadRegions = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/directory`);
      if (res.ok) {
        const data = await res.json();
        setRegions(data.regions || []);
      }
    } catch (e) {}
  };

  const loadNearby = async () => {
    setMode('nearby');
    setStatus('loading');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setStatus('denied');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const res = await fetch(
        `${API_BASE_URL}/api/shops?lat=${position.coords.latitude}&lng=${position.coords.longitude}`
      );
      if (!res.ok) throw new Error('업체 검색 실패');
      const data = await res.json();
      setShops(data.shops || []);
      setSubtitle(`${data.regionName ? `${data.regionName} 기준` : '내 위치 기준'} · 사진 있는 곳 먼저`);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
    }
  };

  const loadRegion = async (region) => {
    setMode(region);
    setStatus('loading');
    try {
      const res = await fetch(`${API_BASE_URL}/api/directory?region=${encodeURIComponent(region)}`);
      if (!res.ok) throw new Error('지역 업체 조회 실패');
      const data = await res.json();
      setShops(data.shops || []);
      setSubtitle(`${region} 지역 · 사진 있는 곳 먼저`);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
    }
  };

  const renderChips = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipRow}
      contentContainerStyle={styles.chipRowContent}
    >
      <Chip label="내 주변" active={mode === 'nearby'} onPress={loadNearby} />
      {regions.map((r) => (
        <Chip key={r.name} label={r.name} active={mode === r.name} onPress={() => loadRegion(r.name)} />
      ))}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>수리업체</Text>
        <Text style={styles.subtitle}>{subtitle || '지역을 선택하거나 내 주변을 확인하세요'}</Text>
      </View>

      {renderChips()}

      {status === 'loading' ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.centerText}>업체를 불러오고 있어요...</Text>
        </View>
      ) : status === 'denied' ? (
        <View style={styles.centerBox}>
          <Text style={styles.centerTitle}>위치 권한이 필요해요</Text>
          <Text style={styles.centerText}>내 주변 업체를 보려면 위치 접근을 허용하거나, 위에서 지역을 골라주세요</Text>
        </View>
      ) : status === 'error' ? (
        <View style={styles.centerBox}>
          <Text style={styles.centerTitle}>업체를 불러오지 못했어요</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => (mode === 'nearby' ? loadNearby() : loadRegion(mode))}
          >
            <Text style={styles.retryBtnText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : shops.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.centerTitle}>업체를 찾지 못했어요</Text>
          <Text style={styles.centerText}>다른 지역을 선택해보세요</Text>
        </View>
      ) : (
        <FlatList
          data={shops}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <ShopListItem shop={item} />}
        />
      )}
    </View>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 22, paddingTop: 22 },
  title: { fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.ink },
  subtitle: { fontFamily: FONT.bodyMed, fontSize: 11, color: COLORS.inkMuted, marginTop: 2 },
  chipRow: { flexGrow: 0, flexShrink: 0, height: 48, marginTop: 10 },
  chipRowContent: { paddingHorizontal: 22, gap: 7, alignItems: 'center' },
  chip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  chipActive: { backgroundColor: COLORS.dark, borderColor: COLORS.dark },
  chipText: { fontFamily: FONT.bodySemi, fontSize: 12, color: COLORS.inkMuted },
  chipTextActive: { color: COLORS.onDark },
  list: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  centerTitle: { fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.ink, marginBottom: 6, textAlign: 'center' },
  centerText: { fontFamily: FONT.bodyMed, fontSize: 12.5, color: COLORS.inkMuted, textAlign: 'center', lineHeight: 19 },
  retryBtn: { backgroundColor: COLORS.dark, borderRadius: RADIUS.button, paddingVertical: 13, paddingHorizontal: 26, marginTop: 18 },
  retryBtnText: { fontFamily: FONT.bodyBold, fontSize: 14, color: COLORS.onDark },
});
