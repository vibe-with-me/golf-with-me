import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Button, Card, ErrorText, Field, Muted, Title } from '../../components/ui';
import type { Profile } from '@withme/contract';
import { api } from '../../lib/api';
import { space, useTokens } from '../../lib/tokens';

export default function ClaimScreen() {
  const t = useTokens();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.app.profile
      .get()
      .then(({ profile }: { profile: Profile | null }) => setHasProfile(profile !== null))
      .catch(() => setHasProfile(false));
  }, []);

  async function createProfile() {
    setBusy(true);
    setError(null);
    try {
      await api.app.profile.update({ display_name: displayName.trim() });
      setHasProfile(true);
    } catch {
      setError('Could not save your name. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      await api.public.claim({ uid: (uid ?? '').trim().toUpperCase() });
      router.replace({ pathname: '/t/[uid]', params: { uid: (uid ?? '').toUpperCase() } });
    } catch (claimError) {
      const code = (claimError as { code?: string }).code;
      setError(
        code === 'CONFLICT'
          ? 'This tag has already been claimed.'
          : code === 'NOT_FOUND'
            ? 'This tag is not registered.'
            : 'Something went wrong. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (hasProfile === null) return null;

  if (!hasProfile) {
    return (
      <KeyboardAvoidingView
        style={[styles.page, { backgroundColor: t.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Card>
          <Title>First, your name</Title>
          <Muted>This is what people see when they tap your tag.</Muted>
          <Field label="Name" value={displayName} onChangeText={setDisplayName} maxLength={80} />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button
            label="Continue"
            onPress={createProfile}
            disabled={busy || !displayName.trim()}
          />
        </Card>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.page, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Card>
        <Title>Claim this tag</Title>
        <Muted>
          Tag {uid?.toUpperCase()} will point to your profile. You can disable it any time.
        </Muted>
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button kind="connect" label={busy ? 'Claiming…' : 'Claim tag'} onPress={claim} disabled={busy} />
        <Button label="Cancel" kind="quiet" onPress={() => router.back()} />
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
