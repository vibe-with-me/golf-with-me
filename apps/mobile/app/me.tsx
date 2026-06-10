import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { Button, Card, ErrorText, Field, Title } from '../components/ui';
import type { Profile } from '@withme/contract';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { space, useTokens } from '../lib/tokens';

function safeRedirect(value: unknown): string | undefined {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : undefined;
}

async function signOut() {
  await supabase.auth.signOut();
  router.replace('/login');
}

export default function MeScreen() {
  const t = useTokens();
  const params = useLocalSearchParams<{ redirect?: string }>();
  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.app.profile
      .get()
      .then(({ profile }: { profile: Profile | null }) => {
        if (profile) {
          setExists(true);
          setDisplayName(profile.display_name);
          setBio(profile.bio ?? '');
          setAvatarUrl(profile.avatar_url ?? '');
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function save() {
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      await api.app.profile.update({
        display_name: displayName.trim(),
        bio: bio.trim() === '' ? null : bio.trim(),
        avatar_url: avatarUrl.trim() === '' ? null : avatarUrl.trim(),
      });
      const redirect = safeRedirect(params.redirect);
      if (redirect) {
        router.replace(redirect as never);
        return;
      }
      setExists(true);
      setStatus('Saved.');
    } catch {
      setError('Could not save. Check the fields and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Title>{exists ? 'Your profile' : 'Create your profile'}</Title>
          <Field label="Name" value={displayName} onChangeText={setDisplayName} maxLength={80} />
          <Field
            label="Bio"
            value={bio}
            onChangeText={setBio}
            maxLength={280}
            multiline
            placeholder="A line or two about you"
          />
          <Field
            label="Avatar URL"
            value={avatarUrl}
            onChangeText={setAvatarUrl}
            autoCapitalize="none"
            placeholder="https://…"
            keyboardType="url"
          />
          {status ? (
            <Text accessibilityRole="text" style={{ color: t.inkMuted }}>
              {status}
            </Text>
          ) : null}
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button label={busy ? 'Saving…' : 'Save'} onPress={save} disabled={busy || !displayName.trim()} />
          <Button label="Sign out" kind="quiet" onPress={signOut} />
          <Button label="Back" kind="quiet" onPress={() => router.back()} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: space.s5,
  },
});
