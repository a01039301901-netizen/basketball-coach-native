import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../../theme/colors';

interface PrimaryButtonProps {
  title: string;
  subtitle: string;
  onPress: () => void;
}

interface SmallButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'orange' | 'red' | 'dark';
  disabled?: boolean;
}

export function PrimaryButton({ title, subtitle, onPress }: PrimaryButtonProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.mainButton, pressed && styles.pressed]}>
      <Text style={styles.mainButtonTitle}>{title}</Text>
      <Text style={styles.mainButtonSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

export function SmallButton({ title, onPress, variant = 'orange', disabled = false }: SmallButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallButton,
        variant === 'red' && styles.redButton,
        variant === 'dark' && styles.darkButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.smallButtonText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mainButton: {
    minHeight: 120,
    borderRadius: 22,
    padding: 22,
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  mainButtonTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  mainButtonSubtitle: {
    color: '#fff3ea',
    fontSize: 14,
    lineHeight: 20,
  },
  smallButton: {
    borderRadius: 14,
    backgroundColor: colors.secondary,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  redButton: {
    backgroundColor: colors.danger,
  },
  darkButton: {
    backgroundColor: colors.darkButton,
  },
  smallButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
