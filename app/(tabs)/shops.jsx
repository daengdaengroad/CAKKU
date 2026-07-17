import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import * as Location from 'expo-location';
import ShopListItem from '../../components/ShopListItem';
import { API_BASE_URL } from '../../constants/config';
import { COLORS, FONT, RADIUS } from '../../constants/theme';

export default function ShopsScreen() {
  const [status, setStatus] = useState('loading'); // loading | denied | error | ready
  const [shops, setShops] = useState([]);

  useFocusEffect(
    useCallback(() => {
      loadShops();
    }, [])
  );

  const loadShops = async () => {
    setStatus('loading');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setStatus('denied');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });

      const url = `${API_BASE_URL}/api/shops?lat=${position.coords.latitude}&lng=${position.coords.longitude}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('업체 검색에 실패했어요');

      const result = await response.json();
      setShops(result.shops || []);
      setStatus('ready');
    } catch (err) {
      console.error('업체 검색 실패:', err);
      setStatus('error');
    }
  };

  if (status === 'loading') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>현재 위치 기준 업체를 찾고 있어요...</Text>
      </View>
    );
  }

  if (status === 'denied' || status === 'error') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>
          {status === 'denied' ? '위치 권한이 필요해요' : '업체를 불러오지 못했어요'}
        </Text>
        <Text style={styles.emptySub}>
          {status === 'denied'
            ? '주변 정비소를 찾으려면 위치 접근을 허용해주세요'
            : '잠시 후 다시 시도해주세요'}
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadShops}>
          <Text style={styles.retryBtnText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (shops.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>주변에서 정비소를 찾지 못했어요</Text>
        <Text style={styles.emptySub}>반경을 넓혀 다시 시도해보세요</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadShops}>
          <Text style={styles.retryBtnText}>다시 찾기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>주변 수리업체</Text>
        <Text style={styles.subtitle}>내 현재 위치 기준 · 가까운 순</Text>
      </View>

      <View style={styles.filterRow}>
        <View style={styles.filterChipActive}>
          <Text style={styles.filterChipActiveText}>거리순</Text>
        </View>
      </View>

      <FlatList
        data={shops}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <ShopListItem shop={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 22, paddingTop: 22 },
  title: { fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.ink },
  subtitle: { fontFamily: FONT.bodyMed, fontSize: 11, color: COLORS.inkMuted, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 7, paddingHorizontal: 22, paddingVertical: 14 },
  filterChipActive: {
    backgroundColor: COLORS.dark,
    borderRadius: RADIUS.pill,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  filterChipActiveText: { fontFamily: FONT.bodyBold, fontSize: 11, color: COLORS.onDark },
  list: { paddingHorizontal: 22, paddingBottom: 30 },
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: { fontFamily: FONT.bodyMed, fontSize: 13, color: COLORS.inkMuted, marginTop: 16 },
  emptyText: { fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.ink, marginBottom: 6, textAlign: 'center' },
  emptySub: {
    fontFamily: FONT.bodyMed,
    fontSize: 12.5,
    color: COLORS.inkMuted,
    textAlign: 'center',
    marginBottom: 22,
  },
  retryBtn: {
    backgroundColor: COLORS.dark,
    borderRadius: RADIUS.button,
    paddingVertical: 14,
    paddingHorizontal: 26,
  },
  retryBtnText: { fontFamily: FONT.bodyBold, fontSize: 14, color: COLORS.onDark },
});
