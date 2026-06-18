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
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    color: colors.textAccent,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.6,
  },
  text: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
});
