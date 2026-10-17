import type { Destination, Gathering, Tag } from '@withme/contract';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.ts';
import type { Loaded } from '../lib/loaded.ts';
import {
  describeTag,
  destinationFromKey,
  destinationKey,
  gatheringChoiceLabel,
} from '../lib/my-tags.ts';
import { ListLadder } from './ListStates.tsx';

type TagPatch = { destination: Destination } | { status: 'claimed' | 'disabled' };

/**
 * Profile → My tags. Every tag you claimed: what a tap does now, where it
 * points (your card or one of your gatherings), and off/on. Through the
 * contract only (app.tags.listMine / app.tags.update); the database
 * enforces ownership with RLS and the (destination, status) column grant.
 */
export function MyTags({
  tags,
  gatherings,
}: {
  tags: Loaded<Tag[]>;
  gatherings: Loaded<Gathering[]>;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  // Per tag: saving one row never re-enables another mid-save.
  const [busyUids, setBusyUids] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const mine = gatherings.ok ? gatherings.data : null;

  async function retry() {
    setRetrying(true);
    try {
      await router.invalidate({ sync: true });
    } finally {
      setRetrying(false);
    }
  }

  /** True when the change saved. */
  async function update(uid: string, patch: TagPatch): Promise<boolean> {
    setBusyUids((prev) => new Set(prev).add(uid));
    setError(null);
    try {
      await api.app.tags.update({ uid, ...patch });
      await router.invalidate({ sync: true });
      return true;
    } catch {
      setError('That didn’t go through. Try again.');
      return false;
    } finally {
      setBusyUids((prev) => {
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
    }
  }

  return (
    <>
      <h2 className="section-title">My tags</h2>
      {/* Always mounted: a live region created with its message is not announced. */}
      <div role="alert">{error ? <p className="form-error">{error}</p> : null}</div>
      <ListLadder
        state={tags}
        what="your tags"
        empty="No tags yet. Tap an unclaimed tag to claim it."
        retrying={retrying}
        onRetry={retry}
      >
        {(list) =>
          list.map((tag) => (
            <TagRow
              key={tag.uid}
              tag={tag}
              gatherings={mine}
              busy={busyUids.has(tag.uid)}
              onUpdate={(patch) => update(tag.uid, patch)}
            />
          ))
        }
      </ListLadder>
    </>
  );
}

function TagRow({
  tag,
  gatherings,
  busy,
  onUpdate,
}: {
  tag: Tag;
  gatherings: Gathering[] | null;
  busy: boolean;
  onUpdate: (patch: TagPatch) => Promise<boolean>;
}) {
  const current = destinationKey(tag.destination);
  // A choice is staged until Save: browsing a closed select with the arrow
  // keys fires change on every step, and each would re-point the real tag.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? current;
  const staged = draft !== null && draft !== current;
  const known = gatherings ?? [];
  // A destination outside the list (left, deleted, or the list failed) stays shown as itself.
  const orphan = current !== 'profile' && !known.some((g) => `gathering:${g.id}` === current);
  const off = tag.status === 'disabled';
  const selectId = `destination-${tag.uid}`;

  // The controls are disabled while a change is saved, and a disabled control
  // drops keyboard focus to <body>. Hand it back to the one that was used.
  const used = useRef<HTMLSelectElement | HTMLButtonElement | null>(null);
  const select = useRef<HTMLSelectElement>(null);
  const wasBusy = useRef(busy);
  useEffect(() => {
    if (wasBusy.current && !busy) {
      const active = document.activeElement;
      if (active === null || active === document.body) used.current?.focus();
    }
    wasBusy.current = busy;
  }, [busy]);

  return (
    <div className="row row--stacked">
      <div className="row-body">
        <span className="name">{tag.uid}</span>
        <span className="sub">{describeTag(tag, gatherings)}</span>
      </div>
      <div className="row-actions">
        <label className="visually-hidden" htmlFor={selectId}>
          {`Where ${tag.uid} points`}
        </label>
        <select
          ref={select}
          id={selectId}
          className="select"
          value={shown}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
        >
          <option value="profile">My profile</option>
          {known.map((g) => (
            <option key={g.id} value={`gathering:${g.id}`}>
              {gatheringChoiceLabel(g)}
            </option>
          ))}
          {orphan ? (
            <option value={current} disabled>
              {gatherings === null ? 'A round' : "A round you're not in"}
            </option>
          ) : null}
        </select>
        {staged ? (
          <button
            type="button"
            className="btn btn--quiet"
            disabled={busy}
            aria-label={`Save where ${tag.uid} points`}
            onClick={async () => {
              // Save goes away once the tag points where the draft does: focus
              // returns to the select. Kept on failure, so Save can be retried.
              used.current = select.current;
              if (await onUpdate({ destination: destinationFromKey(draft) })) setDraft(null);
            }}
          >
            Save
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn--quiet"
          disabled={busy}
          aria-label={`${off ? 'Turn on' : 'Turn off'} ${tag.uid}`}
          onClick={(e) => {
            used.current = e.currentTarget;
            void onUpdate({ status: off ? 'claimed' : 'disabled' });
          }}
        >
          {off ? 'Turn on' : 'Turn off'}
        </button>
      </div>
    </div>
  );
}
