// Compile-time parity check: the structural types published by ./client must
// stay identical to the contract's public-router outputs. This file never
// ships — it exists so drift fails `tsc --noEmit` inside the workspace.
import type { ContractOutputs } from '@withme/contract';
import { describe, expect, it } from 'vitest';
import type { ApiClaimResult, ApiResolveResult, Destination } from '../src/client.ts';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

type ContractResolve = ContractOutputs['public']['resolve'];
type ContractClaimed = Extract<ContractResolve, { status: 'claimed' }>;

const resolveMatches: Equal<ApiResolveResult, ContractResolve> = true;
const claimMatches: Equal<ApiClaimResult, ContractOutputs['public']['claim']> = true;
const destinationMatches: Equal<Destination, ContractClaimed['destination']> = true;

describe('client types mirror the contract', () => {
  it('resolve, claim, and destination shapes are identical', () => {
    expect(resolveMatches).toBe(true);
    expect(claimMatches).toBe(true);
    expect(destinationMatches).toBe(true);
  });
});
