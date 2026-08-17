# Scary Movie Collectors Rehaul Plan

> **Status:** Phase 1 schema/security baseline complete; implementation begins from verified evidence.

## Goal

Turn the static prototype into a maintainable collection and community marketplace while preserving existing data and enforcing authorization in Supabase RLS.

## Verified baseline

- 12 public application tables
- 20 foreign-key constraints
- 12 public tables with RLS enabled
- 54 policies in the schema snapshot
- Schema snapshot: `supabase/remote-schema.sql`

## Immediate security findings

1. Several tables have duplicate policies for the same operation, making effective permissions difficult to reason about.
2. `dm_threads` permits `INSERT ... WITH CHECK (true)`; thread creation must prove the authenticated user is included in the initial participant set or move creation behind a transaction/function.
3. `forum_replies` permits any authenticated user to insert with `WITH CHECK (true)`; the policy should require `author_id = auth.uid()`.
4. `orders` lets buyer and seller update their own rows; payment state, price, seller, buyer, transaction hash, and chain identity must not be client-editable after creation.
5. `items` has multiple overlapping insert/update/delete policies with inconsistent role and free-tier limits.
6. Public profile reads expose wallet addresses and other profile fields; the product needs an explicit decision about which fields are public.
7. Payment columns are directly writable from the client; real payment settlement must be server/Edge-Function controlled.

## Implementation sequence

### Phase 1 — Foundation and security

- Keep the verified schema snapshot under version control.
- Add a single shared Supabase client/configuration module.
- Add an RLS audit document and migration test fixtures.
- Consolidate policies only after checking current production behavior and preserving intended access.

### Phase 2 — Shared frontend foundation

- Add Vite and a minimal module layout.
- Replace per-page Supabase client construction with one configured client.
- Add shared navigation, auth state, error handling, loading states, and safe HTML rendering.
- Keep legacy pages available during migration.

### Phase 3 — Collection and profiles

- Migrate items, images, votes, profiles, and frames first.
- Enforce ownership through the database, not client-side checks.
- Add image/storage policy verification.

### Phase 4 — Community

- Migrate forums and direct messages.
- Fix author identity checks and thread-participant creation atomically.
- Add privacy tests for cross-user message access.

### Phase 5 — Marketplace and deployment

- Treat orders as a server-controlled state machine.
- Prevent client writes to payment settlement fields.
- Add preview deployment, CI checks, and production rollout gates.
