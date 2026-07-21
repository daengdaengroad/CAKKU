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
  const distance = formatDistance(shop.distanceMeters);
  const hasRating = shop.rating != null;

  return (
    <TouchableOpacity style={styles.item} onPress={openDetail} activeOpacity={0.85}>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{shop.name}</Text>

        {(hasRating || distance) ? (
          <View style={styles.metaRow}>
            {hasRating ? (
              <>
                <Text style={styles.star}>★</Text>
                <Text style={styles.rating}>{Number(shop.rating).toFixed(1)}</Text>
                {shop.reviews != null ? (
                  <Text style={styles.reviews}>({Number(shop.reviews).toLocaleString()})</Text>
                ) : null}
              </>
            ) : null}
            {hasRating && distance ? <Text style={styles.dot}>·</Text> : null}
            {distance ? <Text style={styles.distance}>{distance}</Text> : null}
          </View>
        ) : null}

        <Text style={styles.address} numberOfLines={1}>{shop.address}</Text>

        {category ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{category}</Text>
          </View>
        ) : null}
      </View>

      {shop.photoRef ? (
        <Image
          source={{ uri: `${API_BASE_URL}/api/shop-photo?ref=${encodeURIComponent(shop.photoRef)}&w=200` }}
          style={styles.thumb}
        />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Text style={styles.thumbPlaceholderText}>준비 중</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    padding: 13,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: { flex: 1, marginRight: 12 },
  name: { fontFamily: FONT.bodyBold, fontSize: 14.5, color: COLORS.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 5 },
  star: { fontSize: 11.5, color: COLORS.severityMid },
  rating: { fontFamily: FONT.bodyBold, fontSize: 12, color: COLORS.ink },
  reviews: { fontFamily: FONT.bodyMed, fontSize: 11.5, color: COLORS.inkMuted },
  dot: { fontFamily: FONT.bodyMed, fontSize: 11.5, color: COLORS.inkMuted, marginHorizontal: 1 },
  distance: { fontFamily: FONT.bodyBold, fontSize: 12, color: COLORS.accent },
  address: { fontFamily: FONT.bodyMed, fontSize: 12, color: COLORS.inkMuted, marginTop: 5 },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.accentSoft,
    borderRadius: RADIUS.pill,
    paddingVertical: 4,
    paddingHorizontal: 9,
    marginTop: 8,
  },
  tagText: { fontFamily: FONT.bodySemi, fontSize: 10.5, color: COLORS.accent },
  thumb: { width: 78, height: 78, borderRadius: RADIUS.thumb, backgroundColor: COLORS.viewfinderBg },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholderText: { fontFamily: FONT.bodyMed, fontSize: 11, color: COLORS.inkMuted },
});
