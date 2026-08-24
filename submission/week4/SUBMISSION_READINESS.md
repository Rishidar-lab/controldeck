# Week 4 Submission Readiness

Snapshot taken immediately before GitHub publication. Every number below is
from a real command run in this repository at the HEAD in place at the time
(the commit that introduces this file, plus the Gate 10 commit
`655ee1d` it builds on — `git log` is authoritative for the exact hash).

## Engineering

| Check | Result |
|---|---|
| Unit + integration tests (`vitest run`) | **276 / 276 passing**, 29 test files |
| Frontend tests (`apps/web`, included above) | passing (`App.test.tsx`) |
| Typecheck (`pnpm -r typecheck`) | clean, 10/10 workspace packages |
| Lint (`eslint .`) | clean |
| Production build (`apps/web`: `tsc --noEmit && vite build`) | clean — `dist/` produced, 307KB JS / 3.6KB CSS (gzip: 92KB / 1.3KB) |
| Dependency audit (`pnpm audit --prod`) | clean — no known vulnerabilities |
| Secret scan (`scripts/secret-scan.mjs`) | clean — 142 tracked files checked |
| `git diff --check` | clean — no whitespace errors |
| `git status` | clean working tree at time of each commit |

## Evaluation corpus

Result unchanged from [`docs/EVALUATION.md`](../../docs/EVALUATION.md)
(Gate 10, commit `655ee1d`): **19 PASS / 2 PARTIAL / 5 FAIL / 4 NOT_APPLICABLE**,
26 of 30 cases executed. Verified current rather than re-asserted from
memory: `git diff 655ee1d -- packages apps/web/src` (plus `apps/web`'s
`package.json`/`tsconfig.json`/`vite.config.ts`) is **empty** — zero
application/package source changed during the Gate 11/12 documentation and
UI-polish pass, only `README.md`, `docs/screenshots/`, `submission/`, and
`SECURITY.md` were added. Since the evaluation composes deterministic pure
functions from that exact, unchanged source tree, the recorded result is
still current by construction, and the full 276-test engineering suite was
re-run fresh (not cached) against this HEAD to independently confirm no
regression. No expected outcome was ever edited to raise the pass count.

## Demo rehearsal

Run live against `pnpm --filter @controldeck/web dev` via Playwright +
system Chrome (not a static screenshot check):

- All 6 hero scenarios (A–F) load without a `scenario-error` alert.
- All 10 panel views (`intake`, `specialists`, `evidence`, `governance`,
  `approval`, `execution`, `verification`, `audit`, `conflict`, `replay`)
  render for every scenario.
- Zero console errors and zero `pageerror` events across all 6 scenarios.
- Zero secret/capability-token-shaped strings (`cap_`, `nonce_`, `ticket_`,
  `sk-...`) anywhere in rendered page text, in any scenario.
- Responsive QA at 390 / 768 / 1024 / 1440px: zero console errors, zero
  horizontal overflow, zero secret leakage at every breakpoint.

## Screenshots

All 10 required panels captured live (`docs/screenshots/01-intake.png`
through `10-replay.png`), plus 4 full-page QA captures
(`qa-full-{390,768,1024,1440}.png`). Scanned separately for secrets, raw
capability/nonce/ticket values, local filesystem paths, and personal data —
clean.

## Known limitations

Carried forward honestly, not hidden — see README §14 and
`docs/EVALUATION.md`'s FAIL/PARTIAL classification for full detail:

1. Semantic evidence verification is structurally out of scope (`assessClaim`
   checks provenance/integrity/freshness only) — root cause of w4-003,
   w4-014, w4-017.
2. No live orchestrator/executor server exists — root cause of w4-004,
   w4-026 (w4-026's underlying invariant is independently proven *more
   strongly* by `packages/ledger/src/authorship.test.ts`, but not via the
   corpus's literal expected mechanism).
3. Risk and Verifier specialists are not implemented (disclosed in the UI
   itself, not mocked).
4. `REPLAY_PROJECTION` reason-code semantics are spec-ambiguous (w4-012,
   PARTIAL).
5. w4-023's reason-code set is a strict superset of the literal expectation
   (w4-023, PARTIAL).

## Ready to record

Yes. Demo script, shot list, and narration are written and match the live
UI's actual current behavior (verified against this HEAD, not an earlier
build). See [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md),
[`FINAL_RECORDING_SHOTLIST.md`](FINAL_RECORDING_SHOTLIST.md),
[`NARRATION.md`](NARRATION.md).
