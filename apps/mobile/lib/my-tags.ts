import type { Destination, Gathering, Tag } from '@withme/contract';
import { formatStartsAt } from './format-time';

/** A choice value for a destination: 'profile' or 'gathering:<id>'. */
export function destinationKey(destination: Destination | null): string {
  return destination?.type === 'gathering' ? `gathering:${destination.gathering_id}` : 'profile';
}

export function destinationFromKey(key: string): Destination {
  return key.startsWith('gathering:')
    ? { type: 'gathering', gathering_id: key.slice('gathering:'.length) }
    : { type: 'profile' };
}

/** "Rooftop listening session · Thu, Oct 9 · 7:00 PM" */
export function gatheringChoiceLabel(g: Pick<Gathering, 'title' | 'starts_at'>): string {
  return [g.title, formatStartsAt(g.starts_at)].filter(Boolean).join(' · ');
}

/**
 * What a tap on this tag does right now, in one sentence. `gatherings` is
 * null when that list did not load, so an unknown gathering is never
 * misread as one you left.
 */
export function describeTag(tag: Tag, gatherings: Gathering[] | null): string {
  if (tag.status === 'disabled') return 'Off. A tap shows an inactive tag.';
  const destination = tag.destination;
  if (destination?.type !== 'gathering') return 'A tap shows your card.';
  if (gatherings === null) return 'A tap invites people to a gathering.';
  const target = gatherings.find((g) => g.id === destination.gathering_id);
  return target
    ? `A tap invites people to ${target.title}.`
    : 'A tap shows your card: the gathering it pointed at is gone, or you left it.';
}
