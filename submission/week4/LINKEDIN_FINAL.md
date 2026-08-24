# Week 4 LinkedIn Post — Final Draft (ControlDeck)

**Status: content final, grounded only in claims the frozen implementation
actually supports** (`submission/week4/WEEK4_FREEZE.md`,
`submission/week4/SUBMISSION_READINESS.md`, `docs/EVALUATION.md`). The demo
video is now real and public (GitHub Release `week4-demo-v1`); the
resulting LinkedIn post URL is the one remaining placeholder — it cannot
exist until this is actually published.

---

**Multi-agent agreement is not governance.**

For Innovation Hacks Week 4, I built **ControlDeck** — the layer that
decides what an AI-driven workflow is actually allowed to do, independent
of how many agents agree it's a good idea.

The problem I kept running into designing this: it's easy to make a
multi-agent system *feel* safe by adding a "reviewer" agent, a "risk"
agent, a voting step. None of that is actually governance — it's still
model output, all the way down, and a confident wrong answer from a
reviewer agent is just as capable of authorizing a bad action as the
original proposer was. So ControlDeck draws the line differently:

**Agents propose. Evidence is assessed. Deterministic governance decides
what transitions are legal. Human approval binds authority where required.
Execution is controlled. Postconditions determine success. Audit
reconstructs what happened.**

- Two specialists (Planner, Researcher) run and produce output — always
  labeled **Advisory** in the UI, never merged into a generic "assistant
  said so" blob, and structurally incapable of constructing a workflow
  transition, an approval, an execution capability, or an audit event.
- Evidence moves through three real stages — claim, evidence, verified
  fact — where "verified" means a deterministic structural check
  (provenance, integrity, freshness), not a model's own claim of having
  checked something.
- A human approval binds to a specific plan hash, evidence snapshot, and
  action — if any of those three drift before the approval is consumed,
  it fails closed instead of silently carrying over.
- Execution runs through exactly one capability-scoped gateway; a
  resolved adapter call isn't "success" until an independent postcondition
  check proves it, and an ambiguous outcome gets a bounded retry budget
  instead of an infinite blind retry.
- Every step lands in a hash-chained audit ledger a model cannot author —
  proven live by trying to forge an authoritative event through the
  payload and watching it have zero effect on the ledger's real,
  system-computed fields.

30-case adversarial evaluation: **19 PASS / 2 PARTIAL / 5 FAIL / 4
NOT_APPLICABLE.** I'm leading with that number on purpose — every FAIL and
PARTIAL is root-caused and disclosed rather than smoothed over: semantic
evidence verification is structurally out of scope by design (the system
checks provenance and integrity, never claim *truth*), and no live
orchestrator exists yet, so two cases that depend on one are honestly
reported as not-yet-demonstrated rather than faked with a bolted-on
LLM-as-judge to inflate the score.

GitHub: https://github.com/Rishidar-lab/controldeck
Demo video: https://github.com/Rishidar-lab/controldeck/releases/tag/week4-demo-v1

#InnovationHacks #AIEngineering #AgentGovernance #TypeScript #AISafety
**[ADD OFFICIAL INNOVATION HACKS TAG/HANDLE/URL IF the program specifies one beyond the hashtag]**

---

## Publishing checklist (do not skip)

- [x] Recorded the demo per `DEMO_SCRIPT.md` / `FINAL_RECORDING_SHOTLIST.md` / `NARRATION.md` — real Playwright capture of Scenarios A–D, local TTS narration, burned-in captions. Published as GitHub Release `week4-demo-v1`. Narration ran longer at a natural pace than the shot list's second-by-second budget assumed, so dwell times were extended to match rather than rushing the voiceover or cutting content — final runtime is ~2:45, not 90–120s.
- [x] Replaced the demo-video placeholder with the real, publicly-verified release URL above.
- [ ] Do not claim semantic evidence verification, a live orchestrator, or Risk/Verifier specialists — all explicitly disclaimed as not-yet-built in the README §14.
- [ ] Keep the evaluation number exactly as recorded (19/2/5/4) — do not round up or drop the PARTIAL/FAIL breakdown.
- [ ] Do not publish while any link above is still a placeholder.
- [ ] Record the resulting post URL in `submission/FINAL_SUBMISSION_MATRIX.md` once published.
