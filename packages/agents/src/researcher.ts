import { RawEvidenceBundle, type EvidenceBundleCandidate, type SpecialistOutputRejectionReason } from "@controldeck/contracts";
import { callProvider, type SpecialistProvider } from "./provider.js";

/** `AGENT_CONTRACTS.md`: "Goal, plan step, evidence snapshot." */
export interface ResearcherInput {
  readonly goal: string;
  readonly planStepId: string;
  readonly expectedSnapshotId: string;
  readonly tenantId: string;
}

/** `AGENT_CONTRACTS.md`: "10s; 1 retry; missing evidence is first-class." */
const RESEARCHER_TIMEOUT_MS = 10000;

const MAX_RESEARCHER_OUTPUT_BYTES = 64 * 1024;

export type ResearcherOutcome =
  | { readonly ok: true; readonly bundle: EvidenceBundleCandidate }
  | { readonly ok: false; readonly reasonCode: SpecialistOutputRejectionReason; readonly details: string };

/**
 * Runs the Researcher provider and validates its raw output against
 * `RawEvidenceBundle`. The resulting `EvidenceBundleCandidate` is a
 * CANDIDATE, not evidence: it carries no verdict field at all (there is no
 * such field in the schema — a researcher "cannot self-verify its own
 * evidence" is a fact about this type, not a rule enforced elsewhere). Only
 * `@controldeck/evidence`'s `assessClaim` (Gate 2), fed a `Claim` plus this
 * bundle plus the caller's OWN `expectedSnapshotId`, can ever produce a
 * `ClaimAssessment` — and that function re-derives its answer from
 * structural/provenance checks, never from anything this bundle asserts
 * about itself.
 */
export async function runResearcher(provider: SpecialistProvider<ResearcherInput>, input: ResearcherInput): Promise<ResearcherOutcome> {
  const call = await callProvider(provider, input, RESEARCHER_TIMEOUT_MS);
  if (!call.ok) {
    return { ok: false, reasonCode: call.reasonCode, details: `researcher provider failed: ${call.reasonCode}` };
  }

  const raw = call.raw;
  const serialized = typeof raw === "string" ? raw : (JSON.stringify(raw) ?? "");
  if (Buffer.byteLength(serialized, "utf8") > MAX_RESEARCHER_OUTPUT_BYTES) {
    return { ok: false, reasonCode: "OVERSIZED_OUTPUT", details: "researcher output exceeds size limit" };
  }

  let candidate: unknown = raw;
  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(raw);
    } catch (error) {
      return { ok: false, reasonCode: "MALFORMED_JSON", details: error instanceof Error ? error.message : "invalid JSON" };
    }
  }

  const result = RawEvidenceBundle.safeParse(candidate);
  if (!result.success) {
    return { ok: false, reasonCode: "SCHEMA_INVALID", details: result.error.message };
  }

  return { ok: true, bundle: result.data };
}
