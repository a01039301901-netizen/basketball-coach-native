import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SmallButton } from '../components/common/Buttons';
import { Card } from '../components/common/Card';
import { colors } from '../theme/colors';
import type { AccountGender, AuthMode } from '../types/app';

interface AuthSubmitValues {
  nickname: string;
  name: string;
  age: string;
  gender: AccountGender;
  password: string;
  keepSignedIn: boolean;
}

interface AuthActionResult {
  success: boolean;
  message: string;
}

interface TransferImportResult {
  success: boolean;
  message: string;
}

interface AuthScreenProps {
  mode: AuthMode;
  onChangeMode: (mode: AuthMode) => void;
  onLogin: (values: AuthSubmitValues) => Promise<AuthActionResult>;
  onSignup: (values: AuthSubmitValues) => Promise<AuthActionResult>;
  onImportAccount?: (code: string) => Promise<TransferImportResult>;
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

const GENDER_OPTIONS: Array<{ key: AccountGender; label: string }> = [
  { key: 'male', label: '남성' },
  { key: 'female', label: '여성' },
];

export function AuthScreen({ mode, onChangeMode, onLogin, onSignup, onImportAccount }: AuthScreenProps) {
  const [nickname, setNickname] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<AccountGender>('male');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [transferCode, setTransferCode] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');

  useEffect(() => {
    setStatusMessage('');
    setIsPasswordVisible(false);
  }, [mode]);

  useEffect(() => {
    setImportMessage('');
  }, [isImportOpen]);

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    const submitValues = {
      nickname,
      name,
      age,
      gender,
      password,
      keepSignedIn,
    };

    const result = mode === 'login' ? await onLogin(submitValues) : await onSignup(submitValues);
    setStatusMessage(result.success ? '' : result.message);
    setIsSubmitting(false);
  }

  async function handleImport() {
    if (!onImportAccount || isImporting) {
      return;
    }

    setIsImporting(true);
    const result = await onImportAccount(transferCode);
    setImportMessage(result.message);
    setIsImporting(false);
  }

  const isLogin = mode === 'login';

  return (
    <View style={styles.container}>
      <Card title={isLogin ? '로그인' : '회원가입'} style={styles.card}>
        <Text style={styles.subtitle}>
          {isLogin
            ? '닉네임, 이름, 나이, 성별, 비밀번호를 입력해 기존 계정으로 로그인해 주세요.'
            : '닉네임, 이름, 나이, 성별, 비밀번호를 설정해서 새 계정을 만들어 주세요.'}
        </Text>

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

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>비밀번호</Text>
            <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="비밀번호를 입력해 주세요"
                placeholderTextColor="rgba(255,255,255,0.45)"
                style={[styles.input, styles.passwordInput]}
                secureTextEntry={!isPasswordVisible}
              />
              <Pressable
                accessibilityLabel={isPasswordVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
                onPress={() => setIsPasswordVisible((current) => !current)}
                style={({ pressed }) => [styles.passwordToggle, pressed && styles.pressed]}
              >
                <EyeIcon visible={isPasswordVisible} />
              </Pressable>
            </View>
          </View>
        </View>

        <Pressable onPress={() => setKeepSignedIn((current) => !current)} style={({ pressed }) => [styles.keepRow, pressed && styles.pressed]}>
          <View style={[styles.checkbox, keepSignedIn && styles.checkboxActive]}>
            {keepSignedIn ? <Text style={styles.checkboxMark}>OK</Text> : null}
          </View>
          <View style={styles.keepTextWrap}>
            <Text style={styles.keepTitle}>로그인 상태 유지</Text>
            <Text style={styles.keepDescription}>앱을 다시 열어도 자동으로 로그인됩니다.</Text>
          </View>
        </Pressable>

        {statusMessage ? <Text style={styles.errorText}>{statusMessage}</Text> : null}

        <View style={styles.actionRow}>
          <SmallButton
            title={isSubmitting ? '처리 중' : isLogin ? '로그인' : '회원가입'}
            onPress={() => void handleSubmit()}
            disabled={isSubmitting}
          />
          <SmallButton
            title={isLogin ? '회원가입으로 이동' : '로그인으로 이동'}
            onPress={() => onChangeMode(isLogin ? 'signup' : 'login')}
            variant="dark"
            disabled={isSubmitting}
          />
        </View>

        {onImportAccount ? (
          <View style={styles.importSection}>
            <Pressable
              onPress={() => setIsImportOpen((current) => !current)}
              style={({ pressed }) => [styles.importToggle, pressed && styles.pressed]}
            >
              <Text style={styles.importToggleTitle}>다른 기기 계정 가져오기</Text>
              <Text style={styles.importToggleSubtitle}>
                컴퓨터에서 만든 전송 코드를 붙여 넣으면 이 기기에서도 같은 계정으로 바로 로그인할 수 있습니다.
              </Text>
            </Pressable>

            {isImportOpen ? (
              <View style={styles.importPanel}>
                <Text style={styles.importLabel}>전송 코드</Text>
                <TextInput
                  value={transferCode}
                  onChangeText={setTransferCode}
                  placeholder="컴퓨터 설정 화면에서 만든 전송 코드를 여기에 붙여 넣어 주세요"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  style={[styles.input, styles.importInput]}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {importMessage ? <Text style={styles.importMessage}>{importMessage}</Text> : null}
                <SmallButton
                  title={isImporting ? '가져오는 중' : '계정 가져오기'}
                  onPress={() => void handleImport()}
                  disabled={isImporting}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.footnote}>
          계정 정보와 로그인 상태는 기기마다 따로 저장됩니다. 다른 기기 계정은 전송 코드로만 옮겨 주세요.
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  card: {
    minHeight: 0,
  },
  subtitle: {
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
    fontSize: 15,
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
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
  },
  eyeIconWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeOuter: {
    width: 20,
    height: 12,
    borderWidth: 1.8,
    borderColor: colors.textSoft,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  eyePupil: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.textSoft,
  },
  eyePupilHidden: {
    opacity: 0.45,
  },
  eyeSlash: {
    position: 'absolute',
    width: 24,
    height: 2,
    borderRadius: 999,
    backgroundColor: colors.textSoft,
    transform: [{ rotate: '-38deg' }],
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genderButton: {
    flexGrow: 1,
    minWidth: 88,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  genderButtonActive: {
    backgroundColor: 'rgba(208,145,85,0.18)',
    borderColor: 'rgba(208,145,85,0.32)',
  },
  genderButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  genderButtonTextActive: {
    color: colors.text,
  },
  keepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 18,
    borderRadius: 0,
    padding: 14,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  checkboxMark: {
    color: '#24160b',
    fontSize: 11,
    fontWeight: '900',
  },
  keepTextWrap: {
    flex: 1,
    gap: 2,
  },
  keepTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  keepDescription: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  errorText: {
    marginTop: 14,
    color: '#ffb8b8',
    fontSize: 13,
    lineHeight: 20,
  },
  actionRow: {
    gap: 10,
    marginTop: 18,
  },
  importSection: {
    marginTop: 18,
    gap: 10,
  },
  importToggle: {
    borderRadius: 0,
    padding: 14,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  importToggleTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  importToggleSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  importPanel: {
    gap: 10,
    borderRadius: 16,
    padding: 14,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  importLabel: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: '800',
  },
  importInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  importMessage: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  footnote: {
    marginTop: 18,
    color: colors.textAccent,
    fontSize: 12,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.9,
  },
});
