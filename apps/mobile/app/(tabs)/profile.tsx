import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { AccountSection } from '../../components/AccountSection';
import { AvatarPicker } from '../../components/AvatarPicker';
import { Links } from '../../components/Links';
import { MyTags } from '../../components/MyTags';
import { Button, Card, ErrorText, Field, Title } from '../../components/ui';
import { formatHandicap, isProfileComplete, parseHandicap, type Profile } from '@withme/contract';
import { api } from '../../lib/api';
import { safeRedirect } from '../../lib/safe-redirect';
import { space, useTokens } from '../../lib/tokens';

export default function ProfileScreen() {
  const t = useTokens();
  const params = useLocalSearchParams<{ redirect?: string }>();
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [exists, setExists] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [handicap, setHandicap] = useState('');
  const [handicapError, setHandicapError] = useState(false);
  const [homeCourse, setHomeCourse] = useState('');
  const [current, setCurrent] = useState<Profile | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Unsaved typing survives a focus reload: the reload refreshes the form
  // only while it holds no edits. `draft` counts edits, so a save clears the
  // flag only if nothing was typed while it was in flight.
  const draft = useRef({ dirty: false, revision: 0 });
  const edit = (set: (value: string) => void) => (value: string) => {
    draft.current = { dirty: true, revision: draft.current.revision + 1 };
    set(value);
  };

  // Each load gets a generation; only the latest may touch state, so a slow
  // answer from an earlier focus never lands over a newer one.
  const loadGeneration = useRef(0);
  const load = useCallback(() => {
    const generation = ++loadGeneration.current;
    setLoadFailed(false);
    api.app.profile
      .get()
      .then(({ profile }: { profile: Profile | null }) => {
        if (generation !== loadGeneration.current) return;
        const keepDraft = draft.current.dirty;
        if (profile) {
          setExists(true);
          if (!keepDraft) {
            setDisplayName(profile.display_name);
            setBio(profile.bio ?? '');
            setHandicap(profile.handicap === null ? '' : formatHandicap(profile.handicap));
            setHomeCourse(profile.home_course ?? '');
          }
          setAvatarPath(profile.avatar_path);
          setCurrent(profile);
        } else {
          setExists(false);
          setCurrent(null);
          if (!keepDraft) {
            setDisplayName('');
            setBio('');
            setHandicap('');
            setHomeCourse('');
          }
          setAvatarPath(null);
        }
        setLoaded(true);
      })
      // A failed load must NOT render the blank create form: saving it
      // would silently overwrite the existing profile.
      .catch(() => {
        if (generation === loadGeneration.current) setLoadFailed(true);
      });
  }, []);
  // On every focus, not once: a tab stays mounted, so a load on mount alone
  // would keep showing (and the next Save would write back) values changed
  // since on another device. Web's loader re-reads on every visit the same way.
  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        loadGeneration.current += 1;
      };
    }, [load]),
  );

  async function save() {
    // Parse first: an undefined key would be dropped by the input schema and
    // the screen would say "Saved." over a handicap it threw away.
    const parsedHandicap = parseHandicap(handicap);
    if (parsedHandicap === undefined) {
      setHandicapError(true);
      setStatus(null);
      return;
    }
    setHandicapError(false);
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const revision = draft.current.revision;
      const saved = await api.app.profile.update({
        display_name: displayName.trim(),
        bio: bio.trim() === '' ? null : bio.trim(),
        handicap: parsedHandicap,
        home_course: homeCourse.trim() === '' ? null : homeCourse.trim(),
      });
      if (draft.current.revision === revision) draft.current = { dirty: false, revision };
      setCurrent(saved.profile);
      setHandicap(saved.profile.handicap === null ? '' : formatHandicap(saved.profile.handicap));
      const redirect = safeRedirect(params.redirect);
      if (redirect) {
        router.setParams({ redirect: undefined });
        // Pop back to the resolver that sent us here; it is still mounted below.
        router.dismissTo(redirect);
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

  if (loadFailed) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }}>
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <Title>Couldn't load your profile</Title>
            <ErrorText>Check your connection and try again.</ErrorText>
            <Button label="Retry" onPress={load} />
          </Card>
          {/* Signing out stays possible when the load fails. */}
          <AccountSection />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (!loaded) return null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Title>
            {!current
              ? 'Create your profile'
              : isProfileComplete(current)
                ? 'Your profile'
                : 'Finish your profile'}
          </Title>
          {/* The photo lives on the profile row: it needs the row to exist first. */}
          {exists ? (
            <AvatarPicker
              name={displayName}
              path={avatarPath}
              onChange={(profile) => setAvatarPath(profile.avatar_path)}
            />
          ) : null}
          <Field label="Name" value={displayName} onChangeText={edit(setDisplayName)} maxLength={80} />
          <Field
            label="Bio"
            value={bio}
            onChangeText={edit(setBio)}
            maxLength={280}
            multiline
            placeholder="A line or two about you"
          />
          <Field
            label="Handicap"
            value={handicap}
            onChangeText={edit(setHandicap)}
            maxLength={5}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            placeholder="e.g. 14.2, or +2.4"
          />
          {handicapError ? (
            <ErrorText>A handicap index from +10.0 to 54.0, one decimal at most.</ErrorText>
          ) : null}
          <Field
            label="Home course"
            value={homeCourse}
            onChangeText={edit(setHomeCourse)}
            maxLength={80}
            placeholder="e.g. Riverside Muni"
          />
          {status ? (
            <Text accessibilityRole="text" style={{ color: t.inkMuted }}>
              {status}
            </Text>
          ) : null}
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button label={busy ? 'Saving…' : 'Save'} onPress={save} disabled={busy || !displayName.trim()} />
        </Card>
        {/* Links hang off the profile row: it needs the row to exist first. */}
        {exists ? <Links /> : null}
        {exists ? <MyTags /> : null}
        <AccountSection />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.s5, gap: space.s4 },
});
