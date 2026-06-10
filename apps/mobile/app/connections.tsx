import type { ConnectRequest, Connection } from '@withme/contract';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, ErrorText, Muted } from '../components/ui';
import { api } from '../lib/api';
import { fonts, radius, space, useTokens } from '../lib/tokens';

interface BlockRow {
  user: { id: string; display_name: string; avatar_url: string | null; bio: string | null };
  created_at: string;
}

export default function ConnectionsScreen() {
  const t = useTokens();
  const [pending, setPending] = useState<ConnectRequest[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, c, b] = await Promise.all([
        api.app.requests.listPending(),
        api.app.connections.list(),
        api.app.blocks.list(),
      ]);
      setPending(p.requests);
      setConnections(c.connections);
      setBlocks(b.blocks);
    } catch {
      setError('Could not load. Pull to retry.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, work: () => Promise<unknown>) {
    setBusyIds((prev) => new Set(prev).add(id));
    setError(null);
    try {
      await work();
      await load();
    } catch {
      setError("That didn't go through. Try again.");
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  const row = (key: string, profile: BlockRow['user'], actions: React.ReactNode) => (
    <View key={key} style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Avatar name={profile.display_name} url={profile.avatar_url} size={44} />
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, { color: t.ink }]}>{profile.display_name}</Text>
        {profile.bio ? (
          <Text numberOfLines={1} style={[styles.rowSub, { color: t.inkMuted }]}>
            {profile.bio}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowActions}>{actions}</View>
    </View>
  );

  const quiet = (label: string, id: string, work: () => Promise<unknown>) => (
    <Button label={label} kind="quiet" disabled={busyIds.has(id)} onPress={() => act(id, work)} />
  );

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.content}
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
      {error ? <ErrorText>{error}</ErrorText> : null}

      {pending.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: t.ink }]}>Requests</Text>
          {pending.map((request) =>
            row(
              request.id,
              request.requester,
              <>
                {quiet('Accept', request.id, () => api.app.requests.accept({ id: request.id }))}
                {quiet('Decline', request.id, () => api.app.requests.decline({ id: request.id }))}
              </>,
            ),
          )}
        </>
      ) : null}

      <Text style={[styles.sectionTitle, { color: t.ink }]}>Connections</Text>
      {connections.length === 0 ? (
        <Muted>No connections yet. Tap someone's tag to start.</Muted>
      ) : (
        connections.map((connection) =>
          row(
            connection.id,
            connection.profile,
            <>
              {quiet('Remove', connection.id, () =>
                api.app.connections.remove({ id: connection.id }),
              )}
              {quiet('Block', connection.id, () =>
                api.app.blocks.block({ user_id: connection.profile.id }),
              )}
            </>,
          ),
        )
      )}

      {blocks.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: t.ink }]}>Blocked</Text>
          {blocks.map((block) =>
            row(
              block.user.id,
              block.user,
              quiet('Unblock', block.user.id, () =>
                api.app.blocks.unblock({ user_id: block.user.id }),
              ),
            ),
          )}
        </>
      ) : null}

      <Button label="Back" kind="quiet" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.s5,
    paddingTop: space.s7 + space.s4,
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
  rowActions: {
    flexDirection: 'row',
  },
});
