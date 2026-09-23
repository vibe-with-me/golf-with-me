import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Muted, Title } from '../../components/ui';
import { space, useTokens } from '../../lib/tokens';

const STORE_URL = process.env.EXPO_PUBLIC_STORE_URL;

/** The fulfillment pointer as a tab: one card, one link out. No commerce here. */
export default function MerchScreen() {
  const t = useTokens();
  if (!STORE_URL) return <Redirect href="/connections" />;
  return (
    <View style={[styles.page, { backgroundColor: t.bg }]}>
      <Card>
        <Title>Merch</Title>
        <Muted>Tags and gear from the store.</Muted>
        <Button
          label="Open store"
          onPress={() => {
            WebBrowser.openBrowserAsync(STORE_URL).catch(() => undefined);
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
