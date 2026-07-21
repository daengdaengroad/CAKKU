import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, FONT } from '../constants/theme';

export default function LegalScreen({ title, updated, sections }) {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      {updated ? <Text style={styles.updated}>시행일: {updated}</Text> : null}

      {sections.map((s, i) => (
        <View key={i} style={styles.section}>
          {s.heading ? <Text style={styles.heading}>{s.heading}</Text> : null}
          <Text style={styles.body}>{s.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 22, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  back: { fontFamily: FONT.bodySemi, fontSize: 22, color: COLORS.ink },
  headerTitle: { fontFamily: FONT.bodyBold, fontSize: 15, color: COLORS.ink },
  updated: { fontFamily: FONT.bodyMed, fontSize: 12, color: COLORS.inkMuted, marginBottom: 20 },
  section: { marginBottom: 20 },
  heading: { fontFamily: FONT.bodyBold, fontSize: 14, color: COLORS.ink, marginBottom: 7 },
  body: { fontFamily: FONT.body, fontSize: 13, color: COLORS.ink, lineHeight: 21 },
});
