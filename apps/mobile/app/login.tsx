import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, Card, ErrorText, Field, Muted, Title } from '../components/ui';
import { supabase } from '../lib/supabase';
import { space, useTokens } from '../lib/tokens';

/** Same-app paths only — mirrors the web's safeReturnTo guard. */
function safeRedirect(value: unknown): string | undefined {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : undefined;
}

export default function LoginScreen() {
  const t = useTokens();
  const params = useLocalSearchParams<{ redirect?: string }>();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const { data, error: authError } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    if (mode === 'signup' && !data.session) {
      setAwaitingConfirmation(true);
      return;
    }
    router.replace((safeRedirect(params.redirect) ?? '/home') as never);
  }

  if (awaitingConfirmation) {
    return (
      <View style={[styles.page, { backgroundColor: t.bg }]}>
        <Card>
          <Title>Check your email</Title>
          <Muted>We sent a confirmation link to {email}. Come back after clicking it.</Muted>
        </Card>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.page, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Card>
        <Title>{mode === 'signin' ? 'Sign in' : 'Create account'}</Title>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
        />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button
          label={busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          onPress={submit}
          disabled={busy || !email || password.length < 8}
        />
        <Button
          label={mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
          kind="quiet"
          onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        />
      </Card>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    padding: space.s5,
  },
});
