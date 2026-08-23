import type { WorkflowSnapshot } from "../types.js";
import { Badge, Field } from "./Field.js";

const STATUS_BADGE = { NOT_REQUIRED: "authoritative", PENDING: "warn", MATCHED: "allow", STALE: "deny", REJECTED: "deny" } as const;

export function ApprovalView({ snapshot }: { readonly snapshot: WorkflowSnapshot }) {
  const a = snapshot.approval;
  return (
    <section className="panel" aria-label="Human approval" data-testid="approval-view">
      <h2>
        5. Human Approval <Badge kind="authoritative">Authoritative</Badge>
      </h2>
      <div className="field-row">
        <span className="field-label">Status</span>
        <span className="field-value">
          <Badge kind={STATUS_BADGE[a.status]}>{a.status}</Badge>
        </span>
      </div>
      {a.required && (
        <>
          <Field label="Proposal identity (plan hash)" value={a.proposalIdentity ?? "—"} />
          <Field label="Evidence snapshot" value={a.evidenceSnapshot ?? "—"} />
          <Field label="Resource" value={a.resource ?? "—"} />
          <Field label="Action" value={a.action ?? "—"} />
          <Field label="Expires at" value={a.expiresAt ?? "—"} />
          <Field label="Consumed" value={a.consumed ? "yes" : "no"} />
          {a.reasonCodes && a.reasonCodes.length > 0 && <Field label="Reason code(s)" value={a.reasonCodes.join(", ")} />}
        </>
      )}
    </section>
  );
}
