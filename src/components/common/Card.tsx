import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

interface CardProps extends PropsWithChildren {
  title: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({ title, children, style }: CardProps) {
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    overflow: 'hidden',
  },
  title: {
    color: colors.textSoft,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 12,
  },
});
