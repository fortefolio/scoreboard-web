<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Secret Management & GitHub Push Protection
- **NEVER hardcode Supabase Secret Keys or service role keys** (`sb_secret_*`) in code, tests, mocks, or configs.
- GitHub Push Protection blocks pushes containing `sb_secret_*`.
- Always read service role keys strictly via environment variables (`process.env.SUPABASE_SERVICE_ROLE_KEY`).
- Secret keys must remain only in gitignored files (`.env.local`, `.env.test.local`).
