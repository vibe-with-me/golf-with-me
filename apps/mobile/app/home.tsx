import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Linking } from 'react-native';
import { Button, Card, Muted } from '../components/ui';

// Fulfillment pointer — dormant until the store URL is configured.
const GET_TAGS_URL = process.env.EXPO_PUBLIC_GET_TAGS_URL;
import { fonts, space, useTokens } from '../lib/tokens';

export default function HomeScreen() {
  const t = useTokens();
  return (
    <View style={[styles.page, { backgroundColor: t.bg }]}>
      <Card>
        <Text style={[styles.wordmark, { color: t.ink }]}>withme</Text>
        <Muted>Tap a tag. Meet a person. Stay connected.</Muted>
        <Button label="Connections" onPress={() => router.push('/connections')} />
        <Button label="My profile" onPress={() => router.push('/me')} />
        <Button label="Scan a tag" kind="quiet" onPress={() => router.push('/scan')} />
        {GET_TAGS_URL ? (
          <Button
            label="Get tags"
            kind="quiet"
            onPress={() => Linking.openURL(GET_TAGS_URL).catch(() => undefined)}
          />
        ) : null}
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
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 34,
    letterSpacing: -0.7,
  },
});
