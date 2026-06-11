/**
 * Same-app paths only — identical policy to the web's safeReturnTo:
 * leading '/', no '//', no backslashes or control chars (browsers normalize
 * '\' to '/'), and a sane length cap for deep-link-supplied values.
 */
export function safeRedirect(value: unknown): string | undefined {
  return typeof value === 'string' &&
    value.length <= 512 &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    // oxlint-disable-next-line no-control-regex -- rejecting control chars is the point
    !/[\\\u0000-\u001f]/.test(value)
    ? value
    : undefined;
}
