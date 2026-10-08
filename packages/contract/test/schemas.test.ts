import { describe, expect, it } from 'bun:test';
import {
  ConnectRequestSchema,
  CreateGatheringInputSchema,
  DestinationSchema,
  GatheringSchema,
  GatheringSummarySchema,
  PublicProfileSchema,
  ResolveOutputSchema,
  TagUidSchema,
  UpdateGatheringInputSchema,
} from '../src/index.ts';

describe('DestinationSchema (discriminated union)', () => {
  it('accepts the profile destination', () => {
    expect(DestinationSchema.parse({ type: 'profile' })).toEqual({ type: 'profile' });
  });

  it('rejects unknown destination types', () => {
    expect(DestinationSchema.safeParse({ type: 'link', url: 'https://x.com' }).success).toBe(
      false,
    );
  });

  it('rejects a missing discriminator', () => {
    expect(DestinationSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a gathering destination', () => {
    const parsed = DestinationSchema.parse({
      type: 'gathering',
      gathering_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    });
    expect(parsed.type).toBe('gathering');
  });

  it('rejects a gathering destination with a malformed or missing id', () => {
    expect(
      DestinationSchema.safeParse({ type: 'gathering', gathering_id: 'nope' }).success,
    ).toBe(false);
    expect(DestinationSchema.safeParse({ type: 'gathering' }).success).toBe(false);
  });
});

describe('TagUidSchema', () => {
  it('normalizes lowercase and padded input to uppercase', () => {
    expect(TagUidSchema.parse(' 04a3b2c1d05e80 ')).toBe('04A3B2C1D05E80');
  });

  it('rejects non-hex uids', () => {
    expect(TagUidSchema.safeParse('04A3B2C1D05EG0').success).toBe(false);
  });

  it('rejects wrong-length uids', () => {
    expect(TagUidSchema.safeParse('04A3B2C1').success).toBe(false);
  });
});

describe('ResolveOutputSchema', () => {
  it('accepts an unclaimed result', () => {
    const result = ResolveOutputSchema.parse({ status: 'unclaimed', uid: '04A3B2C1D05E80' });
    expect(result.status).toBe('unclaimed');
  });

  it('accepts a claimed result with destination and public profile', () => {
    const result = ResolveOutputSchema.parse({
      status: 'claimed',
      uid: '04A3B2C1D05E80',
      destination: { type: 'profile' },
      gathering: null,
      profile: {
        id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
        display_name: 'Sam',
        avatar_url: null,
        bio: null,
      },
    });
    expect(result.status).toBe('claimed');
  });

  it('accepts a claimed result whose tag points at a gathering', () => {
    const result = ResolveOutputSchema.parse({
      status: 'claimed',
      uid: '04A3B2C1D05E80',
      destination: { type: 'gathering', gathering_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7' },
      gathering: {
        id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
        title: 'Rooftop listening session',
        starts_at: '2026-10-09T18:00:00+00:00',
        location: null,
      },
      profile: {
        id: '9b2c8f43-1b1a-4f7e-9d3c-2a6c1e5b8d90',
        display_name: 'Sam',
        avatar_url: null,
        bio: null,
      },
    });
    expect(result.status === 'claimed' && result.gathering?.title).toBe(
      'Rooftop listening session',
    );
  });

  it('rejects a claimed result without the gathering key (always present, nullable)', () => {
    expect(
      ResolveOutputSchema.safeParse({
        status: 'claimed',
        uid: '04A3B2C1D05E80',
        destination: { type: 'profile' },
        profile: {
          id: '9b2c8f43-1b1a-4f7e-9d3c-2a6c1e5b8d90',
          display_name: 'Sam',
          avatar_url: null,
          bio: null,
        },
      }).success,
    ).toBe(false);
  });

  it('rejects a claimed result without a profile', () => {
    expect(
      ResolveOutputSchema.safeParse({
        status: 'claimed',
        uid: '04A3B2C1D05E80',
        destination: { type: 'profile' },
      }).success,
    ).toBe(false);
  });

  it('accepts a disabled result', () => {
    expect(ResolveOutputSchema.parse({ status: 'disabled', uid: '04A3B2C1D05E80' }).status).toBe(
      'disabled',
    );
  });
});

describe('PublicProfileSchema', () => {
  it('exposes only card-safe fields', () => {
    const keys = Object.keys(PublicProfileSchema.shape).toSorted();
    expect(keys).toEqual(['avatar_url', 'bio', 'display_name', 'id']);
  });
});

describe('ConnectRequestSchema', () => {
  it('parses a pending incoming request with requester card', () => {
    const parsed = ConnectRequestSchema.parse({
      id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      requester: {
        id: '9b2c8f43-1b1a-4f7e-9d3c-2a6c1e5b8d90',
        display_name: 'Alex',
        avatar_url: null,
        bio: 'hi',
      },
      status: 'pending',
      created_at: '2026-06-10T00:00:00Z',
      expires_at: '2026-06-17T00:00:00Z',
    });
    expect(parsed.status).toBe('pending');
  });

  it('rejects unknown statuses', () => {
    expect(
      ConnectRequestSchema.safeParse({
        id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
        requester: {
          id: '9b2c8f43-1b1a-4f7e-9d3c-2a6c1e5b8d90',
          display_name: 'Alex',
          avatar_url: null,
          bio: null,
        },
        status: 'ghosted',
        created_at: '2026-06-10T00:00:00Z',
        expires_at: '2026-06-17T00:00:00Z',
      }).success,
    ).toBe(false);
  });
});

describe('gathering schemas', () => {
  // Both offset spellings on purpose: the schema must accept each.
  const gathering = {
    id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    title: 'Rooftop listening session',
    starts_at: '2026-10-09T18:00:00+00:00',
    location: 'The roof',
    host_id: '9b2c8f43-1b1a-4f7e-9d3c-2a6c1e5b8d90',
    created_at: '2026-10-01T00:00:00Z',
  };

  it('parses a gathering', () => {
    expect(GatheringSchema.parse(gathering).title).toBe('Rooftop listening session');
  });

  it('the summary exposes only what a tap may learn', () => {
    expect(Object.keys(GatheringSummarySchema.shape).toSorted()).toEqual([
      'id',
      'location',
      'starts_at',
      'title',
    ]);
  });

  it('rejects an empty or oversized title and a non-ISO start', () => {
    expect(GatheringSchema.safeParse({ ...gathering, title: '' }).success).toBe(false);
    expect(GatheringSchema.safeParse({ ...gathering, title: 'x'.repeat(121) }).success).toBe(
      false,
    );
    expect(GatheringSchema.safeParse({ ...gathering, starts_at: 'tomorrow' }).success).toBe(false);
  });

  it('trims the create input and allows a null location', () => {
    const parsed = CreateGatheringInputSchema.parse({
      title: '  Tee time  ',
      starts_at: gathering.starts_at,
      location: null,
    });
    expect(parsed).toEqual({ title: 'Tee time', starts_at: gathering.starts_at, location: null });
    expect(CreateGatheringInputSchema.parse({ ...parsed, location: '   ' }).location).toBeNull();
  });

  it('an emptied location clears it', () => {
    expect(
      UpdateGatheringInputSchema.parse({ id: gathering.id, location: '   ' }).location,
    ).toBeNull();
  });

  it('rejects an update with nothing to update', () => {
    expect(UpdateGatheringInputSchema.safeParse({ id: gathering.id }).success).toBe(false);
    expect(UpdateGatheringInputSchema.safeParse({ id: gathering.id, title: 'Moved' }).success).toBe(
      true,
    );
  });
});
