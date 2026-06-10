import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Button, Card, Field, Muted, Title } from '../components/ui';
import { isNfcAvailable, readTagUid } from '../lib/nfc';
import { space, useTokens } from '../lib/tokens';

/**
 * Scan entry point. Native NFC reading appears only in development builds
 * (react-native-nfc-manager is feature-gated); manual UID entry works
 * everywhere, including Expo Go.
 */
function open(value: string) {
  const cleaned = value.trim().toUpperCase();
  if (cleaned) {
    router.push({ pathname: '/t/[uid]', params: { uid: cleaned } });
  }
}

export default function ScanScreen() {
  const t = useTokens();
  const [uid, setUid] = useState('');
  const [nfcReady, setNfcReady] = useState(false);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    isNfcAvailable().then(setNfcReady);
  }, []);

  return (
    <KeyboardAvoidingView
      style={[styles.page, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Card>
        <Title>Scan a tag</Title>
        {nfcReady ? (
          <Button
            kind="connect"
            label={reading ? 'Hold near the tag…' : 'Read NFC tag'}
            disabled={reading}
            onPress={async () => {
              setReading(true);
              const tagUid = await readTagUid();
              setReading(false);
              if (tagUid) open(tagUid);
            }}
          />
        ) : (
          <Muted>
            NFC reading needs a development build — in Expo Go, type the UID printed on the tag.
          </Muted>
        )}
        <Field
          label="Tag UID"
          value={uid}
          onChangeText={setUid}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="04A3B2C1D05E80"
        />
        <Button label="Open" onPress={() => open(uid)} disabled={!uid.trim()} />
        <Button label="Back" kind="quiet" onPress={() => router.back()} />
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
