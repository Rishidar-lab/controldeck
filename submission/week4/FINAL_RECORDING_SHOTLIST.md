# Final Recording Shot List

Companion to [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md). One row per shot, in
recording order. All shots are live interactions with
`pnpm --filter @controldeck/web dev`, not static images — the reference
stills in `docs/screenshots/` show what each shot should look like, not a
substitute recording.

| # | Time | Shot | Scenario | Panel(s) in frame | What to say / point at |
|---|---|---|---|---|---|
| 1 | 0:00–0:10 | Title / opening line | — | (README diagram, optional) | "Multi-agent orchestration is not governance." |
| 2 | 0:10–0:18 | Intake panel | A | 1. Intake | Objective + current state, live from a real workflow |
| 3 | 0:18–0:25 | Specialist outputs | A | 2. Specialists | Both cards badged **Advisory**; Risk/Verifier shown as "not implemented" |
| 4 | 0:25–0:32 | Evidence pipeline | B | 3. Evidence | CLAIM → EVIDENCE (Advisory) → VERIFIED_FACT (Authoritative) |
| 5 | 0:32–0:40 | Conflict detected | B | 9. Conflict | Two verified assessments disagree; deterministic resolution, not a vote |
| 6 | 0:40–0:48 | Governance decision | A | 4. Governance | `REQUIRE_APPROVAL` + exact reason code, badged **Authoritative** |
| 7 | 0:48–0:55 | Reason-code close-up | A | 4. Governance | Zoom on `CUMULATIVE_RISK_REQUIRES_APPROVAL` |
| 8 | 0:55–1:10 | Approval binding | A | 5. Approval | Bound plan/evidence/action hashes, not a generic yes/no |
| 9 | 1:10–1:18 | Execution | A | 6. Execution | Authority state, capability-scoped adapter call |
| 10 | 1:18–1:25 | Postcondition verification | A | 7. Verification | `SUCCEEDED` outcome — "proven," not "attempted" |
| 11 | 1:25–1:33 | Stale approval | C | 4–5. Governance/Approval | `SNAPSHOT_CHANGED` / `CONFLICT` |
| 12 | 1:33–1:40 | Duplicate/replay protection | D | 6. Execution | Idempotent — second attempt produces no second side effect |
| 13 | 1:40–1:48 | Audit timeline | A | 8. Audit | Scroll rows; "Hash chain verifies clean"; Advisory vs. System-decided tags |
| 14 | 1:48–1:55 | Replay / projection | A | 10. Replay | Reconstructed purely from recorded events |
| 15 | 1:55–2:00 | Closing line | — | — | "Agents can propose, disagree, and supply evidence. ControlDeck decides what the system is actually allowed to do." |

## Reference stills (for framing only, not the recording itself)

| Shot | File |
|---|---|
| Intake | `docs/screenshots/01-intake.png` |
| Specialists | `docs/screenshots/02-specialists.png` |
| Evidence | `docs/screenshots/03-evidence.png` |
| Governance | `docs/screenshots/04-governance.png` |
| Approval | `docs/screenshots/05-approval.png` |
| Execution | `docs/screenshots/06-execution.png` |
| Verification | `docs/screenshots/07-verification.png` |
| Audit | `docs/screenshots/08-audit.png` |
| Conflict | `docs/screenshots/09-conflict.png` |
| Replay | `docs/screenshots/10-replay.png` |

## Pre-roll checklist

- [ ] Fresh dev server, clean browser profile, no notifications
- [ ] Window/viewport at 1440px width
- [ ] Console open (or checked beforehand) to confirm zero errors during the take
- [ ] No real credentials, tenant data, or personal data anywhere on screen
