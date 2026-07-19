import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

interface InfoBoxProps {
  label: string;
  text: string;
  reserveToggleSpace?: boolean;
  translucent?: boolean;
}

export function InfoBox({ label, text, reserveToggleSpace = false, translucent = false }: InfoBoxProps) {
  return (
    <View style={[styles.box, translucent && styles.translucentBox, reserveToggleSpace && styles.boxWithToggleSpace]}>
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
    borderWidth: 0,
    borderColor: 'transparent',
  },
  boxWithToggleSpace: {
    paddingRight: 54,
  },
  translucentBox: {
    backgroundColor: 'rgba(7,7,7,0.26)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
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
