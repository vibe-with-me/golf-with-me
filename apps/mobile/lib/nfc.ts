/**
 * Feature-gated NFC: react-native-nfc-manager is a native module, so it only
 * exists in development builds — in Expo Go these functions report
 * unavailable and the UI hides the scan affordance. Deep links and manual
 * UID entry work everywhere.
 */

interface NfcModule {
  isSupported(): Promise<boolean>;
  start(): Promise<void>;
  requestTechnology(tech: unknown): Promise<unknown>;
  getTag(): Promise<{ id?: string } | null>;
  cancelTechnologyRequest(): Promise<void>;
}

function loadNfc(): { manager: NfcModule; tech: unknown } | null {
  try {
    // Dynamic require: in Expo Go the JS loads but the native module is
    // absent; in that case treat NFC as unavailable.
    // oxlint-disable-next-line no-require-imports
    const mod = require('react-native-nfc-manager') as {
      default: NfcModule;
      NfcTech: { NfcA: unknown };
    };
    return { manager: mod.default, tech: mod.NfcTech.NfcA };
  } catch {
    return null;
  }
}

export async function isNfcAvailable(): Promise<boolean> {
  const nfc = loadNfc();
  if (!nfc) return false;
  try {
    return await nfc.manager.isSupported();
  } catch {
    return false;
  }
}

/** Reads one tag and returns its UID as uppercase hex, or null on cancel/failure. */
export async function readTagUid(): Promise<string | null> {
  const nfc = loadNfc();
  if (!nfc) return null;
  try {
    await nfc.manager.start();
    await nfc.manager.requestTechnology(nfc.tech);
    const tag = await nfc.manager.getTag();
    return tag?.id ? tag.id.toUpperCase() : null;
  } catch {
    return null;
  } finally {
    await nfc.manager.cancelTechnologyRequest().catch(() => undefined);
  }
}
