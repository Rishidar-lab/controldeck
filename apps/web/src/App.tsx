import { useEffect, useState } from "react";
import "./App.css";
import { ApprovalView } from "./components/ApprovalView.js";
import { AuditView } from "./components/AuditView.js";
import { ConflictView } from "./components/ConflictView.js";
import { EvidenceView } from "./components/EvidenceView.js";
import { ExecutionView } from "./components/ExecutionView.js";
import { GovernanceView } from "./components/GovernanceView.js";
import { IntakeView } from "./components/IntakeView.js";
import { ReplayView } from "./components/ReplayView.js";
import { ScenarioPicker } from "./components/ScenarioPicker.js";
import { SpecialistsView } from "./components/SpecialistsView.js";
import { VerificationView } from "./components/VerificationView.js";
import { SCENARIOS, type ScenarioKey } from "./scenarios.js";
import type { WorkflowSnapshot } from "./types.js";

export function App() {
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>("A");
  const [snapshot, setSnapshot] = useState<WorkflowSnapshot | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(undefined);
    setError(undefined);
    Promise.resolve(SCENARIOS[scenarioKey].run())
      .then((result) => {
        if (!cancelled) setSnapshot(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [scenarioKey]);

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1 className="app-title">ControlDeck — Operator Console</h1>
          <p className="app-subtitle">AI intent is not authority to act. Every panel below is either marked Advisory (a specialist's proposal) or Authoritative (a deterministic system decision) — never merged.</p>
        </div>
        <ScenarioPicker active={scenarioKey} onSelect={setScenarioKey} />
      </header>

      {error && (
        <div className="panel" role="alert" data-testid="scenario-error">
          Scenario failed to run: {error}
        </div>
      )}

      {!snapshot && !error && <div className="panel">Running scenario…</div>}

      {snapshot && (
        <div className="grid">
          <IntakeView snapshot={snapshot} />
          <SpecialistsView snapshot={snapshot} />
          <EvidenceView snapshot={snapshot} />
          <GovernanceView snapshot={snapshot} />
          <ApprovalView snapshot={snapshot} />
          <ExecutionView snapshot={snapshot} />
          <VerificationView snapshot={snapshot} />
          <AuditView snapshot={snapshot} />
          <ConflictView snapshot={snapshot} />
          <ReplayView snapshot={snapshot} />
        </div>
      )}
    </div>
  );
}
