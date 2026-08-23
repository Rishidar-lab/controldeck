import type { WorkflowSnapshot } from "../types.js";
import { Badge } from "./Field.js";

export function ReplayView({ snapshot }: { readonly snapshot: WorkflowSnapshot }) {
  return (
    <section className="panel" aria-label="Replay / projection" data-testid="replay-view">
      <h2>
        10. Replay / Projection <Badge kind="authoritative">Read-only</Badge>
      </h2>
      <p style={{ fontSize: "0.82rem" }}>
        Reconstructed from <strong>{snapshot.audit.length}</strong> already-recorded ledger event(s). This is a pure fold over history (<code>projectWorkflow</code>, Gate 8) — it does not call a model, an adapter, or re-run any agent.
      </p>
      <p className="disclaimer">Replaying is reading the past, never regenerating it.</p>
    </section>
  );
}
