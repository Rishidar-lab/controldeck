# Week 4 Demo Script

Target length: 90–120 seconds. Every beat below is a real, live interaction
with the running app (`pnpm --filter @controldeck/web dev`) — nothing is a
static mockup or a pre-recorded fake. All demo data is deterministic
synthetic data produced by the real `@controldeck/*` packages; no real
tenant, credential, or personal data is ever involved.

## Opening line (say before touching the app)

> "Several agents agreeing with each other is not governance. ControlDeck
> is the layer that decides what an AI-driven workflow is actually allowed
> to do — and it's real, running code, not a diagram."

## Beat-by-beat

**0:00–0:10 — Problem**
State the thesis on camera or as a title card: *"Multi-agent orchestration
is not governance."* Optionally show the README architecture diagram for
1–2 seconds as a establishing shot.

**0:10–0:25 — Intake + specialists**
Load the app on Scenario A ("Normal governed path"). Point out:
- Panel 1 (Intake): the workflow's objective and current state.
- Panel 2 (Specialists): Planner and Researcher outputs, each badged
  **Advisory**, rendered as separate cards — never merged into one
  "assistant" blob. Mention Risk/Verifier are shown as explicitly
  "not implemented," not faked.

**0:25–0:40 — Evidence + conflict**
Switch to Scenario B ("Evidence conflict"). Show:
- Panel 3 (Evidence): CLAIM → EVIDENCE (both Advisory) → VERIFIED_FACT
  (Authoritative, from `assessClaim`).
- Panel 9 (Conflict): two verified assessments of the same claim
  disagreeing — call out that this is a deterministic conflict outcome,
  never a majority vote.

**0:40–0:55 — Governance decision**
Back to Scenario A. Panel 4 (Governance): point at the `REQUIRE_APPROVAL`
outcome and its exact reason code (`CUMULATIVE_RISK_REQUIRES_APPROVAL`),
badged **Authoritative**. Emphasize: this came from deterministic code
reading structured inputs, not from a model being asked "should this be
approved?".

**0:55–1:10 — Approval binding**
Panel 5 (Approval): show the approval bound to a specific plan hash,
evidence-snapshot hash, and action — not a generic "yes" checkbox. Mention
`matchApproval` re-checks all three at consumption time.

**1:10–1:25 — Execution + postcondition verification**
Panels 6–7 (Execution, Verification): show the capability-scoped adapter
call and the postcondition-verified `SUCCEEDED` outcome. Emphasize:
"attempted" and "proven" are different things here — Panel 7 is what
proves it, not the adapter's own claim.

**1:25–1:40 — Stale/duplicate/unknown-outcome protection**
Switch briefly to Scenario C (stale approval) and/or Scenario D
(duplicate/replay) to show `SNAPSHOT_CHANGED` / idempotent duplicate
rejection. If time allows, mention Scenario E (unknown outcome →
`RECONCILIATION_REQUIRED` with a bounded retry budget) without switching.

**1:40–1:55 — Audit + replay**
Panel 8 (Audit): scroll the hash-chained timeline, point at the
"Hash chain verifies clean" line and the Advisory/System-decided tags per
row. Panel 10 (Replay): mention it reconstructs state purely from recorded
events — it never re-runs an agent or an adapter.

**1:55–2:00 — Closing line**

> "Agents can propose, disagree, and supply evidence. ControlDeck decides
> what the system is actually allowed to do."

## Notes for the recorder

- Use a fresh `pnpm --filter @controldeck/web dev` process and a clean
  browser profile — no other tabs, no extensions, no notification popups.
- Zoom/window size: 1440px wide recommended (matches the primary QA
  breakpoint and the reference screenshots).
- If a take is bad, re-run the scenario from the picker — the app has no
  hidden state between scenario switches, so there is nothing to "reset."
