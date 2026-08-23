/**
 * The provider abstraction every specialist runs through. `invoke` returns
 * `unknown` deliberately — a provider's raw output is never trusted, typed,
 * or interpreted here; that is entirely the calling specialist's (`planner.ts`
 * / `researcher.ts`) job, via a `.strict()` schema in `@controldeck/contracts`.
 * "Real provider only if already justified by spec, do not require paid/live
 * inference for core safety tests" — this module and `fixtures.ts` are all
 * that Gate 4's own tests use; nothing here calls a live model.
 */
export interface SpecialistProvider<TInput> {
  invoke(input: TInput): Promise<unknown>;
}

export type ProviderCallResult = { readonly ok: true; readonly raw: unknown } | { readonly ok: false; readonly reasonCode: "PROVIDER_TIMEOUT" | "PROVIDER_ERROR" };

/** Distinguishes "the timeout race won" from any other rejection the provider itself threw. */
class ProviderTimeoutSentinel extends Error {}

/**
 * Runs one provider call under a hard timeout (`AGENT_CONTRACTS.md`: 8s
 * Planner / 10s Researcher). Never throws — a timeout or a provider error is
 * just another `ProviderCallResult`, so a caller can never forget to handle
 * a rejected promise and accidentally treat a crashed agent as silent success.
 */
export async function callProvider<TInput>(provider: SpecialistProvider<TInput>, input: TInput, timeoutMs: number): Promise<ProviderCallResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new ProviderTimeoutSentinel("provider timeout")), timeoutMs);
  });

  try {
    const raw = await Promise.race([provider.invoke(input), timeout]);
    return { ok: true, raw };
  } catch (error) {
    if (error instanceof ProviderTimeoutSentinel) {
      return { ok: false, reasonCode: "PROVIDER_TIMEOUT" };
    }
    return { ok: false, reasonCode: "PROVIDER_ERROR" };
  } finally {
    clearTimeout(timer);
  }
}
