import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SmallButton } from '../components/common/Buttons';
import { colors } from '../theme/colors';
import type { AuthMode } from '../types/app';

const authBasketballHero = require('../../assets/auth-basketball-hero.png');

interface AuthSubmitValues {
  nickname: string;
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

export function AuthScreen({ mode, onChangeMode, onLogin, onSignup }: AuthScreenProps) {
  const { height, width } = useWindowDimensions();
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const isLogin = mode === 'login';
  const availableWidth = Math.max(280, width - 32);
  const shellWidth = Math.min(availableWidth, 460);
  const shellHeight = Math.max(620, Math.min(height - 36, 820));
  const heroPanelHeight = Math.round(shellHeight * 0.5);
  const heroSize = Math.min(shellWidth * 0.72, heroPanelHeight * 0.82);

  useEffect(() => {
    setStatusMessage('');
    setIsPasswordVisible(false);
  }, [mode]);

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    const submitValues: AuthSubmitValues = {
      nickname,
      password,
      keepSignedIn,
    };

    const result = mode === 'login' ? await onLogin(submitValues) : await onSignup(submitValues);
    setStatusMessage(result.success ? '' : result.message);
    setIsSubmitting(false);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.authShell, { width: shellWidth, minHeight: shellHeight }]}>
        <View style={[styles.heroPanel, { minHeight: heroPanelHeight }]}>
          <Image
            source={authBasketballHero}
            resizeMode="contain"
            style={[
              styles.heroImage,
              {
                width: heroSize,
                height: heroSize,
              },
            ]}
          />
        </View>

        <View style={styles.formPanel}>
          <Text style={styles.formTitle}>{isLogin ? '로그인' : '회원가입'}</Text>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>닉네임</Text>
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                placeholder="닉네임을 입력해 주세요"
                placeholderTextColor="rgba(29,20,14,0.38)"
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>비밀번호</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="비밀번호를 입력해 주세요"
                  placeholderTextColor="rgba(29,20,14,0.38)"
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
            <Text style={styles.keepTitle}>로그인 상태 유지</Text>
            <View style={[styles.checkbox, keepSignedIn && styles.checkboxActive]}>
              {keepSignedIn ? <Text style={styles.checkboxMark}>✓</Text> : null}
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
              title={isLogin ? '회원가입 하기' : '로그인으로 이동'}
              onPress={() => onChangeMode(isLogin ? 'signup' : 'login')}
              variant="dark"
              disabled={isSubmitting}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 8,
  },
  authShell: {
    borderRadius: 34,
    overflow: 'hidden',
    backgroundColor: '#0f0d0b',
  },
  heroPanel: {
    backgroundColor: '#0f0d0b',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 28,
  },
  heroImage: {
    alignSelf: 'center',
  },
  formPanel: {
    flex: 1,
    marginTop: -30,
    backgroundColor: '#f7f3ee',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 24,
  },
  formTitle: {
    color: '#1d140e',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 18,
  },
  form: {
    gap: 14,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: '#2f2218',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,13,11,0.08)',
    backgroundColor: '#efe7de',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#1d140e',
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
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,13,11,0.08)',
    backgroundColor: '#efe7de',
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
    borderColor: '#2f2218',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  eyePupil: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#2f2218',
  },
  eyePupilHidden: {
    opacity: 0.45,
  },
  eyeSlash: {
    position: 'absolute',
    width: 24,
    height: 2,
    borderRadius: 999,
    backgroundColor: '#2f2218',
    transform: [{ rotate: '-38deg' }],
  },
  keepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    marginTop: 18,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(15,13,11,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#efe7de',
  },
  checkboxActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  checkboxMark: {
    color: '#24160b',
    fontSize: 13,
    fontWeight: '900',
  },
  keepTitle: {
    color: '#1d140e',
    fontSize: 14,
    fontWeight: '800',
  },
  errorText: {
    marginTop: 12,
    color: '#b44f55',
    fontSize: 13,
    lineHeight: 20,
  },
  actionRow: {
    gap: 10,
    marginTop: 18,
  },
  pressed: {
    opacity: 0.9,
  },
});
