# Narration Script

Word-for-word narration matching [`FINAL_RECORDING_SHOTLIST.md`](FINAL_RECORDING_SHOTLIST.md).
Read at a natural pace — this comes in slightly under 120 seconds spoken
aloud. Adjust pacing live to the actual recording, not the other way
around.

---

**[0:00]**
"Several agents agreeing with each other is not governance. This is
ControlDeck — a system that decides what an AI-driven workflow is actually
allowed to do, and it's real, running code."

**[0:10]**
"Here's a workflow intake. Objective, current state — nothing hard-coded,
this is a live run through the real packages."

**[0:18]**
"Two specialists run: a Planner and a Researcher. Both are badged
'Advisory' — their output is a proposal, not a decision. Risk and Verifier
aren't built yet, and the UI says so honestly instead of faking them."

**[0:25]**
"Evidence moves through three stages: a claim, the evidence backing it —
both still advisory — and then a verified fact, which is the one
deterministic, structural check the system actually performed."

**[0:32]**
"When two verified assessments of the same claim disagree, that's a
conflict. It's never resolved by a vote or by picking whichever agent
sounded more confident — the resolution rule is fixed and shown right
here."

**[0:40]**
"Now the governance decision. Deterministic code reads the evidence and
risk inputs and decides: allow, deny, or require approval — with an exact
reason code attached. No model is ever asked 'should this be approved?'"

**[0:48]**
"That reason code — cumulative risk requiring approval — is the actual
output of policy code, not a summary of what an agent said."

**[0:55]**
"Because approval is required, here's the binding: this specific plan,
this specific evidence snapshot, this specific action. If any of those
three change before it's consumed, the approval doesn't carry over."

**[1:10]**
"With authority granted, execution happens through one narrow gateway —
capability-scoped, precondition-checked again right before the call."

**[1:18]**
"And critically: the adapter resolving isn't the same as it succeeding.
This postcondition check is what proves success — 'attempted' and 'proven'
are different things in this system."

**[1:25]**
"If the plan, evidence, or action changes after an approval was granted,
the system fails closed instead of reusing stale authority."

**[1:33]**
"And a duplicate execution attempt — say, a retried request — never
produces a second real side effect."

**[1:40]**
"Every one of these steps is recorded in a hash-chained audit ledger.
Advisory entries are tagged as model output; everything else is tagged
system-decided. The chain verifies clean."

**[1:48]**
"And this replay view reconstructs what happened purely by reading that
recorded history back — it never re-runs an agent or an adapter to
'redo' the workflow."

**[1:55]**
"Agents can propose, disagree, and supply evidence. ControlDeck decides
what the system is actually allowed to do."

---

## Delivery notes

- Keep a flat, factual tone — this is a system demo, not a pitch. Let the
  UI's own Advisory/Authoritative badges do the persuading.
- Do not editorialize about limitations during narration; the "not
  implemented" and structural-vs-semantic boundaries are already visible
  on screen and documented in the README — no need to apologize for them
  on camera.
