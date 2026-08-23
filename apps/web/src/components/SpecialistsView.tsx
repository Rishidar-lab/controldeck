import type { WorkflowSnapshot } from "../types.js";
import { Badge } from "./Field.js";

export function SpecialistsView({ snapshot }: { readonly snapshot: WorkflowSnapshot }) {
  return (
    <section className="panel" aria-label="Specialist outputs" data-testid="specialists-view">
      <h2>2. Specialist Outputs (each shown separately — never merged)</h2>
      {snapshot.specialists.map((s) => (
        <div className="specialist-card" key={s.role} data-testid={`specialist-${s.role}`}>
          <h3>
            <span>{s.role}</span>
            <Badge kind="advisory">{`Advisory${s.implemented ? "" : " — not implemented"}`}</Badge>
          </h3>
          <p style={{ margin: "0 0 4px", fontSize: "0.8rem" }}>{s.summary}</p>
          {s.claimOrEvidenceRefs.length > 0 && <p style={{ margin: "0 0 4px", fontSize: "0.72rem" }}>Refs: {s.claimOrEvidenceRefs.join(", ")}</p>}
          {s.structuredOutput !== null && <pre className="raw-json">{JSON.stringify(s.structuredOutput, null, 2)}</pre>}
        </div>
      ))}
    </section>
  );
}
