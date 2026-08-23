import type { WorkflowSnapshot } from "../types.js";
import { Badge } from "./Field.js";

export function EvidenceView({ snapshot }: { readonly snapshot: WorkflowSnapshot }) {
  return (
    <section className="panel" aria-label="Evidence panel" data-testid="evidence-view">
      <h2>3. Evidence Panel</h2>
      {snapshot.evidence.length === 0 && <p style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>No evidence in this scenario.</p>}
      {snapshot.evidence.map((item) => (
        <div className={`evidence-item kind-${item.kind}`} key={item.id} data-testid={`evidence-${item.kind}`}>
          <h4>
            {item.kind} <Badge kind={item.advisory ? "advisory" : "authoritative"}>{item.advisory ? "Advisory" : "Authoritative"}</Badge>
          </h4>
          <div style={{ fontSize: "0.78rem" }}>{item.text}</div>
          <div className="field-row">
            <span className="field-label">Producer</span>
            <span className="field-value">{item.producer}</span>
          </div>
          {item.source && (
            <div className="field-row">
              <span className="field-label">Source</span>
              <span className="field-value">{item.source}</span>
            </div>
          )}
          {item.integrity && (
            <div className="field-row">
              <span className="field-label">Integrity</span>
              <span className="field-value">{item.integrity}</span>
            </div>
          )}
          {item.freshness && (
            <div className="field-row">
              <span className="field-label">Freshness</span>
              <span className="field-value">{item.freshness}</span>
            </div>
          )}
          {item.verificationStatus && (
            <div className="field-row">
              <span className="field-label">Verification status</span>
              <span className="field-value">{item.verificationStatus}</span>
            </div>
          )}
          {item.snapshotId && (
            <div className="field-row">
              <span className="field-label">Snapshot</span>
              <span className="field-value">{item.snapshotId}</span>
            </div>
          )}
        </div>
      ))}
      <p className="disclaimer">A VERIFIED FACT here means structural provenance passed (hash, tenant, snapshot freshness) — it is NOT a claim of semantic truth. See w4-003/w4-014/w4-017 in the evaluation report.</p>
    </section>
  );
}
