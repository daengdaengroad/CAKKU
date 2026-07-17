import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT, RADIUS } from '../constants/theme';

export default function DamageCard({ damage }) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
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
      <Text style={styles.price}>
        {Number(damage.priceMin || 0).toLocaleString()} ~ {Number(damage.priceMax || 0).toLocaleString()}원
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 10,
  },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  titleArea: { flex: 1 },
  name: { fontFamily: FONT.bodyBold, fontSize: 14, color: COLORS.ink },
  location: { fontFamily: FONT.bodyMed, fontSize: 11.5, color: COLORS.inkMuted, marginTop: 2 },
  actionBadge: { backgroundColor: COLORS.accentSoft, borderRadius: RADIUS.pill, paddingVertical: 4, paddingHorizontal: 10 },
  actionBadgeText: { fontFamily: FONT.bodyBold, color: COLORS.accent, fontSize: 11 },
  detail: { fontFamily: FONT.bodyMed, fontSize: 12.5, color: COLORS.inkMuted, marginBottom: 10, lineHeight: 18 },
  price: { fontFamily: FONT.display, fontSize: 15, color: COLORS.ink, textAlign: 'right' },
});
