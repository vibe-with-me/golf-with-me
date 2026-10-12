export interface AvatarKind {
  ext: 'jpg' | 'webp';
  contentType: 'image/jpeg' | 'image/webp';
}

/**
 * JPEG (FF D8 FF) or WebP (RIFF....WEBP), by magic number. The declared type
 * and the file name are the client's claim; these bytes are the fact, and
 * they decide the stored extension and Content-Type. Anything else — PNG,
 * SVG, HTML — is refused before it reaches Storage.
 */
export function sniffAvatar(bytes: Uint8Array): AvatarKind | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' };
  }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
    return { ext: 'webp', contentType: 'image/webp' };
  }
  return null;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}
