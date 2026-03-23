import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';

export default function ServiceButton({ icon, title, desc, onPress }) {
  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.textArea}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.desc}>{desc}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A2A3E',
  },
  icon: { fontSize: 28, marginRight: 14 },
  textArea: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: '#FFF', marginBottom: 2 },
  desc: { fontSize: 12, color: '#888' },
  arrow: { color: '#555', fontSize: 22, marginLeft: 8 },
});
