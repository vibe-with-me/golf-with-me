export interface GatheringHints {
  title?: string;
  course_name?: string;
  starts_at?: string;
}

/**
 * The detail screen's href as a string, carrying the resolver's display-only
 * hints. It is used where the href travels as a redirect (through login, or
 * through the profile screen), and such a string is decoded twice before the
 * detail screen reads it: once into the redirect param, once when the router
 * parses the href. So the title drops what a second decode would misread
 * (& # + % ?) and what safeRedirect refuses (\ and control characters), and
 * the start time travels as a UTC instant, which has no '+'. Lossy is fine:
 * a hint is never data.
 */
/** A hint as it may travel twice-decoded: see gatheringHref. */
function safeHint(value: string): string {
  return (
    value
      // oxlint-disable-next-line no-control-regex -- stripping control chars is the point
      .replace(/[\\\u0000-\u001f#&+%?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60)
  );
}

export function gatheringHref(id: string, hints: GatheringHints = {}): string {
  const query: string[] = [];
  if (hints.title) {
    const title = safeHint(hints.title);
    if (title) query.push(`title=${encodeURIComponent(title)}`);
  }
  if (hints.course_name) {
    const course = safeHint(hints.course_name);
    if (course) query.push(`course_name=${encodeURIComponent(course)}`);
  }
  if (hints.starts_at) {
    const ms = Date.parse(hints.starts_at);
    if (!Number.isNaN(ms)) query.push(`starts_at=${encodeURIComponent(new Date(ms).toISOString())}`);
  }
  return query.length > 0 ? `/round/${id}?${query.join('&')}` : `/round/${id}`;
}
