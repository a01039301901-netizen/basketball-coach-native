import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

interface HeaderProps {
  showBack: boolean;
  onBack: () => void;
  variant?: 'dark' | 'light';
}

export function Header({ showBack, onBack, variant = 'dark' }: HeaderProps) {
  const isLight = variant === 'light';

  return (
    <View style={styles.header}>
      <View style={styles.headerTextWrap}>
        <Text style={[styles.headerEyebrow, isLight && styles.headerEyebrowLight]}>Basketball training app</Text>
        <Text style={[styles.headerTitle, isLight && styles.headerTitleLight]}>AI 농구 코치</Text>
      </View>
      {showBack ? (
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, isLight && styles.backButtonLight, pressed && styles.pressed]}
        >
          <Text style={[styles.backButtonText, isLight && styles.backButtonTextLight]}>메인으로</Text>
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
    marginBottom: 16,
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerEyebrow: {
    color: colors.textAccent,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  headerEyebrowLight: {
    color: '#8d7a68',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  headerTitleLight: {
    color: '#1f1712',
  },
  backButton: {
    backgroundColor: colors.lightButton,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(36,25,18,0.08)',
  },
  backButtonText: {
    color: colors.lightButtonText,
    fontSize: 13,
    fontWeight: '700',
  },
  backButtonTextLight: {
    color: '#241912',
  },
  placeholder: {
    width: 82,
  },
  pressed: {
    opacity: 0.9,
  },
});
