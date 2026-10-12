import { AVATAR_MAX_BYTES, avatarPublicUrl } from '@withme/contract';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Static access, so Expo inlines it at bundle time.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

/**
 * An avatar's URL from THIS app's configured Supabase URL; the database
 * stores only the path. Null (the initial) when unset, never a throw.
 */
export function avatarSrc(path: string | null): string | null {
  return path && supabaseUrl ? avatarPublicUrl(supabaseUrl, path) : null;
}

const SIZE = 512;

/**
 * Centre-crop a picked photo to a square and scale it to a 512px JPEG, then
 * read it back as a React Native Blob. Why XMLHttpRequest: RN cannot build a
 * Blob from bytes (`new Blob([ArrayBuffer])` throws, and Expo's fetch
 * `blob()` builds one exactly that way), while oRPC only sends values that
 * are `instanceof Blob` as multipart parts. An XHR with responseType 'blob'
 * yields a native-backed Blob; Expo's FormData patch names the part and
 * expo/fetch reads its bytes, so the API receives a File.
 */
export async function squareAvatar(asset: { uri: string; width: number; height: number }): Promise<File> {
  const side = Math.min(asset.width, asset.height);
  const image = await ImageManipulator.manipulate(asset.uri)
    .crop({
      originX: Math.floor((asset.width - side) / 2),
      originY: Math.floor((asset.height - side) / 2),
      width: side,
      height: side,
    })
    .resize({ width: SIZE, height: SIZE })
    .renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  const blob = await readBlob(saved.uri);
  if (blob.size === 0 || blob.size > AVATAR_MAX_BYTES) throw new Error('Unusable photo');
  // The contract types the part as a File; on the wire it is a multipart part either way.
  return blob as File;
}

function readBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.addEventListener('load', () => resolve(request.response as Blob));
    request.addEventListener('error', () => reject(new Error('Could not read the resized photo')));
    request.responseType = 'blob';
    request.open('GET', uri);
    request.send();
  });
}
