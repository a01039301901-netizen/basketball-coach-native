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
    minHeight: 108,
    borderRadius: 16,
    padding: 18,
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mainButtonTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  mainButtonSubtitle: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 19,
  },
  smallButton: {
    borderRadius: 12,
    backgroundColor: colors.secondary,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.border,
  },
  redButton: {
    backgroundColor: colors.danger,
  },
  darkButton: {
    backgroundColor: colors.darkButton,
  },
  smallButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.9,
  },
});
