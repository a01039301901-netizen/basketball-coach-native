import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SmallButton } from '../components/common/Buttons';
import { Card } from '../components/common/Card';
import { colors } from '../theme/colors';
import type { AccountGender, AuthMode } from '../types/app';

interface AuthSubmitValues {
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

interface AuthScreenProps {
  mode: AuthMode;
  onChangeMode: (mode: AuthMode) => void;
  onLogin: (values: AuthSubmitValues) => Promise<AuthActionResult>;
  onSignup: (values: AuthSubmitValues) => Promise<AuthActionResult>;
}

const GENDER_OPTIONS: Array<{ key: AccountGender; label: string }> = [
  { key: 'male', label: '남성' },
  { key: 'female', label: '여성' },
  { key: 'other', label: '기타' },
];

export function AuthScreen({ mode, onChangeMode, onLogin, onSignup }: AuthScreenProps) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<AccountGender>('male');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    setStatusMessage('');
  }, [mode]);

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    const submitValues = {
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

  const isLogin = mode === 'login';

  return (
    <View style={styles.container}>
      <Card title={isLogin ? '로그인' : '회원가입'} style={styles.card}>
        <Text style={styles.subtitle}>
          {isLogin
            ? '이름, 나이, 성별, 비밀번호를 입력해 기존 계정에 연결하세요.'
            : '이름, 나이, 성별, 비밀번호를 설정해 새 농구 레슨 계정을 만드세요.'}
        </Text>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>이름</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="이름을 입력하세요"
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
              placeholder="나이를 입력하세요"
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
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="비밀번호를 입력하세요"
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={styles.input}
              secureTextEntry
            />
          </View>
        </View>

        <Pressable onPress={() => setKeepSignedIn((current) => !current)} style={({ pressed }) => [styles.keepRow, pressed && styles.pressed]}>
          <View style={[styles.checkbox, keepSignedIn && styles.checkboxActive]}>
            {keepSignedIn ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <View style={styles.keepTextWrap}>
            <Text style={styles.keepTitle}>로그인 상태 유지</Text>
            <Text style={styles.keepDescription}>앱을 다시 열어도 자동으로 로그인됩니다.</Text>
          </View>
        </Pressable>

        {statusMessage ? <Text style={styles.errorText}>{statusMessage}</Text> : null}

        <View style={styles.actionRow}>
          <SmallButton
            title={isSubmitting ? '처리 중...' : isLogin ? '로그인' : '회원가입'}
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

        <Text style={styles.footnote}>계정 정보와 로그인 상태는 현재 기기 내부 저장소에 보관됩니다.</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  card: {
    minHeight: 0,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 22,
  },
  form: {
    gap: 16,
  },
  fieldGroup: {
    gap: 9,
  },
  label: {
    color: colors.textSoft,
    fontSize: 15,
    fontWeight: '800',
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 15,
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  genderButton: {
    flexGrow: 1,
    minWidth: 88,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  genderButtonActive: {
    backgroundColor: 'rgba(255,139,43,0.25)',
    borderColor: 'rgba(255,255,255,0.24)',
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
    marginTop: 20,
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  checkboxActive: {
    backgroundColor: colors.secondary,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  checkboxMark: {
    color: '#24160b',
    fontSize: 14,
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
    gap: 12,
    marginTop: 20,
  },
  footnote: {
    marginTop: 18,
    color: colors.textAccent,
    fontSize: 12,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
});
