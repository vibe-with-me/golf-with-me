import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Supabase sessions (~2-4 KB) exceed expo-secure-store's documented 2048-byte
 * value limit, so storing them directly fails silently today and will throw
 * in a future SDK. The standard pattern (from Supabase's own Expo guide):
 * a per-key AES key lives in the keychain/keystore, the encrypted session
 * blob lives in AsyncStorage. Device-bound, backup-excluded, size-unlimited.
 */
const SECURE_KEY_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function encrypt(key: string, value: string): Promise<string> {
  const encryptionKey = Crypto.getRandomBytes(32);
  const counterSeed = Crypto.getRandomBytes(16);
  const cipher = new aesjs.ModeOfOperation.ctr(
    encryptionKey,
    new aesjs.Counter(counterSeed),
  );
  const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  await SecureStore.setItemAsync(
    key,
    aesjs.utils.hex.fromBytes(encryptionKey) + ':' + aesjs.utils.hex.fromBytes(counterSeed),
    SECURE_KEY_OPTIONS,
  );
  return aesjs.utils.hex.fromBytes(encrypted);
}

async function decrypt(key: string, hexValue: string): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(key);
  if (!stored) return null;
  const [keyHex, counterHex] = stored.split(':');
  if (!keyHex || !counterHex) return null;
  const cipher = new aesjs.ModeOfOperation.ctr(
    aesjs.utils.hex.toBytes(keyHex),
    new aesjs.Counter(aesjs.utils.hex.toBytes(counterHex)),
  );
  const decrypted = cipher.decrypt(aesjs.utils.hex.toBytes(hexValue));
  return aesjs.utils.utf8.fromBytes(decrypted);
}

export const sessionStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    try {
      return await decrypt(key, encrypted);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    const encrypted = await encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  },
  removeItem: async (key: string): Promise<void> => {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  },
};
