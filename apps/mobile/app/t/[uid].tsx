import type { ResolveOutput } from '@withme/contract';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Muted, Title } from '../../components/ui';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { space, useTokens } from '../../lib/tokens';

/**
 * The resolver — a physical tap (deep link) or a scan lands here and a
 * person appears. Unknown and malformed UIDs land on a calm card, never a
 * crash.
 */
export default function ResolveScreen() {
  const t = useTokens();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const [result, setResult] = useState<ResolveOutput | 'error' | null>(null);

  useEffect(() => {
    let cancelled = false;
    const normalized = (uid ?? '').trim().toUpperCase();
    Promise.all([
      api.public.resolve({ uid: normalized }),
      // A scan is logged for real taps; failures never break the resolve.
      api.public
        .logScan({ uid: normalized, user_agent: `withme-mobile/${Platform.OS}` })
        .catch(() => undefined),
    ])
      .then(async ([resolved]) => {
        if (cancelled) return;
        if (resolved.status === 'unclaimed') {
          // claim/[uid] is auth-gated: a signed-out user routed there would
          // bounce to login WITHOUT the uid. Carry it through explicitly.
          const { data } = await supabase.auth.getSession();
          if (cancelled) return;
          if (data.session) {
            router.replace({ pathname: '/claim/[uid]', params: { uid: resolved.uid } });
          } else {
            router.replace({
              pathname: '/login',
              params: { redirect: `/claim/${resolved.uid}` },
            });
          }
          return;
        }
        setResult(resolved);
      })
      .catch(() => {
        if (!cancelled) setResult('error');
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  if (result === null) {
    // The card arrives before its contents: an empty shell the settle
    // fills. A blank screen on venue Wi-Fi reads as a broken tag.
    return (
      <View style={[styles.page, { backgroundColor: t.bg }]} accessibilityLabel="Loading">
        <Card>
          <View
            style={[styles.avatarShell, { backgroundColor: t.border }]}
            accessibilityElementsHidden
          />
        </Card>
      </View>
    );
  }

  if (result === 'error' || result.status === 'disabled') {
    return (
      <View style={[styles.page, { backgroundColor: t.bg }]}>
        <Card settle>
          <Title>{result === 'error' ? 'Nothing here' : 'This tag is inactive'}</Title>
          <Muted>
            {result === 'error'
              ? "This doesn't look like a live tag. Give it another tap in a moment."
              : "There's nothing connected to it right now."}
          </Muted>
          <Button label="Close" kind="quiet" onPress={() => router.replace('/')} />
        </Card>
      </View>
    );
  }

  // 'unclaimed' has already triggered the claim redirect; render nothing
  // for the in-between frame.
  if (result.status !== 'claimed') return null;

  return (
    <View style={[styles.page, { backgroundColor: t.bg }]}>
      <Card settle>
        <Avatar name={result.profile.display_name} url={result.profile.avatar_url} />
        <Title>{result.profile.display_name}</Title>
        {result.profile.bio ? <Muted>{result.profile.bio}</Muted> : null}
        <ConnectAction profileId={result.profile.id} uid={result.uid} />
      </Card>
    </View>
  );
}

function ConnectAction({ profileId, uid }: { profileId: string; uid: string }) {
  const [viewer, setViewer] = useState<'loading' | 'anon' | 'self' | 'other'>('loading');
  const [send, setSend] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const inFlight = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user.id;
      if (!userId) setViewer('anon');
      else if (userId === profileId) setViewer('self');
      else setViewer('other');
    });
  }, [profileId]);

  if (viewer === 'self') {
    return (
      <>
        <Muted>This is your tag.</Muted>
        <Button label="Edit profile" onPress={() => router.push('/me')} />
      </>
    );
  }

  if (send === 'sent') {
    return <Muted>Request sent. They'll see it when they check in.</Muted>;
  }

  return (
    <Button
      kind="connect"
      disabled={viewer === 'loading' || send === 'sending'}
      label={send === 'sending' ? 'Connecting…' : send === 'failed' ? 'Try again' : 'Connect'}
      onPress={async () => {
        if (viewer === 'anon') {
          router.push({ pathname: '/login', params: { redirect: `/t/${uid}` } });
          return;
        }
        // ref guard: two taps in one frame both pass the disabled check
        if (inFlight.current) return;
        inFlight.current = true;
        setSend('sending');
        try {
          // Consent is mutual: your card must exist before you can ask.
          const { profile } = await api.app.profile.get();
          if (!profile) {
            setSend('idle'); // this screen stays mounted under the push
            router.push({ pathname: '/me', params: { redirect: `/t/${uid}` } });
            return;
          }
          await api.app.requests.send({ recipient_id: profileId });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setSend('sent');
        } catch {
          setSend('failed');
        } finally {
          inFlight.current = false;
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    padding: space.s5,
  },
  avatarShell: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
});
