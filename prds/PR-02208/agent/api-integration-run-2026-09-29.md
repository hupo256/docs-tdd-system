# PR-02208 API integration run (2026-09-29)

## Scope and source

- Continued in `/Users/aven/github/PR-02208` on `feature/PR-02208`; no new worktree, commit, or push.
- This is an existing docs_tdd v2 project, absent from the current `autopilot-web projects` listing. Its project-local record is used instead of fabricating an AutoPilot run.
- YApi category 1681, interfaces 6514 (tier list), 6517 (full-set tier edit), and 6520 (commission discount list). Contract snapshot: `../inbox/api-contract-2026-09-29.md`.
- `sourceReadiness.api.status` is `available`, not `integrated`. The YApi document was read in an authenticated session; a direct unauthenticated detail request returned `40011`.

## Work and verification

- Replaced static L1-L5 data in both futures-admin clients with list and full-set save requests. The commission list displays the documented `apiLevel` and `apiFeeRate` strings without inferring API Key ownership.
- Focused tests: 3 files, 7 cases passed. The scoped Biome command checked 10 applicable files with no fixes. `git diff --check` passed. These are code/contract checks, not complete authenticated backend integration.
- The full futures-admin typecheck failed with numerous unrelated diagnostics and missing dependencies; the filtered output did not show a `FutureApiDynamicFeeConfig` diagnostic. Typecheck is **not passed**.
- The new client sends an empty form-urlencoded list body via the shared fetcher. In the authenticated Legacy page, the `api_fee_tier_list` request payload was `{}` and the response was `code: "0"` with five L1-L5 rows. The page displayed the returned L1 rebate of 72%, confirming list rendering against live data. The new client's runtime request remains unverified. No shared transport change was made on an unverified assumption.
- The authenticated `commissionDiscountList` page called `get_commission_discount_list`, which returned `code: "500"`, `succ: false`. The backend SQL selects `volume30d_usdt` from `co_api_user_level`, but the database reports `Unknown column 'volume30d_usdt' in 'field list'` (reported mapper: `CoApiUserLevelMapper.java`). This is a backend schema/query mismatch; no frontend fallback or fabricated data was added. Backend owner must reconcile the column/migration and query, then the list and returned rows must be retested.
- Controlled full-set save/read-back was not attempted because it changes real fee tiers. Commission-list row verification is blocked by the backend 500. Do not report the overall API as runtime-integrated until these succeed.
- During the prior YApi inspection, interface 6523 (`_copy`) was created unintentionally. It is unrelated to the integration and was not deleted without authorization.

## Time and boundary

- Observable continuation began at 18:44:26 +0400 and was reviewed through 18:54:00 +0400 (9 minutes 34 seconds). This is an observed interval, **not** total development time or active coding time for the whole requirement.
- A later authenticated browser check had established the live tier-list success and commission-list backend 500 by 19:56:57 +0400. The intervening time is not attributed to active work.
- Existing unrelated changes in `docs_tdd` were left untouched. No commit or push was authorized for this continuation.
