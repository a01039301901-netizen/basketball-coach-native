import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

interface HeaderProps {
  showBack: boolean;
  onBack: () => void;
  showProfile?: boolean;
  profileLabel?: string;
  onOpenProfile?: () => void;
  variant?: 'dark' | 'light';
}

export function Header({
  showBack,
  onBack,
  showProfile = false,
  profileLabel = '나',
  onOpenProfile,
  variant = 'dark',
}: HeaderProps) {
  const isLight = variant === 'light';
  const resolvedProfileLabel = profileLabel.trim().charAt(0) || '나';
  const shouldShowActions = showBack || showProfile;

  return (
    <View style={styles.header}>
      {!shouldShowActions ? <View style={styles.placeholder} /> : null}
      <View style={styles.actionsRow}>
        {showBack ? (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, isLight && styles.backButtonLight, pressed && styles.pressed]}
          >
            <Text style={[styles.backButtonText, isLight && styles.backButtonTextLight]}>{'<'}</Text>
          </Pressable>
        ) : null}

        {showProfile && onOpenProfile ? (
          <Pressable
            onPress={onOpenProfile}
            style={({ pressed }) => [styles.profileButton, isLight && styles.profileButtonLight, pressed && styles.pressed]}
          >
            <Text style={[styles.profileButtonText, isLight && styles.profileButtonTextLight]}>{resolvedProfileLabel}</Text>
          </Pressable>
        ) : null}

        {!showBack && !showProfile ? <View style={styles.placeholder} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    marginBottom: 8,
    gap: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    backgroundColor: colors.lightButton,
    borderRadius: 999,
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(36,25,18,0.08)',
  },
  backButtonText: {
    color: colors.lightButtonText,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 24,
  },
  backButtonTextLight: {
    color: '#241912',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileButtonLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(36,25,18,0.08)',
  },
  profileButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  profileButtonTextLight: {
    color: '#241912',
  },
  placeholder: {
    flex: 1,
  },
  pressed: {
    opacity: 0.9,
  },
});
