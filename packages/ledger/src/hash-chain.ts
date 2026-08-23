import type { AuditActorKind, AuditEventType, AuditSubjectKind } from "@controldeck/contracts";
import type { Clock, IdGenerator } from "@controldeck/domain";
import { hashCanonical } from "@controldeck/domain";
import { redactPayload } from "./redact.js";

/** The `prevHash` of sequence 1 — there is no real predecessor event to point to. */
export const GENESIS_HASH = "sha256:genesis";

/**
 * Everything a caller supplies for one event; everything else
 * (`eventId`, `sequence`, `occurredAt`, `prevHash`, `hash`) is derived by
 * `AuditLedger.append` alone. `actor.kind` MAY be `"model"` — that is how
 * the ledger records WHOSE artifact caused this event — but nothing
 * about the entry's own authoritative shape (its type, its position in
 * the chain, its hash) is ever read from anywhere a model's output could
 * reach: there is no `AuditEventInput` field a model produces directly,
 * only server code that has already decided a real event happened
 * constructs one of these ("The model may produce an artifact that
 * causes a server event, but it cannot emit an authoritative event
 * directly" — EVENT_SCHEMA.md).
 */
export interface AuditEventInput {
  readonly type: AuditEventType;
  readonly actor: { readonly kind: AuditActorKind; readonly id: string };
  readonly subject: { readonly kind: AuditSubjectKind; readonly id: string };
  readonly payload: Record<string, unknown>;
  readonly workflowId?: string;
  readonly operationId?: string;
  readonly policyVersion?: string;
  readonly correlationId?: string;
}

export interface AuditLedgerEntry {
  readonly eventId: string;
  readonly sequence: number;
  readonly type: AuditEventType;
  readonly actor: { readonly kind: AuditActorKind; readonly id: string };
  readonly subject: { readonly kind: AuditSubjectKind; readonly id: string };
  readonly payload: Record<string, unknown>;
  readonly occurredAt: string;
  readonly prevHash: string;
  readonly hash: string;
  readonly workflowId?: string;
  readonly operationId?: string;
  readonly policyVersion?: string;
  readonly correlationId?: string;
}

/**
 * `hash = SHA-256(canonical(event_without_hash))`. Because `prevHash` is
 * itself a field of `entryWithoutHash`, canonicalizing and hashing the
 * whole object already folds the chain link into the digest. EVERY
 * authoritative field is part of this hash — `type`, `sequence`,
 * `actor`, `subject`, `payload` (redacted, but still hashed), `occurredAt`,
 * `prevHash`, `workflowId`, `operationId`, `policyVersion`,
 * `correlationId` — so changing ANY one of them after the fact (a reason
 * code buried in `payload`, an evidence reference, a governance result)
 * changes the hash and is detected by `verifyLedgerIntegrity`
 * (`integrity.ts`). This is the exact load-bearing property the Gate 8
 * mutation test targets: excluding even one field from this computation
 * would let that field be silently altered without detection.
 */
export function computeEntryHash(entryWithoutHash: Omit<AuditLedgerEntry, "hash">): string {
  return hashCanonical(entryWithoutHash);
}

export function buildLedgerEntry(input: AuditEventInput, sequence: number, prevHash: string, idGenerator: IdGenerator, clock: Clock): AuditLedgerEntry {
  const entryWithoutHash: Omit<AuditLedgerEntry, "hash"> = {
    eventId: idGenerator.next("evt"),
    sequence,
    type: input.type,
    actor: input.actor,
    subject: input.subject,
    payload: redactPayload(input.payload),
    occurredAt: clock.now().toISOString(),
    prevHash,
    ...(input.workflowId !== undefined ? { workflowId: input.workflowId } : {}),
    ...(input.operationId !== undefined ? { operationId: input.operationId } : {}),
    ...(input.policyVersion !== undefined ? { policyVersion: input.policyVersion } : {}),
    ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
  };
  return { ...entryWithoutHash, hash: computeEntryHash(entryWithoutHash) };
}
