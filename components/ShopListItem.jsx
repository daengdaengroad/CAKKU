import { TouchableOpacity, View, Text, StyleSheet, Linking } from 'react-native';

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
      </View>
      {shop.phone ? (
        <TouchableOpacity style={styles.callBtn} onPress={handleCall} activeOpacity={0.8}>
          <Text style={styles.callBtnText}>📞</Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A2A3E',
  },
  textArea: { flex: 1, marginRight: 10 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  distance: { fontSize: 12, color: '#FF4757', fontWeight: '700' },
  address: { fontSize: 12, color: '#888' },
  callBtn: {
    backgroundColor: '#2A2A3E',
    borderRadius: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnText: { fontSize: 18 },
});
