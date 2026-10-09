import type { Destination, Gathering, GatheringMember, Tag } from '@withme/contract';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, Card, ErrorText, Field, Muted, Title } from '../../components/ui';
import { api } from '../../lib/api';
import {
  formatStartsAt,
  parseLocalDateTime,
  toDateAndTime,
  whenAndWhere,
} from '../../lib/format-time';
import { gatheringHref } from '../../lib/gathering-link';
import { supabase } from '../../lib/supabase';
import { fonts, radius, space, useTokens } from '../../lib/tokens';

type ScreenState =
  | { kind: 'loading' }
  | { kind: 'failed' }
  // Non-member, blocked, or missing — all the same NOT_FOUND, so the screen
  // offers a calm join instead of an error.
  | { kind: 'join' }
  | { kind: 'detail'; gathering: Gathering; members: GatheringMember[]; userId: string | null };

/** The detail is a stack screen: it pushes over the tab bar (docs/the-slice.md step 6). */
/**
 * Back, or to the Events tab when there is nothing to go back to: after a
 * login redirect or a cold deep link this screen is the whole stack.
 */
function goBack() {
  if (router.canGoBack()) router.back();
  else router.dismissTo('/gatherings');
}

export default function GatheringScreen() {
  const t = useTokens();
  // title/starts_at are display-only hints from the resolver — never data.
  const params = useLocalSearchParams<{ id: string; title?: string; starts_at?: string }>();
  const id = (params.id ?? '').trim();
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });
  const [join, setJoin] = useState<'idle' | 'joining' | 'failed' | 'unavailable'>('idle');

  const load = useCallback(async () => {
    try {
      const [{ gathering, members }, { data }] = await Promise.all([
        api.app.gatherings.get({ id }),
        supabase.auth.getSession(),
      ]);
      setState({ kind: 'detail', gathering, members, userId: data.session?.user.id ?? null });
    } catch (error) {
      setState((error as { code?: string }).code === 'NOT_FOUND' ? { kind: 'join' } : { kind: 'failed' });
    }
  }, [id]);

  // On focus, not mount: the join card pushes /profile and this screen stays
  // mounted underneath, so coming back must re-read who we are to it.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (state.kind === 'loading') {
    return <View style={[styles.page, { backgroundColor: t.bg }]} />;
  }

  if (state.kind === 'failed') {
    return (
      <View style={[styles.page, { backgroundColor: t.bg }]}>
        <Card>
          <Title>Couldn't load this gathering</Title>
          <ErrorText>Check your connection and try again.</ErrorText>
          <Button label="Retry" onPress={load} />
          <Button label="Back" kind="quiet" onPress={goBack} />
        </Card>
      </View>
    );
  }

  if (state.kind === 'join') {
    const hint = [params.title ?? null, params.starts_at ? formatStartsAt(params.starts_at) : null]
      .filter(Boolean)
      .join(' · ');
    return (
      <View style={[styles.page, { backgroundColor: t.bg }]}>
        <Card settle>
          <Title>Join this gathering?</Title>
          {hint ? <Muted>{hint}</Muted> : null}
          {join === 'unavailable' ? (
            <Muted>This gathering isn't available.</Muted>
          ) : (
            <Button
              kind="connect"
              disabled={join === 'joining'}
              label={join === 'joining' ? 'Joining…' : join === 'failed' ? 'Try again' : 'Join'}
              onPress={async () => {
                setJoin('joining');
                try {
                  // Members see your card, so a profile must exist before you join.
                  const { profile } = await api.app.profile.get();
                  if (!profile) {
                    setJoin('idle'); // this screen stays mounted under the push
                    // The hints ride along so the join card comes back as it was.
                    router.push({
                      pathname: '/profile',
                      params: {
                        redirect: gatheringHref(id, { title: params.title, starts_at: params.starts_at }),
                      },
                    });
                    return;
                  }
                  await api.app.gatherings.join({ id });
                  await load();
                } catch (error) {
                  setJoin((error as { code?: string }).code === 'NOT_FOUND' ? 'unavailable' : 'failed');
                }
              }}
            />
          )}
          <Button label="Back" kind="quiet" onPress={goBack} />
        </Card>
      </View>
    );
  }

  return <GatheringDetail {...state} reload={load} />;
}

interface GatheringPatch {
  title: string;
  starts_at: string;
  location: string | null;
}

