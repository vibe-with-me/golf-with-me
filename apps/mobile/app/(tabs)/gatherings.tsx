import type { Gathering } from '@withme/contract';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ErrorText, Field, Muted, Title } from '../../components/ui';
import { api } from '../../lib/api';
import { parseLocalDateTime, tomorrowEvening, whenAndWhere } from '../../lib/format-time';
import { fonts, radius, space, useTokens } from '../../lib/tokens';

/**
 * The Events tab: gatherings you host or have joined, and a form to create
 * one. No browse surface — the only way into someone else's gathering is
 * their tag.
 */
export default function GatheringsScreen() {
  const t = useTokens();
  const [gatherings, setGatherings] = useState<Gathering[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState(tomorrowEvening);
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { gatherings: mine } = await api.app.gatherings.listMine();
      setGatherings(mine);
      setError(null);
    } catch {
      setError('Could not load. Pull to retry.');
    } finally {
      setLoaded(true);
    }
  }, []);

  // Re-load whenever the tab regains focus: a detail screen may have left,
  // edited, or deleted a gathering underneath this list.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function create() {
    if (busy) return;
    const startsAt = parseLocalDateTime(when.date, when.time);
    if (!startsAt) {
      setError('Enter the date as YYYY-MM-DD and the time as HH:MM.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.app.gatherings.create({
        title: title.trim(),
        starts_at: startsAt,
        location: location.trim() === '' ? null : location.trim(),
      });
      setTitle('');
      setLocation('');
      setWhen(tomorrowEvening());
      await load();
    } catch {
      setError('Could not create the gathering. Check the fields and try again.');
    } finally {
      setBusy(false);
    }
  }

  const now = Date.now();
  const upcoming = gatherings.filter((g) => Date.parse(g.starts_at) >= now);
  // most recent first
  const past = gatherings.filter((g) => Date.parse(g.starts_at) < now).toReversed();

  const row = (gathering: Gathering) => (
    <Pressable
      key={gathering.id}
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/gathering/[id]', params: { id: gathering.id } })}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: t.surface, borderColor: t.border },
        pressed && { opacity: 0.6 },
      ]}
    >
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, { color: t.ink }]}>{gathering.title}</Text>
        <Text numberOfLines={1} style={[styles.rowSub, { color: t.inkMuted }]}>
          {whenAndWhere(gathering)}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <Card>
        <Title>Create a gathering</Title>
        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          placeholder="e.g. Rooftop listening session"
        />
        <Field
          label="Date"
          value={when.date}
          onChangeText={(date) => setWhen({ ...when, date })}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          placeholder="2026-10-09"
        />
        <Field
          label="Time"
          value={when.time}
          onChangeText={(time) => setWhen({ ...when, time })}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          placeholder="18:00"
        />
        <Field
          label="Location (optional)"
          value={location}
          onChangeText={setLocation}
          maxLength={160}
          placeholder="Where to find it"
        />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button
          label={busy ? 'Creating…' : 'Create gathering'}
          onPress={create}
          disabled={busy || !title.trim() || !when.date.trim() || !when.time.trim()}
        />
      </Card>

      <Text style={[styles.sectionTitle, { color: t.ink }]}>Your gatherings</Text>
      {!loaded ? null : gatherings.length === 0 ? (
        <Muted>Tap a host's tag to join one, or create your own.</Muted>
      ) : upcoming.length === 0 ? (
        <Muted>Nothing coming up.</Muted>
      ) : (
        upcoming.map(row)
      )}
      {past.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: t.ink }]}>Past</Text>
          {past.map(row)}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.s5,
    paddingTop: space.s5,
    gap: space.s3,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: -0.2,
    marginTop: space.s4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingVertical: space.s3,
    paddingHorizontal: space.s4,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
  },
  rowSub: {
    fontFamily: fonts.body,
    fontSize: 14,
  },
});
