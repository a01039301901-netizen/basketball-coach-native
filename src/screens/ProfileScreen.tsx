import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SmallButton } from '../components/common/Buttons';
import { Card } from '../components/common/Card';
import { colors } from '../theme/colors';
import type { AuthUser } from '../types/app';

interface ProfileActionResult {
  success: boolean;
  message: string;
}

interface ProfileScreenProps {
  currentUser: AuthUser;
  onUpdateProfile: (values: {
    nickname: string;
  }) => Promise<ProfileActionResult>;
  onChangePassword: (values: {
    currentPassword: string;
    nextPassword: string;
    nextPasswordConfirm: string;
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

function ResetIcon() {
  return <Text style={styles.resetIconGlyph}>↺</Text>;
}

export function ProfileScreen({
  currentUser,
  onUpdateProfile,
  onChangePassword,
  onDeleteAccount,
  onLogout,
}: ProfileScreenProps) {
  const [nickname, setNickname] = useState(currentUser.nickname);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [nextPasswordConfirm, setNextPasswordConfirm] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [isCurrentPasswordVisible, setIsCurrentPasswordVisible] = useState(false);
  const [isNextPasswordVisible, setIsNextPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isDeletePasswordVisible, setIsDeletePasswordVisible] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [profileStatus, setProfileStatus] = useState<StatusMessage | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<StatusMessage | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<StatusMessage | null>(null);

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
    setIsSavingProfile(false);
  }

  async function handleChangePassword() {
    if (isChangingPassword) {
      return;
    }

    setIsChangingPassword(true);
    const result = await onChangePassword({
      currentPassword,
      nextPassword,
      nextPasswordConfirm,
    });
    setPasswordStatus({
      tone: result.success ? 'success' : 'error',
      text: result.message,
    });

    if (result.success) {
      setCurrentPassword('');
      setNextPassword('');
      setNextPasswordConfirm('');
      setIsCurrentPasswordVisible(false);
      setIsNextPasswordVisible(false);
      setIsConfirmPasswordVisible(false);
    }

    setIsChangingPassword(false);
  }

  function handleResetProfileForm() {
    setNickname(currentUser.nickname);
    setProfileStatus(null);
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
        <Text style={styles.sectionHeader}>사용자 정보</Text>
        <Card style={styles.card}>
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>닉네임</Text>
              <View style={styles.inlineInputRow}>
                <TextInput
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder="닉네임을 입력해 주세요"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  style={[styles.input, styles.inlineInput]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  accessibilityLabel="닉네임 입력 되돌리기"
                  onPress={handleResetProfileForm}
                  disabled={isSavingProfile}
                  style={({ pressed }) => [styles.resetIconButton, isSavingProfile && styles.controlDisabled, pressed && styles.pressed]}
                >
                  <ResetIcon />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.actionRow}>
            <SmallButton
              title={isSavingProfile ? '저장 중...' : '정보 저장'}
              onPress={() => void handleSaveProfile()}
              disabled={isSavingProfile}
            />
          </View>

          {profileStatus ? (
            <Text style={[styles.statusText, profileStatus.tone === 'success' ? styles.statusSuccess : styles.statusError]}>
              {profileStatus.text}
            </Text>
          ) : null}
        </Card>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeader}>비밀번호 변경</Text>
        <Card style={styles.card}>
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>현재 비밀번호</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="현재 비밀번호를 입력해 주세요"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  style={[styles.input, styles.passwordInput]}
                  secureTextEntry={!isCurrentPasswordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  accessibilityLabel={isCurrentPasswordVisible ? '현재 비밀번호 숨기기' : '현재 비밀번호 보기'}
                  onPress={() => setIsCurrentPasswordVisible((current) => !current)}
                  style={({ pressed }) => [styles.passwordToggle, pressed && styles.pressed]}
                >
                  <EyeIcon visible={isCurrentPasswordVisible} />
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>새 비밀번호</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  value={nextPassword}
                  onChangeText={setNextPassword}
                  placeholder="새 비밀번호를 입력해 주세요"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  style={[styles.input, styles.passwordInput]}
                  secureTextEntry={!isNextPasswordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  accessibilityLabel={isNextPasswordVisible ? '새 비밀번호 숨기기' : '새 비밀번호 보기'}
                  onPress={() => setIsNextPasswordVisible((current) => !current)}
                  style={({ pressed }) => [styles.passwordToggle, pressed && styles.pressed]}
                >
                  <EyeIcon visible={isNextPasswordVisible} />
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>새 비밀번호 다시 입력</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  value={nextPasswordConfirm}
                  onChangeText={setNextPasswordConfirm}
                  placeholder="새 비밀번호를 다시 입력해 주세요"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  style={[styles.input, styles.passwordInput]}
                  secureTextEntry={!isConfirmPasswordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  accessibilityLabel={isConfirmPasswordVisible ? '비밀번호 확인 숨기기' : '비밀번호 확인 보기'}
                  onPress={() => setIsConfirmPasswordVisible((current) => !current)}
                  style={({ pressed }) => [styles.passwordToggle, pressed && styles.pressed]}
                >
                  <EyeIcon visible={isConfirmPasswordVisible} />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.actionRow}>
            <SmallButton
              title={isChangingPassword ? '변경 중...' : '비밀번호 변경'}
              onPress={() => void handleChangePassword()}
              disabled={isChangingPassword}
            />
          </View>

          {passwordStatus ? (
            <Text style={[styles.statusText, passwordStatus.tone === 'success' ? styles.statusSuccess : styles.statusError]}>
              {passwordStatus.text}
            </Text>
          ) : null}
        </Card>
      </View>

      <View style={styles.logoutButtonWrap}>
        <View style={styles.logoutActionRow}>
          <SmallButton title="로그아웃" onPress={onLogout} variant="dark" />
          <SmallButton title="계정 삭제" onPress={handleOpenDeleteModal} variant="red" />
        </View>
      </View>

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
  inlineInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inlineInput: {
    flex: 1,
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
  resetIconButton: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetIconGlyph: {
    color: colors.textSoft,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 22,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  logoutButtonWrap: {
    paddingHorizontal: 18,
    alignItems: 'flex-start',
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
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
