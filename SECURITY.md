# Security baseline

- Supabase URL and browser anon key come from environment configuration; no keys are hardcoded in application source.
- The anon key is browser-visible by design. Never expose `service_role`, database passwords, JWT signing secrets, or provider credentials.
- Before production migration, export and review tables, RLS policies, storage policies, triggers, and indexes from the linked Supabase project.
- Every write path must enforce ownership with RLS; client-side checks are not authorization.
- Payments must be moved behind a verified server/Edge Function flow before enabling real transactions.
- Run `npm run security:scan` before commits and CI.
