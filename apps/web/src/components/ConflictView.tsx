import type { WorkflowSnapshot } from "../types.js";
import { Badge } from "./Field.js";

export function ConflictView({ snapshot }: { readonly snapshot: WorkflowSnapshot }) {
  const c = snapshot.conflict;
  return (
    <section className={`panel ${c.present ? "conflict-panel" : ""}`} aria-label="Conflict state" data-testid="conflict-view">
      <h2>
        9. Conflict State {c.present && <Badge kind="warn">Disagreement detected</Badge>}
      </h2>
      {!c.description && <p style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>No disagreement to show.</p>}
      {c.description && <p style={{ fontSize: "0.82rem" }}>{c.description}</p>}
      {c.resolution && (
        <p style={{ fontSize: "0.82rem", fontWeight: 600 }}>
          <Badge kind="authoritative">Deterministic resolution</Badge> {c.resolution}
        </p>
      )}
    </section>
  );
}
