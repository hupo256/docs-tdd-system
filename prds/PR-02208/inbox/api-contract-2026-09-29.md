# PR-02208 API contract received on 2026-09-29

Source: YApi project 16, category 1681. The interface details below were read in an authenticated session during this run. An unauthenticated direct request to `/api/interface/get?id=6514` returned `40011` (login required); this snapshot is not a successful business-environment call.

## Tier list (YApi interface 6514)

- `POST /fe-coadmin-api/api_fee_tier_list`, form-urlencoded with no business parameters.
- Successful envelope: `code: "0"`, `data`: five tier objects ordered L1 through L5.
- Object fields: `tier`, `volumeMin`, `volumeMax`, `makerRate`, `takerRate`, `rebateRate`.
- `volumeMax` is `null` for L5. Rates and rebate ratios are fractions: `makerRate: 0.000150` displays as `0.0150%`; `rebateRate: 0.75` displays as `75%`.

## Tier save (YApi interface 6517)

- `POST /fe-coadmin-api/api_fee_tier_edit`, JSON body `{ "tiers": [all five tier objects] }`.
- The response is successful only when the envelope `code` is `"0"`.
- Save the complete L1-L5 set rather than a single edited tier.

## Commission discount list (YApi interface 6520)

- Existing `POST /fe-coadmin-api/get_commission_discount_list`.
- Rows are under `data.pageInfo.rows`; each row now carries display strings `apiLevel` and `apiFeeRate`.
- No tier is represented by `"-"`. No `hasApiKey` field is specified; API Key possession must not be inferred from display fields.

## Verification boundary

This source describes the documented interface, not a successful authenticated request against a deployed admin backend. A logged-in read of list rows and a controlled save/read-back remain to be verified in the target environment.
