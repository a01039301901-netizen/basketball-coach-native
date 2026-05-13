import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

interface InfoBoxProps {
  label: string;
  text: string;
}

export function InfoBox({ label, text }: InfoBoxProps) {
  return (
    <View style={styles.box}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  label: {
    color: colors.textAccent,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 1,
  },
  text: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
});