function GatheringDetail({
  gathering,
  members,
  userId,
  reload,
}: {
  gathering: Gathering;
  members: GatheringMember[];
  userId: string | null;
  reload: () => Promise<void>;
}) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const isHost = userId === gathering.host_id;
  const isMember = userId !== null && members.some((member) => member.profile.id === userId);

  async function run(work: () => Promise<unknown>, then: 'reload' | 'list') {
    setBusy(true);
    setActionError(null);
    try {
      await work();
      if (then === 'list') {
        // Pop back to the tabs if they are below us; on a cold deep link,
        // replace this screen with them. Never stack a second tab shell.
        router.dismissTo('/gatherings');
        return;
      }
      await reload();
      setEditing(false);
    } catch {
      setActionError("That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete this gathering?',
      'Members lose it, and tags pointing here fall back to your profile.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => run(() => api.app.gatherings.remove({ id: gathering.id }), 'list'),
        },
      ],
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        // No stack header on this screen, so clear the status bar ourselves.
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.s5 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Card>
          {editing ? (
            <EditFields
              gathering={gathering}
              busy={busy}
              onCancel={() => setEditing(false)}
              onSave={(patch) =>
                run(() => api.app.gatherings.update({ id: gathering.id, ...patch }), 'reload')
              }
            />
          ) : (
            <>
              <Title>{gathering.title}</Title>
              <Muted>{whenAndWhere(gathering)}</Muted>
            </>
          )}
          {/* Outside the ternary so Edit/Cancel keeps its tags instead of refetching. */}
          <TagPointer gatheringId={gathering.id} hidden={editing} />
          {actionError ? <ErrorText>{actionError}</ErrorText> : null}
          {!editing && isHost ? (
            <>
              <Button label="Edit" kind="quiet" disabled={busy} onPress={() => setEditing(true)} />
              <Button label="Delete gathering" kind="quiet" disabled={busy} onPress={confirmDelete} />
            </>
          ) : null}
          {!editing && isMember && !isHost ? (
            <Button
              label={busy ? 'Leaving…' : 'Leave gathering'}
              kind="quiet"
              disabled={busy}
              onPress={() => run(() => api.app.gatherings.leave({ id: gathering.id }), 'list')}
            />
          ) : null}
          {!editing ? <Button label="Back" kind="quiet" onPress={goBack} /> : null}
        </Card>

        <Text style={[styles.sectionTitle, { color: t.ink }]}>Who's coming</Text>
        {members.map((member) => (
          <View
            key={member.profile.id}
            style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}
          >
            <Avatar name={member.profile.display_name} url={member.profile.avatar_url} size={44} />
            <View style={styles.rowBody}>
              <Text style={[styles.rowName, { color: t.ink }]}>{member.profile.display_name}</Text>
              {member.profile.bio ? (
                <Text numberOfLines={1} style={[styles.rowSub, { color: t.inkMuted }]}>
                  {member.profile.bio}
                </Text>
              ) : null}
            </View>
            {member.profile.id === gathering.host_id ? (
              <Text style={[styles.rowSub, { color: t.inkMuted }]}>Host</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function EditFields({
  gathering,
  busy,
  onSave,
  onCancel,
}: {
  gathering: Gathering;
  busy: boolean;
  onSave: (patch: GatheringPatch) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(gathering.title);
  const [when, setWhen] = useState(() => toDateAndTime(new Date(gathering.starts_at)));
  const [location, setLocation] = useState(gathering.location ?? '');
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Field label="Title" value={title} onChangeText={setTitle} maxLength={120} />
      <Field
        label="Date"
        value={when.date}
        onChangeText={(date) => setWhen((w) => ({ ...w, date }))}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
      />
      <Field
        label="Time"
        value={when.time}
        onChangeText={(time) => setWhen((w) => ({ ...w, time }))}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
      />
      <Field label="Location (optional)" value={location} onChangeText={setLocation} maxLength={160} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button
        label={busy ? 'Saving…' : 'Save'}
        disabled={busy || !title.trim()}
        onPress={() => {
          const startsAt = parseLocalDateTime(when.date, when.time);
          if (!startsAt) {
            setError('Enter the date as YYYY-MM-DD and the time as HH:MM.');
            return;
          }
          setError(null);
          onSave({
            title: title.trim(),
            starts_at: startsAt,
            location: location.trim() === '' ? null : location.trim(),
          });
        }}
      />
      <Button label="Cancel" kind="quiet" disabled={busy} onPress={onCancel} />
    </>
  );
}

/**
 * Members aim their own claimed tags at this gathering so a tap joins it.
 * Through the contract (app.tags.listMine / app.tags.update) — the mobile
 * app's only data path is the API, same as web. `hidden` keeps the component
 * (and its fetched tags) mounted while the host edits.
 */
function TagPointer({ gatheringId, hidden }: { gatheringId: string; hidden: boolean }) {
  const [tags, setTags] = useState<Tag[] | 'loading' | 'failed'>('loading');
  const [busy, setBusy] = useState(false);
  const [pointError, setPointError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { tags: mine } = await api.app.tags.listMine();
      setTags(mine.filter((tag) => tag.status === 'claimed'));
    } catch {
      setTags('failed');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (hidden || tags === 'loading' || tags === 'failed') return null;
  if (tags.length === 0) return <Muted>Claim a tag to point it at this gathering.</Muted>;

  const pointsHere = (tag: Tag) =>
    tag.destination?.type === 'gathering' && tag.destination.gathering_id === gatheringId;
  const here = tags.filter(pointsHere);
  const elsewhere = tags.filter((tag) => !pointsHere(tag));

  async function repoint(targets: Tag[], destination: Destination) {
    setBusy(true);
    setPointError(null);
    const results = await Promise.allSettled(
      targets.map((tag) => api.app.tags.update({ uid: tag.uid, destination })),
    );
    if (results.some((result) => result.status === 'rejected')) {
      setPointError("That didn't go through. Try again.");
    }
    await load();
    setBusy(false);
  }

  return (
    <>
      {here.length > 0 ? (
        <Button
          label="Point my tags back to my profile"
          disabled={busy}
          onPress={() => repoint(here, { type: 'profile' })}
        />
      ) : null}
      {elsewhere.length > 0 ? (
        <Button
          label="Point my tags at this gathering"
          disabled={busy}
          onPress={() => repoint(elsewhere, { type: 'gathering', gathering_id: gatheringId })}
        />
      ) : null}
      {pointError ? <ErrorText>{pointError}</ErrorText> : null}
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: space.s5 },
  content: { padding: space.s5, gap: space.s3 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.2, marginTop: space.s4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingVertical: space.s3,
    paddingHorizontal: space.s4,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: fonts.bodySemiBold, fontSize: 16 },
  rowSub: { fontFamily: fonts.body, fontSize: 14 },
});
