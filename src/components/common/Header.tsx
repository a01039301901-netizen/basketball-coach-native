import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

interface HeaderProps {
  showBack: boolean;
  onBack: () => void;
}

export function Header({ showBack, onBack }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTextWrap}>
        <Text style={styles.headerEyebrow}>BASKETBALL TRAINING</Text>
        <Text style={styles.headerTitle}>AI 농구 코치</Text>
      </View>
      {showBack ? (
        <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backButtonText}>메인으로</Text>
        </Pressable>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 16,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerEyebrow: {
    color: colors.textAccent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 6,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  backButton: {
    backgroundColor: colors.lightButton,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  backButtonText: {
    color: colors.lightButtonText,
    fontSize: 14,
    fontWeight: '800',
  },
  placeholder: {
    width: 90,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
