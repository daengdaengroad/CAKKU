import { View, Text, StyleSheet } from 'react-native';

const ACTION_ICONS = {
  교체: '🔧',
  판금: '🔨',
  도색: '🎨',
  수리: '🛠️',
};

export default function DamageCard({ damage }) {
  const icon = ACTION_ICONS[damage.action] || '🛠️';

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.icon}>{icon}</Text>
        <View style={styles.titleArea}>
          <Text style={styles.name}>{damage.name}</Text>
          {damage.location ? <Text style={styles.location}>{damage.location}</Text> : null}
        </View>
        {damage.action ? (
          <View style={styles.actionBadge}>
            <Text style={styles.actionBadgeText}>{damage.action}</Text>
          </View>
        ) : null}
      </View>
      {damage.detail ? <Text style={styles.detail}>{damage.detail}</Text> : null}
      <Text style={styles.price}>{Number(damage.price || 0).toLocaleString()}원</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A2A3E',
  },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  icon: { fontSize: 24, marginRight: 10 },
  titleArea: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  location: { fontSize: 12, color: '#888', marginTop: 2 },
  actionBadge: { backgroundColor: '#FF475720', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
  actionBadgeText: { color: '#FF4757', fontSize: 12, fontWeight: '700' },
  detail: { fontSize: 13, color: '#CCC', marginBottom: 8 },
  price: { fontSize: 16, fontWeight: '800', color: '#FF4757', textAlign: 'right' },
});
