import { TouchableOpacity, View, Text, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { API_BASE_URL } from '../constants/config';
import { COLORS, FONT, RADIUS } from '../constants/theme';

function formatDistance(meters) {
  if (meters == null) return '';
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`;
}

function shortCategory(category) {
  if (!category) return '';
  return category.split('>').pop().trim();
}

export default function ShopListItem({ shop }) {
  const router = useRouter();

  const openDetail = () => {
    router.push({ pathname: '/shop-detail', params: { shop: JSON.stringify(shop) } });
  };

  const category = shortCategory(shop.category);

  return (
    <TouchableOpacity style={styles.item} onPress={openDetail} activeOpacity={0.85}>
      {shop.photoRef ? (
        <Image
          source={{ uri: `${API_BASE_URL}/api/shop-photo?ref=${encodeURIComponent(shop.photoRef)}&w=600` }}
          style={styles.photo}
        />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]}>
          <Text style={styles.photoPlaceholderText}>사진 준비 중</Text>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{shop.name}</Text>
          <Text style={styles.distance}>{formatDistance(shop.distanceMeters)}</Text>
        </View>

        {shop.rating != null ? (
          <View style={styles.ratingRow}>
            <Text style={styles.star}>★</Text>
            <Text style={styles.rating}>{Number(shop.rating).toFixed(1)}</Text>
            {shop.reviews != null ? <Text style={styles.reviews}>({Number(shop.reviews).toLocaleString()})</Text> : null}
          </View>
        ) : null}

        <Text style={styles.address} numberOfLines={1}>{shop.address}</Text>

        {category ? (
          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{category}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
    marginBottom: 12,
  },
  photo: { width: '100%', height: 140, backgroundColor: COLORS.viewfinderBg },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderText: { fontFamily: FONT.bodyMed, fontSize: 12, color: COLORS.inkMuted },
  body: { padding: 15 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  name: { flex: 1, fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.ink, marginRight: 8 },
  distance: { fontFamily: FONT.bodyBold, fontSize: 12.5, color: COLORS.accent },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 5 },
  star: { fontSize: 12, color: COLORS.severityMid },
  rating: { fontFamily: FONT.bodyBold, fontSize: 12.5, color: COLORS.ink },
  reviews: { fontFamily: FONT.bodyMed, fontSize: 11.5, color: COLORS.inkMuted },
  address: { fontFamily: FONT.bodyMed, fontSize: 12, color: COLORS.inkMuted, marginTop: 5 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { backgroundColor: COLORS.accentSoft, borderRadius: RADIUS.pill, paddingVertical: 5, paddingHorizontal: 10 },
  tagText: { fontFamily: FONT.bodySemi, fontSize: 10.5, color: COLORS.accent },
});
