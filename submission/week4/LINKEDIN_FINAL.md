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

It's easy to make a multi-agent system *feel* safe by adding a "reviewer"
agent or a voting step. None of that is governance — it's still model
output, all the way down, and a confident wrong answer from a reviewer
agent can authorize a bad action just as easily as the original proposer.
ControlDeck draws the line differently:

**Agents propose. Evidence is assessed. Deterministic governance decides
what transitions are legal. Human approval binds authority where required.
Execution is controlled. Postconditions determine success. Audit
reconstructs what happened.**

Two specialists (Planner, Researcher) produce output — always labeled
**Advisory** in the UI, structurally incapable of constructing a workflow
transition, an approval, or an audit event. Evidence moves through three
stages — claim, evidence, verified fact — where "verified" means a
deterministic structural check, not a model's own claim of having
checked. A human approval binds to a specific plan hash, evidence
snapshot, and action; if any drift before it's consumed, it fails closed.

The recorded demo proves this live: I tried to forge an authoritative
audit event through the request payload, and it had zero effect on the
ledger's real, system-computed fields.

30-case adversarial evaluation: **19 PASS / 2 PARTIAL / 5 FAIL / 4
NOT_APPLICABLE.** I'm leading with that number on purpose — every gap is
root-caused: semantic evidence verification is structurally out of scope
by design, and two cases depend on a live orchestrator that doesn't exist
yet, reported honestly rather than papered over with a bolted-on
LLM-as-judge.

GitHub: https://github.com/Rishidar-lab/controldeck
Demo video: https://github.com/Rishidar-lab/controldeck/releases/tag/week4-demo-v1

#InnovationHacks #AIEngineering #AgentGovernance #AISafety

---

## Publishing checklist (do not skip)

- [x] Recorded the demo per `DEMO_SCRIPT.md` / `FINAL_RECORDING_SHOTLIST.md` / `NARRATION.md` — real Playwright capture of Scenarios A–D, local TTS narration, burned-in captions. Published as GitHub Release `week4-demo-v1`. Narration ran longer at a natural pace than the shot list's second-by-second budget assumed, so dwell times were extended to match rather than rushing the voiceover or cutting content — final runtime is ~2:45, not 90–120s.
- [x] Replaced the demo-video placeholder with the real, publicly-verified release URL above.
- [ ] Do not claim semantic evidence verification, a live orchestrator, or Risk/Verifier specialists — all explicitly disclaimed as not-yet-built in the README §14.
- [ ] Keep the evaluation number exactly as recorded (19/2/5/4) — do not round up or drop the PARTIAL/FAIL breakdown.
- [ ] Do not publish while any link above is still a placeholder.
- [ ] Record the resulting post URL in `submission/FINAL_SUBMISSION_MATRIX.md` once published.
