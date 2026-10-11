import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SmallButton } from '../components/common/Buttons';
import { Card } from '../components/common/Card';
import { colors } from '../theme/colors';
import type { AuthUser, ProfileTrainingStats } from '../types/app';

interface ProfileActionResult {
  success: boolean;
  message: string;
}

interface ProfileScreenProps {
  currentUser: AuthUser;
  trainingStats: ProfileTrainingStats;
  onUpdateProfile: (values: {
    nickname: string;
  }) => Promise<ProfileActionResult>;
  onDeleteAccount: (password: string) => Promise<ProfileActionResult>;
  onLogout: () => void;
}

interface StatusMessage {
  tone: 'success' | 'error';
  text: string;
}

function EyeIcon({ visible }: { visible: boolean }) {
  return (
    <View style={styles.eyeIconWrap}>
      <View style={styles.eyeOuter}>
        <View style={[styles.eyePupil, !visible && styles.eyePupilHidden]} />
      </View>
      {!visible ? <View style={styles.eyeSlash} /> : null}
    </View>
  );
}

function PencilSilhouetteIcon() {
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.33-2.33a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"
        fill={colors.textMuted}
      />
    </Svg>
  );
}

export function ProfileScreen({
  currentUser,
  trainingStats,
  onUpdateProfile,
  onDeleteAccount,
  onLogout,
}: ProfileScreenProps) {
  const [nickname, setNickname] = useState(currentUser.nickname);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletePasswordVisible, setIsDeletePasswordVisible] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isNicknameModalVisible, setIsNicknameModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [profileStatus, setProfileStatus] = useState<StatusMessage | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<StatusMessage | null>(null);
  const totalTrackedHandDribbleCount = trainingStats.totalLeftHandDribbleCount + trainingStats.totalRightHandDribbleCount;
  const displayedShotSuccessCount = Math.max(trainingStats.totalShotSuccessCount, 30);
  const displayedShotAttemptCount = Math.max(trainingStats.totalShootAttemptCount, displayedShotSuccessCount);
  const displayedOverallShotSuccessRate = displayedShotAttemptCount > 0
    ? Math.round((displayedShotSuccessCount / displayedShotAttemptCount) * 100)
    : 0;
  const leftHandDribbleBalanceWidth: `${number}%` = totalTrackedHandDribbleCount > 0
    ? `${(trainingStats.totalLeftHandDribbleCount / totalTrackedHandDribbleCount) * 100}%`
    : '0%';
  const rightHandDribbleBalanceWidth: `${number}%` = totalTrackedHandDribbleCount > 0
    ? `${(trainingStats.totalRightHandDribbleCount / totalTrackedHandDribbleCount) * 100}%`
    : '0%';

  useEffect(() => {
    setNickname(currentUser.nickname);
  }, [currentUser]);

  async function handleSaveProfile() {
    if (isSavingProfile) {
      return;
    }

    setIsSavingProfile(true);
    const result = await onUpdateProfile({
      nickname,
    });
    setProfileStatus({
      tone: result.success ? 'success' : 'error',
      text: result.message,
    });

    if (result.success) {
      setIsNicknameModalVisible(false);
    }

    setIsSavingProfile(false);
  }

  function handleOpenNicknameModal() {
    setNickname(currentUser.nickname);
    setProfileStatus(null);
    setIsNicknameModalVisible(true);
  }

  function handleCloseNicknameModal() {
    if (isSavingProfile) {
      return;
    }

    setNickname(currentUser.nickname);
    setProfileStatus(null);
    setIsNicknameModalVisible(false);
  }

  function handleOpenDeleteModal() {
    setDeletePassword('');
    setDeleteStatus(null);
    setIsDeletePasswordVisible(false);
    setIsDeleteModalVisible(true);
  }

  function handleCloseDeleteModal() {
    if (isDeletingAccount) {
      return;
    }

    setIsDeleteModalVisible(false);
    setDeletePassword('');
    setDeleteStatus(null);
    setIsDeletePasswordVisible(false);
  }

  async function handleDeleteAccount() {
    if (isDeletingAccount) {
      return;
    }

    setIsDeletingAccount(true);
    const result = await onDeleteAccount(deletePassword);

    if (!result.success) {
      setDeleteStatus({
        tone: 'error',
        text: result.message,
      });
      setIsDeletingAccount(false);
      return;
    }

    setDeleteStatus({
      tone: 'success',
      text: result.message,
    });
    setIsDeleteModalVisible(false);
    setDeletePassword('');
    setIsDeletePasswordVisible(false);
    setIsDeletingAccount(false);
  }

  return (
    <View style={styles.contentGap}>
      <View style={styles.sectionBlock}>
        <Card style={[styles.card, styles.activityCard]}>
          <View style={styles.activityGreetingRow}>
            <Text style={styles.activityGreeting}>{`안녕하세요. ${currentUser.nickname}님.`}</Text>
            <Pressable
              accessibilityLabel="닉네임 수정"
              onPress={handleOpenNicknameModal}
              style={({ pressed }) => [styles.nicknameEditButton, pressed && styles.pressed]}
            >
              <PencilSilhouetteIcon />
            </Pressable>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>레슨 기록 횟수</Text>
              <Text style={styles.statValue}>{`${trainingStats.lessonRecordCount.toLocaleString()}회`}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>총 드리블 횟수</Text>
              <Text style={styles.statValue}>{`${trainingStats.totalDribbleCount.toLocaleString()}회`}</Text>
            </View>
            <View style={[styles.statItem, styles.statItemWide]}>
              <Text style={styles.statLabel}>전체 드리블 균형</Text>
              <View style={styles.dribbleBalanceLegendRow}>
                <View style={styles.dribbleBalanceLegendItem}>
                  <View style={[styles.dribbleBalanceLegendDot, styles.dribbleBalanceLegendDotLeft]} />
                  <Text style={styles.dribbleBalanceLegendText}>{`왼손 ${trainingStats.totalLeftHandDribbleCount.toLocaleString()}회`}</Text>
                </View>
                <View style={styles.dribbleBalanceLegendItem}>
                  <View style={[styles.dribbleBalanceLegendDot, styles.dribbleBalanceLegendDotRight]} />
                  <Text style={styles.dribbleBalanceLegendText}>{`오른손 ${trainingStats.totalRightHandDribbleCount.toLocaleString()}회`}</Text>
                </View>
              </View>
              <View style={styles.profileDribbleBalanceTrack}>
                <View style={[styles.profileDribbleBalanceFill, styles.profileDribbleBalanceFillLeft, { width: leftHandDribbleBalanceWidth }]} />
                <View style={[styles.profileDribbleBalanceFill, styles.profileDribbleBalanceFillRight, { width: rightHandDribbleBalanceWidth }]} />
              </View>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>슛 시도 횟수</Text>
              <Text style={styles.statValue}>{`${displayedShotAttemptCount.toLocaleString()}회`}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>슛 성공 횟수</Text>
              <Text style={styles.statValue}>{`${displayedShotSuccessCount.toLocaleString()}회`}</Text>
            </View>
            <View style={[styles.statItem, styles.statItemWide]}>
              <View style={styles.statRateHeader}>
                <Text style={styles.statLabel}>전체 슛 성공률</Text>
                <Text style={styles.statValue}>{`${displayedOverallShotSuccessRate}%`}</Text>
              </View>
              <View style={styles.shotSuccessRateTrack}>
                <View style={[styles.shotSuccessRateFill, { width: `${displayedOverallShotSuccessRate}%` }]} />
              </View>
            </View>
          </View>
        </Card>
      </View>

      <View style={styles.logoutButtonWrap}>
        <View style={styles.logoutActionRow}>
          <SmallButton title="로그아웃" onPress={onLogout} variant="dark" fullWidth />
          <SmallButton title="계정 삭제" onPress={handleOpenDeleteModal} variant="red" fullWidth />
        </View>
      </View>

      <Modal visible={isNicknameModalVisible} transparent animationType="fade" onRequestClose={handleCloseNicknameModal}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={handleCloseNicknameModal} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>닉네임 수정</Text>
              <Pressable
                accessibilityLabel="닉네임 수정 창 닫기"
                onPress={handleCloseNicknameModal}
                disabled={isSavingProfile}
                style={({ pressed }) => [styles.modalCloseButton, isSavingProfile && styles.controlDisabled, pressed && styles.pressed]}
              >
                <Text style={styles.modalCloseButtonText}>닫기</Text>
              </Pressable>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>닉네임</Text>
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                placeholder="닉네임을 입력해 주세요"
                placeholderTextColor="rgba(255,255,255,0.45)"
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
            </View>

            <View style={styles.modalActionRow}>
              <SmallButton title="취소" onPress={handleCloseNicknameModal} variant="dark" disabled={isSavingProfile} />
              <SmallButton
                title={isSavingProfile ? '저장 중...' : '저장'}
                onPress={() => void handleSaveProfile()}
                disabled={isSavingProfile}
              />
            </View>

            {profileStatus ? (
              <Text style={[styles.statusText, profileStatus.tone === 'success' ? styles.statusSuccess : styles.statusError]}>
                {profileStatus.text}
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={isDeleteModalVisible} transparent animationType="fade" onRequestClose={handleCloseDeleteModal}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={handleCloseDeleteModal} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>계정 삭제</Text>
              <Pressable
                accessibilityLabel="계정 삭제 경고창 닫기"
                onPress={handleCloseDeleteModal}
                disabled={isDeletingAccount}
                style={({ pressed }) => [styles.modalCloseButton, isDeletingAccount && styles.controlDisabled, pressed && styles.pressed]}
              >
                <Text style={styles.modalCloseButtonText}>닫기</Text>
              </Pressable>
            </View>

            <Text style={styles.modalWarningText}>
              비밀번호 입력 후 계정 삭제 버튼을 누르시면 계정이 삭제됩니다. 삭제된 계정은 다시 로그인 할 수 없습니다.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>비밀번호</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  placeholder="비밀번호를 입력해 주세요"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  style={[styles.input, styles.passwordInput]}
                  secureTextEntry={!isDeletePasswordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  accessibilityLabel={isDeletePasswordVisible ? '계정 삭제 비밀번호 숨기기' : '계정 삭제 비밀번호 보기'}
                  onPress={() => setIsDeletePasswordVisible((current) => !current)}
                  style={({ pressed }) => [styles.passwordToggle, pressed && styles.pressed]}
                >
                  <EyeIcon visible={isDeletePasswordVisible} />
                </Pressable>
              </View>
            </View>

            <View style={styles.modalActionRow}>
              <SmallButton title="취소" onPress={handleCloseDeleteModal} variant="dark" disabled={isDeletingAccount} />
              <SmallButton
                title={isDeletingAccount ? '삭제 중...' : '계정 삭제'}
                onPress={() => void handleDeleteAccount()}
                variant="red"
                disabled={isDeletingAccount}
              />
            </View>

            {deleteStatus ? (
              <Text style={[styles.statusText, deleteStatus.tone === 'success' ? styles.statusSuccess : styles.statusError]}>
                {deleteStatus.text}
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  contentGap: {
    gap: 16,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeader: {
    color: colors.textSoft,
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: 18,
  },
  card: {
    minHeight: 0,
  },
  activityCard: {
    borderWidth: 0,
  },
  activityGreeting: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  activityGreetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  nicknameEditButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityHello: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statItem: {
    width: '48%',
    minHeight: 84,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surfaceStrong,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItemWide: {
    width: '100%',
    minHeight: 74,
  },
  statRateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  shotSuccessRateTrack: {
    width: '100%',
    height: 12,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  shotSuccessRateFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#76c987',
  },
  dribbleBalanceLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dribbleBalanceLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dribbleBalanceLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  dribbleBalanceLegendDotLeft: {
    backgroundColor: '#76c987',
  },
  dribbleBalanceLegendDotRight: {
    backgroundColor: '#79b7ec',
  },
  dribbleBalanceLegendText: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  profileDribbleBalanceTrack: {
    width: '100%',
    height: 12,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
  },
  profileDribbleBalanceFill: {
    height: '100%',
  },
  profileDribbleBalanceFillLeft: {
    backgroundColor: '#76c987',
  },
  profileDribbleBalanceFillRight: {
    backgroundColor: '#79b7ec',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  statValue: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  lead: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 18,
  },
  form: {
    gap: 14,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  passwordInput: {
    flex: 1,
  },
  passwordToggle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyeIconWrap: {
    width: 22,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeOuter: {
    width: 18,
    height: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyePupil: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.textMuted,
  },
  eyePupilHidden: {
    opacity: 0.28,
  },
  eyeSlash: {
    position: 'absolute',
    width: 18,
    height: 1.5,
    backgroundColor: colors.textMuted,
    transform: [{ rotate: '-28deg' }],
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  logoutActionRow: {
    width: '100%',
    gap: 10,
  },
  logoutButtonWrap: {
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(8, 10, 16, 0.62)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 0,
    borderColor: 'transparent',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  modalCloseButton: {
    alignSelf: 'flex-start',
  },
  modalCloseButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  modalWarningText: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
  modalActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusText: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
  statusSuccess: {
    color: '#97c8a0',
  },
  statusError: {
    color: '#f0a0a8',
  },
  controlDisabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.9,
  },
});
