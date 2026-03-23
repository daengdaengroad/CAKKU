import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function CarCard({ car, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.top}>
        <Text style={styles.carIcon}>🚗</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>내 차</Text>
        </View>
      </View>
      <Text style={styles.carName}>{car.brand} {car.model}</Text>
      <Text style={styles.carDetail}>{car.year}년식 · {car.mileage?.toLocaleString()}km</Text>
      <Text style={styles.editHint}>탭해서 수정 →</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FF475730',
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  carIcon: { fontSize: 36 },
  badge: { backgroundColor: '#FF475720', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
  badgeText: { color: '#FF4757', fontSize: 12, fontWeight: '700' },
  carName: { fontSize: 22, fontWeight: '900', color: '#FFF', marginBottom: 4 },
  carDetail: { fontSize: 14, color: '#888', marginBottom: 12 },
  editHint: { fontSize: 12, color: '#555' },
});
