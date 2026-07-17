import { TouchableOpacity, View, Text, StyleSheet, Linking } from 'react-native';
import { COLORS, FONT, RADIUS } from '../constants/theme';

function formatDistance(meters) {
  if (meters == null) return '';
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`;
}

export default function ShopListItem({ shop }) {
  const handlePress = () => {
    if (shop.placeUrl) Linking.openURL(shop.placeUrl);
  };

  const handleCall = () => {
    if (shop.phone) Linking.openURL(`tel:${shop.phone}`);
  };

  return (
    <TouchableOpacity style={styles.item} onPress={handlePress} activeOpacity={0.8}>
      <View style={styles.textArea}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{shop.name}</Text>
          <Text style={styles.distance}>{formatDistance(shop.distanceMeters)}</Text>
        </View>
        <Text style={styles.address}>{shop.address}</Text>
        {shop.phone ? <Text style={styles.phone}>{shop.phone}</Text> : null}
      </View>
      {shop.phone ? (
        <TouchableOpacity style={styles.callBtn} onPress={handleCall} activeOpacity={0.8}>
          <Text style={styles.callBtnText}>전화</Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 11,
  },
  textArea: { flex: 1, marginRight: 10 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 },
  name: { fontFamily: FONT.bodyBold, fontSize: 14, color: COLORS.ink },
  distance: { fontFamily: FONT.bodyBold, fontSize: 12.5, color: COLORS.accent },
  address: { fontFamily: FONT.bodyMed, fontSize: 11.5, color: COLORS.inkMuted },
  phone: { fontFamily: FONT.bodyMed, fontSize: 11.5, color: COLORS.inkMuted, marginTop: 2 },
  callBtn: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: RADIUS.button,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  callBtnText: { fontFamily: FONT.bodyBold, fontSize: 12, color: COLORS.accent },
});
