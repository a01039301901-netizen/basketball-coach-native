import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SmallButton } from '../components/common/Buttons';
import { Card } from '../components/common/Card';
import { colors } from '../theme/colors';
import type { AccountGender, AuthUser } from '../types/app';

interface ProfileActionResult {
  success: boolean;
  message: string;
}

interface ProfileScreenProps {
  currentUser: AuthUser;
  onUpdateProfile: (values: {
    nickname: string;
    name: string;
    age: string;
    gender: AccountGender;
  }) => Promise<ProfileActionResult>;
  onChangePassword: (values: {
    currentPassword: string;
    nextPassword: string;
    nextPasswordConfirm: string;
  }) => Promise<ProfileActionResult>;
  onLogout: () => void;
}

interface StatusMessage {
  tone: 'success' | 'error';
  text: string;
}

const GENDER_OPTIONS: Array<{ key: AccountGender; label: string }> = [
  { key: 'male', label: '남성' },
  { key: 'female', label: '여성' },
];

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

export function ProfileScreen({ currentUser, onUpdateProfile, onChangePassword, onLogout }: ProfileScreenProps) {
  const [nickname, setNickname] = useState(currentUser.nickname);
  const [name, setName] = useState(currentUser.name);
  const [age, setAge] = useState(String(currentUser.age));
  const [gender, setGender] = useState<AccountGender>(currentUser.gender);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [nextPasswordConfirm, setNextPasswordConfirm] = useState('');
  const [isCurrentPasswordVisible, setIsCurrentPasswordVisible] = useState(false);
  const [isNextPasswordVisible, setIsNextPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileStatus, setProfileStatus] = useState<StatusMessage | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<StatusMessage | null>(null);

  useEffect(() => {
    setNickname(currentUser.nickname);
    setName(currentUser.name);
    setAge(String(currentUser.age));
    setGender(currentUser.gender);
  }, [currentUser]);

  async function handleSaveProfile() {
    if (isSavingProfile) {
      return;
    }

    setIsSavingProfile(true);
    const result = await onUpdateProfile({
      nickname,
      name,
      age,
      gender,
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
    setName(currentUser.name);
    setAge(String(currentUser.age));
    setGender(currentUser.gender);
    setProfileStatus(null);
  }

  return (
    <View style={styles.contentGap}>
      <Card title="사용자 정보" style={styles.card}>
        <Text style={styles.lead}>프로필에서 닉네임, 이름, 나이, 성별을 바로 수정할 수 있습니다.</Text>

        <View style={styles.form}>
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
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>이름</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="이름을 입력해 주세요"
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={styles.input}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>나이</Text>
            <TextInput
              value={age}
              onChangeText={setAge}
              placeholder="나이를 입력해 주세요"
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={styles.input}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>성별</Text>
            <View style={styles.genderRow}>
              {GENDER_OPTIONS.map((option) => {
                const active = gender === option.key;

                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setGender(option.key)}
                    style={({ pressed }) => [styles.genderButton, active && styles.genderButtonActive, pressed && styles.pressed]}
                  >
                    <Text style={[styles.genderButtonText, active && styles.genderButtonTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <SmallButton
            title={isSavingProfile ? '저장 중' : '정보 저장'}
            onPress={() => void handleSaveProfile()}
            disabled={isSavingProfile}
          />
          <SmallButton title="입력 되돌리기" onPress={handleResetProfileForm} variant="dark" disabled={isSavingProfile} />
        </View>

        {profileStatus ? (
          <Text style={[styles.statusText, profileStatus.tone === 'success' ? styles.statusSuccess : styles.statusError]}>
            {profileStatus.text}
          </Text>
        ) : null}
      </Card>

      <Card title="비밀번호 변경" style={styles.card}>
        <Text style={styles.lead}>현재 비밀번호를 확인한 뒤 새 비밀번호를 두 번 입력해서 변경합니다.</Text>

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
            title={isChangingPassword ? '변경 중' : '비밀번호 변경'}
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

      <Card title="로그아웃" style={styles.card}>
        <Text style={styles.lead}>로그아웃하면 로그인 화면으로 이동합니다.</Text>

        <View style={styles.actionRow}>
          <SmallButton title="로그아웃" onPress={onLogout} variant="red" />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  contentGap: {
    gap: 16,
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
  genderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  genderButton: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  genderButtonActive: {
    backgroundColor: 'rgba(208,145,85,0.18)',
    borderColor: 'rgba(208,145,85,0.32)',
  },
  genderButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  genderButtonTextActive: {
    color: colors.text,
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
  pressed: {
    opacity: 0.9,
  },
});
