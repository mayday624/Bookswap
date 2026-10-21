# BookSwap

BookSwap helps readers in Kenyan communities pass books they have finished to nearby readers. The app is built mobile-first for Android and limited data connections.

## Current milestone

Milestone 1 establishes the PWA shell, email/password and Google auth, user profiles, the initial Supabase schema with row-level security, account deletion, and demo data. Later milestones add listing and swap features. Growth and reading features are controlled by `src/config/features.ts`; both are off until their milestones are complete.

## Run locally

1. Install Node.js 20+ and pnpm.
2. Install workspace dependencies with `pnpm install`.
3. Copy `artifacts/bookswap/.env.example` to `artifacts/bookswap/.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project.
4. Start the BookSwap preview with `pnpm --filter @workspace/bookswap run dev`.
5. Check types with `pnpm --filter @workspace/bookswap run typecheck`.

The browser key is a public Supabase publishable/anon key. It is safe to expose in the app only because the database policies enforce access. Never put a service-role key in a `VITE_` variable or in browser code.

## Supabase setup

1. Create a Supabase project and copy its project URL and publishable/anon key to the BookSwap environment variables.
2. Apply `supabase/migrations/20261021000000_m1_initial_schema.sql` in the Supabase SQL editor, or link the Supabase CLI to the project and run `npx supabase db push`.
3. In Supabase Authentication, enable email/password and Google. For Google, add your OAuth client in the Supabase provider settings and allow the BookSwap preview/deployment URL as an auth redirect URL.
4. Set the Supabase Auth Site URL and allowed redirect URLs to include the BookSwap preview and final published URL.
5. Deploy account deletion with `npx supabase functions deploy delete-account`. Set `SUPABASE_SERVICE_ROLE_KEY` as a Supabase Edge Function secret; the function validates the caller's session before deleting only that account.
6. To create the demo catalogue, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in a secure server-side environment and run `pnpm --filter @workspace/bookswap run seed`. The script creates ten confirmed demo accounts and forty sample book listings. It generates private random passwords for the demo accounts and does not print them; do not use these as real accounts.

Do not put the service-role key in client-side environment variables. It bypasses row-level security and must only be used by the demo seeder or the account-deletion Edge Function.

## Database and privacy

- SQL migrations live in `supabase/migrations`.
- Every application table has row-level security enabled.
- Profiles expose only display information and approximate town/area coordinates; coordinates are rounded to about 1 km. No exact addresses are requested or stored.
- The `book-photos` storage bucket accepts JPEG, PNG, and WebP images up to 5 MB. User uploads must be placed in a folder named for the authenticated user's ID.
- `SUPABASE_SERVICE_ROLE_KEY` is required only for the demo seeder and Edge Function secret setup.

## PWA

The app includes a web manifest and an offline shell service worker. The first visit needs a network connection; pages that require Supabase still need connectivity.

## Deployment

Publish the BookSwap web artifact from Replit. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the deployment environment, then add the production URL to Supabase Auth's allowed redirect URLs and Google OAuth configuration. Deploy the `delete-account` Supabase Edge Function separately and configure its secrets in Supabase.

## Milestone roadmap

See `TODO.md` for current progress. The curated set-book records added in a later milestone will be labeled sample data and must be verified against the current official list before launch.
