import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ShopListItem from '../../components/ShopListItem';
import { COLORS, FONT, RADIUS } from '../../constants/theme';

export default function ShopsScreen() {
  const router = useRouter();
  const [shops, setShops] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadShops();
    }, [])
  );

  const loadShops = async () => {
    try {
      const data = await AsyncStorage.getItem('lastDiagnosis');
      if (data) {
        const parsed = JSON.parse(data);
        setShops(parsed.shops || []);
      } else {
        setShops([]);
      }
    } catch (e) {
      setShops([]);
    }
  };

  if (shops === null) return null;

  if (shops.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>먼저 AI 진단을 진행해주세요</Text>
        <Text style={styles.emptySub}>진단 결과를 바탕으로 주변 정비소를 찾아드려요</Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/diagnose')}>
          <Text style={styles.emptyBtnText}>AI 진단하러 가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>주변 수리업체</Text>
        <Text style={styles.subtitle}>내 위치 기준 · 가까운 순</Text>
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
  emptyContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: { fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.ink, marginBottom: 6, textAlign: 'center' },
  emptySub: {
    fontFamily: FONT.bodyMed,
    fontSize: 12.5,
    color: COLORS.inkMuted,
    textAlign: 'center',
    marginBottom: 22,
  },
  emptyBtn: {
    backgroundColor: COLORS.dark,
    borderRadius: RADIUS.button,
    paddingVertical: 14,
    paddingHorizontal: 26,
  },
  emptyBtnText: { fontFamily: FONT.bodyBold, fontSize: 14, color: COLORS.onDark },
});
