# Build Lab project instructions

- This is the canonical working tree for `realadampace-commits/scarymoviecollector-test`.
- Always work in `/Users/nathanial/Projects/scarymoviecollector-test`; do not create or use `/tmp/scarymoviecollector` for implementation.
- Before changing code, inspect `git status`, branch, and remote.
- Run `npm ci` when dependencies are absent, then run `npm run check`, `npm run check:pages`, `npm run security:scan`, and `npm run build`.
- For approved deployment tasks, commit with a descriptive conventional commit and push to `origin main`; Vercel deploys the GitHub `main` branch to https://scarymoviecollector-test.vercel.app.
- After pushing, verify the deployment URL and report the commit, checks, and deployment state. Never claim deployment success from a push alone.
- Do not expose credentials. Do not modify production data or authentication configuration without explicit task-specific approval.
