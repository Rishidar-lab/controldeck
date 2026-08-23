import type { WorkflowSnapshot } from "../types.js";
import { Badge } from "./Field.js";

export function AuditView({ snapshot }: { readonly snapshot: WorkflowSnapshot }) {
  return (
    <section className="panel" aria-label="Audit timeline" data-testid="audit-view">
      <h2>
        8. Audit Timeline <Badge kind="authoritative">Server-authored</Badge>
      </h2>
      <table className="audit-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Event type</th>
            <th>Actor</th>
            <th>Content</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.audit.map((entry) => (
            <tr key={entry.sequence} data-testid="audit-row">
              <td>{entry.sequence}</td>
              <td>{entry.type}</td>
              <td>
                {entry.actorKind}:{entry.actorId}
              </td>
              <td>{entry.advisoryContent ? <Badge kind="advisory">Advisory (model output)</Badge> : <Badge kind="authoritative">System-decided</Badge>}</td>
              <td>{entry.occurredAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {snapshot.integrity.checked && (
        <p className={snapshot.integrity.ok ? "integrity-ok" : "integrity-fail"} data-testid="integrity-status">
          {snapshot.integrity.ok ? "Hash chain verifies clean." : `INTEGRITY FAILURE: ${snapshot.integrity.reasonCode} at sequence ${snapshot.integrity.brokenAtSequence}`}
        </p>
      )}
      <p className="disclaimer">Every row here is server-authored — the ledger's own append() call, never a model's own claim. "Advisory" marks whose ARTIFACT caused the event, not who wrote the event record itself.</p>
    </section>
  );
}
