# BookSwap milestone tracker

- [x] Create BookSwap artifact and establish the Supabase-based app structure.
- [x] M1 — PWA shell, email/password and Google auth, profile, initial schema/RLS, seed data, navigation. Live auth test awaits Supabase project configuration.
- [x] M2 — Add/edit books, ISBN scan and Open Library lookup, My Shelf, photo uploads. Live CRUD test awaits Supabase project configuration.
- [ ] M3 — Wishlist, Discover/search/filters/distance, book detail (in progress).
- [ ] M4 — Swap requests, accept/decline/counter, credits and state transitions.
- [ ] M5 — Realtime chat, meeting proposals, swap completion confirmation.
- [ ] M6 — Matching and notifications.
- [ ] M7 — Ratings, trust badge, reports, blocks, admin review and safety.
- [ ] M8 — Performance, offline shell, accessibility, error/empty states, setup and deployment docs.
- [ ] M9 — Growth features (WhatsApp sharing, textbooks, communities, phone verification, referrals); disabled by `growthFeatures` until complete.
- [ ] M10 — Reading sessions, streaks and buddies; disabled by `readingFeatures` until complete.

## Notes

- The direct Supabase client was selected. The Supabase project URL and browser publishable/anon key still need to be configured for live authentication.
- Never put the Supabase service-role key in browser code or any `VITE_` variable.
