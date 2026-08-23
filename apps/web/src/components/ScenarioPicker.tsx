import { SCENARIOS, type ScenarioKey } from "../scenarios.js";

export function ScenarioPicker({ active, onSelect }: { readonly active: ScenarioKey; readonly onSelect: (key: ScenarioKey) => void }) {
  return (
    <div className="scenario-picker" role="tablist" aria-label="Hero scenario">
      {(Object.keys(SCENARIOS) as ScenarioKey[]).map((key) => (
        <button key={key} type="button" className="scenario-btn" role="tab" aria-pressed={key === active} onClick={() => onSelect(key)}>
          {key}. {SCENARIOS[key].title}
        </button>
      ))}
    </div>
  );
}
