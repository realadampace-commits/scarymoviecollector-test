# Scary Movie Collectors

Secure modernization work for the Scary Movie Collectors prototype.

## Headless development

This project can be maintained entirely from the headless Mac through Hermes. No local monitor, SSH session, or second device is required for repository work.

```bash
cd /tmp/scarymoviecollector-work
npm run security:scan
npm run check:pages
npm run check
git diff --check
```

The local project is intentionally not allowed to contain service-role keys, database passwords, JWT secrets, or provider credentials. Browser-safe Supabase configuration belongs in an ignored local environment file once the project build is migrated to a bundler.

## Current safety boundary

The legacy pages are still static prototypes and the production Supabase schema/RLS policies have not been fully verified. Do not enable marketplace payments or invent migrations until a schema-only export or equivalent read-only schema evidence is available.

## Next implementation sequence

1. Migrate the static pages to a small Vite application with one Supabase client and shared UI modules.
2. Add typed data-access modules that fail closed when configuration is missing.
3. Reconcile the real Supabase schema and RLS policies before adding writes.
4. Add authentication, collection, profile, forum, messaging, and marketplace tests.
5. Put payment operations behind a verified server/Edge Function boundary.
6. Deploy a preview and verify it from the repository/deployment URLs.
