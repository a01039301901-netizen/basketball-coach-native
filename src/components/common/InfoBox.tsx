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
    backgroundColor: colors.cardOverlay,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
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
