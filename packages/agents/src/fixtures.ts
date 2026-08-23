import type { SpecialistProvider } from "./provider.js";

/**
 * Deterministic test/fixture providers. "Do not require paid/live inference
 * for core safety tests" — every Gate 4 test runs through one of these, never
 * a real model.
 */

/** Always returns the same (or input-derived) raw output. */
export function fixtureProvider<TInput>(value: unknown | ((input: TInput) => unknown)): SpecialistProvider<TInput> {
  return {
    invoke: async (input) => (typeof value === "function" ? (value as (i: TInput) => unknown)(input) : value),
  };
}

/** Simulates a provider crash (network error, malformed transport, etc). */
export function throwingProvider<TInput>(error: Error = new Error("simulated provider failure")): SpecialistProvider<TInput> {
  return {
    invoke: async () => {
      throw error;
    },
  };
}

/** Simulates a provider that never resolves within the caller's timeout. */
export function hangingProvider<TInput>(): SpecialistProvider<TInput> {
  return {
    invoke: () => new Promise(() => undefined),
  };
}
