import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Button, Card, ErrorText, Muted, Title } from '../../components/ui';
import { space, useTokens } from '../../lib/tokens';

const STORE_URL = process.env.EXPO_PUBLIC_STORE_URL;

/**
 * Opens the store in the in-app browser, or the system browser if that is
 * not available. The in-app browser is a native module loaded on demand, so
 * an app binary built before it was added still gets a working button.
 */
async function openStore(url: string): Promise<void> {
  try {
    const WebBrowser = await import('expo-web-browser');
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await Linking.openURL(url);
  }
}

/** The fulfillment pointer as a tab: one card, one link out. No commerce here. */
export default function MerchScreen() {
  const t = useTokens();
  const [failed, setFailed] = useState(false);
  if (!STORE_URL) return <Redirect href="/gatherings" />;
  return (
    <View style={[styles.page, { backgroundColor: t.bg }]}>
      <Card>
        <Title>Merch</Title>
        <Muted>Ball markers, bag tags and divot tools.</Muted>
        {failed ? <ErrorText>Couldn't open the store. Try again in a moment.</ErrorText> : null}
        <Button
          label="Open store"
          onPress={() => {
            setFailed(false);
            openStore(STORE_URL).catch(() => setFailed(true));
          }}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    padding: space.s5,
  },
});
