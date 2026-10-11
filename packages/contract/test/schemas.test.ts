import { describe, expect, it } from 'bun:test';
import {
  AVATAR_MAX_BYTES,
  AvatarPathSchema,
  AvatarUploadInputSchema,
  avatarPublicUrl,
  ConnectRequestSchema,
  CreateGatheringInputSchema,
  DestinationSchema,
  GatheringSchema,
  GatheringSummarySchema,
  PublicProfileSchema,
  ResolveOutputSchema,
  TagUidSchema,
  UpdateGatheringInputSchema,
  UpdateMyTagInputSchema,
  UpdateProfileInputSchema,
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

  it('lowercases a gathering id so it matches the database', () => {
    expect(
      DestinationSchema.parse({
        type: 'gathering',
        gathering_id: '7C9E6679-7425-40DE-944B-E07FC1F90AE7',
      }),
    ).toEqual({ type: 'gathering', gathering_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7' });
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
        avatar_path: null,
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
        avatar_path: null,
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
          avatar_path: null,
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
    expect(keys).toEqual(['avatar_path', 'bio', 'display_name', 'id']);
  });
});

describe('ConnectRequestSchema', () => {
  it('parses a pending incoming request with requester card', () => {
    const parsed = ConnectRequestSchema.parse({
      id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      requester: {
        id: '9b2c8f43-1b1a-4f7e-9d3c-2a6c1e5b8d90',
        display_name: 'Alex',
        avatar_path: null,
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
          avatar_path: null,
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

/** A JPEG-labelled file of exactly `bytes` zero bytes (only the size matters to the schema). */
function sized(bytes: number): File {
  return new File([new Uint8Array(bytes)], 'avatar.jpg', { type: 'image/jpeg' });
}

describe('avatar schemas', () => {
  const owner = '9b2c8f43-1b1a-4f7e-9d3c-2a6c1e5b8d90';
  const file = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

  it('accepts a path in a user folder, webp or jpg', () => {
    expect(AvatarPathSchema.safeParse(`${owner}/${file}.webp`).success).toBe(true);
    expect(AvatarPathSchema.safeParse(`${owner}/${file}.jpg`).success).toBe(true);
  });

  it('rejects a URL, another extension, a nested, uppercase, or folderless path', () => {
    for (const path of [
      `https://evil.example/${owner}/${file}.jpg`,
      `${owner}/${file}.png`,
      `${owner}/nested/${file}.jpg`,
      `${owner.toUpperCase()}/${file}.jpg`,
      `${file}.jpg`,
    ]) {
      expect(AvatarPathSchema.safeParse(path).success).toBe(false);
    }
  });

  it("builds the public URL from the client's own Supabase URL", () => {
    expect(avatarPublicUrl('http://127.0.0.1:55321/', `${owner}/${file}.webp`)).toBe(
      `http://127.0.0.1:55321/storage/v1/object/public/avatars/${owner}/${file}.webp`,
    );
  });

  it('the profile update cannot set an avatar: the keys are dropped', () => {
    expect(
      UpdateProfileInputSchema.parse({
        display_name: 'Sam',
        avatar_path: `${owner}/${file}.jpg`,
        avatar_url: 'https://evil.example/a.jpg',
      }),
    ).toEqual({ display_name: 'Sam' });
  });

  it('the upload takes a file up to the cap and refuses an empty, oversized, or non-file one', () => {
    expect(AvatarUploadInputSchema.safeParse({ file: sized(1024) }).success).toBe(true);
    expect(AvatarUploadInputSchema.safeParse({ file: sized(AVATAR_MAX_BYTES) }).success).toBe(true);
    expect(AvatarUploadInputSchema.safeParse({ file: sized(0) }).success).toBe(false);
    expect(AvatarUploadInputSchema.safeParse({ file: sized(AVATAR_MAX_BYTES + 1) }).success).toBe(
      false,
    );
    expect(
      AvatarUploadInputSchema.safeParse({ file: 'data:image/jpeg;base64,AAAA' }).success,
    ).toBe(false);
  });
});

describe('UpdateMyTagInputSchema', () => {
  it('accepts a destination-only or a status-only patch', () => {
    expect(
      UpdateMyTagInputSchema.safeParse({ uid: '04A3B2C1D05E80', destination: { type: 'profile' } })
        .success,
    ).toBe(true);
    expect(
      UpdateMyTagInputSchema.safeParse({ uid: '04A3B2C1D05E80', status: 'disabled' }).success,
    ).toBe(true);
  });

  it('rejects an empty patch and an owner releasing the tag', () => {
    expect(UpdateMyTagInputSchema.safeParse({ uid: '04A3B2C1D05E80' }).success).toBe(false);
    expect(
      UpdateMyTagInputSchema.safeParse({ uid: '04A3B2C1D05E80', status: 'unclaimed' }).success,
    ).toBe(false);
  });
});
