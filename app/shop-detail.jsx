import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { API_BASE_URL } from '../constants/config';
import { COLORS, FONT, RADIUS } from '../constants/theme';
import Roadview from '../components/Roadview';

function shortCategory(category) {
  if (!category) return '';
  return category.split('>').pop().trim();
}

export default function ShopDetailScreen() {
  const router = useRouter();
  const { shop: shopParam } = useLocalSearchParams();

  let shop = {};
  try {
    shop = JSON.parse(shopParam || '{}');
  } catch (e) {}

  const category = shortCategory(shop.category);

  const handleCall = () => {
    if (shop.phone) Linking.openURL(`tel:${shop.phone}`);
  };

  const handleMap = () => {
    if (shop.placeUrl) Linking.openURL(shop.placeUrl);
  };

  const handleReserve = () => {
    router.push({
      pathname: '/request',
      params: {
        type: 'reservation',
        shopName: shop.name || '',
        prefill: `[희망 업체] ${shop.name}\n[주소] ${shop.address || ''}\n\n원하시는 날짜와 정비 내용을 적어주세요.`,
      },
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {shop.photoRef ? (
          <Image
            source={{ uri: `${API_BASE_URL}/api/shop-photo?ref=${encodeURIComponent(shop.photoRef)}&w=800` }}
            style={styles.photo}
          />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Text style={styles.photoPlaceholderText}>사진 준비 중</Text>
          </View>
        )}

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.name}>{shop.name}</Text>
          <View style={styles.metaRow}>
            {shop.rating != null ? (
              <View style={styles.ratingRow}>
                <Text style={styles.star}>★</Text>
                <Text style={styles.rating}>{Number(shop.rating).toFixed(1)}</Text>
                {shop.reviews != null ? (
                  <Text style={styles.reviews}>리뷰 {Number(shop.reviews).toLocaleString()}</Text>
                ) : null}
              </View>
            ) : null}
            {category ? <Text style={styles.category}>{category}</Text> : null}
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>주소</Text>
            <Text style={styles.infoValue}>{shop.address || '정보 없음'}</Text>
          </View>
          {shop.phone ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>전화</Text>
              <Text style={styles.infoValue}>{shop.phone}</Text>
            </View>
          ) : null}
        </View>

        <Roadview lat={shop.lat} lng={shop.lng} name={shop.name} />

        <View style={styles.actionRow}>
          {shop.phone ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleCall}>
              <Text style={styles.secondaryBtnText}>전화 걸기</Text>
            </TouchableOpacity>
          ) : null}
          {shop.placeUrl ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleMap}>
              <Text style={styles.secondaryBtnText}>
                {shop.phone ? '지도에서 보기' : '지도·연락처 보기'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {!shop.phone && shop.placeUrl ? (
          <Text style={styles.contactNote}>
            전화번호가 등록되지 않은 곳이에요. 위 “지도·연락처 보기”에서 전화·길찾기를 확인할 수 있어요.
          </Text>
        ) : null}

        <Text style={styles.notice}>
          인증·시공 정보는 제휴 업체 등록 시 표시됩니다.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.reserveBtn} onPress={handleReserve}>
          <Text style={styles.reserveBtnText}>이 업체로 예약 맡기기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 30 },
  photo: { width: '100%', height: 220, backgroundColor: COLORS.viewfinderBg },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderText: { fontFamily: FONT.bodyMed, fontSize: 13, color: COLORS.inkMuted },
  backBtn: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { fontFamily: FONT.bodySemi, fontSize: 24, color: COLORS.ink, marginTop: -2 },
  header: { paddingHorizontal: 22, paddingTop: 20 },
  name: { fontFamily: FONT.display, fontSize: 22, color: COLORS.ink, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  star: { fontSize: 13, color: COLORS.severityMid },
  rating: { fontFamily: FONT.bodyBold, fontSize: 13.5, color: COLORS.ink },
  reviews: { fontFamily: FONT.bodyMed, fontSize: 12, color: COLORS.inkMuted, marginLeft: 2 },
  category: { fontFamily: FONT.bodyMed, fontSize: 12, color: COLORS.inkMuted },
  infoCard: {
    marginHorizontal: 22,
    marginTop: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    padding: 16,
    gap: 12,
  },
  infoRow: { flexDirection: 'row', gap: 14 },
  infoLabel: { fontFamily: FONT.bodySemi, fontSize: 12.5, color: COLORS.inkMuted, width: 40 },
  infoValue: { flex: 1, fontFamily: FONT.bodyMed, fontSize: 13, color: COLORS.ink, lineHeight: 19 },
  actionRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 22, marginTop: 14 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.button,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryBtnText: { fontFamily: FONT.bodyBold, fontSize: 13.5, color: COLORS.ink },
  contactNote: {
    fontFamily: FONT.bodyMed,
    fontSize: 11.5,
    color: COLORS.inkMuted,
    lineHeight: 17,
    paddingHorizontal: 22,
    marginTop: 12,
  },
  notice: {
    fontFamily: FONT.bodyMed,
    fontSize: 11.5,
    color: COLORS.inkMuted,
    textAlign: 'center',
    marginTop: 22,
    paddingHorizontal: 22,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  reserveBtn: {
    backgroundColor: COLORS.dark,
    borderRadius: RADIUS.button,
    paddingVertical: 16,
    alignItems: 'center',
  },
  reserveBtnText: { fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.onDark },
});
