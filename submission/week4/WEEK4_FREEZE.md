# Week 4 Freeze

**Status: WEEK 4 ENGINEERING FROZEN**

## Repository

- URL: https://github.com/Rishidar-lab/controldeck
- Visibility: public
- Branch: `main`
- Pre-freeze HEAD (docs/UI gate, verified pushed and synchronized with
  `origin/main` before this file was added): `0592f1b`
- This freeze record is committed on top of that HEAD; the commit that
  introduces this file is the final Week-4 HEAD — see `git log -1` /
  the repository's `main` branch for its exact hash.

## Engineering — exact result

- Tests: **276 / 276 passing** (29 test files, `vitest run`, re-run fresh
  immediately before this freeze)
- Typecheck: clean, 10/10 workspace packages (`pnpm -r typecheck`)
- Lint: clean (`eslint .`)
- Production build: clean (`apps/web`: `tsc --noEmit && vite build`)
- Dependency audit: clean, no known vulnerabilities (`pnpm audit --prod`)
- Secret scan: clean, 142 tracked files (`scripts/secret-scan.mjs`)
- `git diff --check`: clean
- `git status`: clean working tree

## Evaluation — exact result

30-case Week-4 corpus, 26 executed:

| PASS | PARTIAL | FAIL | NOT_APPLICABLE |
|---|---|---|---|
| 19 | 2 | 5 | 4 |

Full case table and root-cause classification:
[`docs/EVALUATION.md`](../../docs/EVALUATION.md). This result was produced
at Gate 10 (commit `655ee1d`) and independently reconfirmed still-current
at Gate 11 via `git diff 655ee1d -- packages apps/web/src` returning empty
— zero application/package source changed in the documentation/UI-QA pass
that followed, so the deterministic-function composition the corpus
exercises is byte-identical to what produced this result. No expected
outcome was ever edited to raise the pass count.

## Security invariants (all hold, each backed by a named test)

| | |
|---|---|
| Model may authorize | NO |
| Model may move workflow state | NO |
| Model may declare a verified fact | NO |
| Model may mint execution authority | NO |
| Model may execute an adapter directly | NO |
| Model may declare execution success | NO |
| Model may author an audit entry's system fields | NO |
| Agent vote/consensus may authorize | NO |
| Unverified evidence may satisfy governance | NO |
| Stale evidence may satisfy governance | NO |
| Changed plan may reuse an existing approval | NO |
| Changed evidence snapshot may reuse an existing approval | NO |
| Duplicate side effect possible via retry | NO |
| Blind retry on UNKNOWN_OUTCOME possible | NO |
| Tampered ledger entry verifies as clean | NO |

## Known limitations (disclosed, not hidden)

1. Semantic evidence verification is structurally out of scope —
   `assessClaim` checks provenance/integrity/freshness only, never claim
   truth (w4-003, w4-014, w4-017).
2. No live orchestrator/executor server exists this round — package-level
   primitives are real and tested but not wired into one end-to-end
   request-driven service (w4-004, w4-026).
3. Risk and Verifier specialists are not implemented; the UI says so
   explicitly rather than mocking them.
4. `REPLAY_PROJECTION` reason-code semantics are spec-ambiguous (w4-012,
   PARTIAL).
5. w4-023's reason-code set is a strict, internally-consistent superset of
   the literal corpus expectation (PARTIAL).

Full detail: README.md §14, `docs/EVALUATION.md`.

## Demo readiness

Ready to record. Demo rehearsed live (Playwright + system Chrome, not
static stills) across all 6 hero scenarios: zero scenario errors, all 10
panels render, zero console errors, zero secret leakage, at all 4 QA
breakpoints (390/768/1024/1440). Script, shot list, and narration are
written and verified against this exact build:
[`DEMO_SCRIPT.md`](DEMO_SCRIPT.md),
[`FINAL_RECORDING_SHOTLIST.md`](FINAL_RECORDING_SHOTLIST.md),
[`NARRATION.md`](NARRATION.md).

## Freeze declaration

Week 4 engineering is frozen as of the date/time below. No further
features, redesigns, or scope additions follow this record. Any future
work is a new week/gate, not a modification of what is described here.

- Freeze date/time (UTC): 2026-08-24T03:56:03Z
