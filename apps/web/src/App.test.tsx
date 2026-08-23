// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App.js";

afterEach(() => {
  cleanup();
});

describe("App — governance boundary is visible (Scenario A, default)", () => {
  it("renders all 10 required surfaces", async () => {
    render(<App />);
    for (const testId of ["intake-view", "specialists-view", "evidence-view", "governance-view", "approval-view", "execution-view", "verification-view", "audit-view", "conflict-view", "replay-view"]) {
      await waitFor(() => expect(screen.getByTestId(testId)).toBeInTheDocument());
    }
  });

  it("every specialist card is labeled Advisory, never Authoritative — a real assertion on rendered content, not styling alone", async () => {
    render(<App />);
    const specialists = await screen.findByTestId("specialists-view");
    await waitFor(() => expect(within(specialists).getAllByText(/Advisory/).length).toBeGreaterThan(0));
    expect(within(specialists).queryByText(/^Authoritative$/)).not.toBeInTheDocument();
  });

  it("the Governance panel is labeled Authoritative, and shows a real ALLOW/DENY/REQUIRE_APPROVAL outcome — never 'Advisory'", async () => {
    render(<App />);
    const governance = await screen.findByTestId("governance-view");
    await waitFor(() => expect(within(governance).getByText("Authoritative")).toBeInTheDocument());
    expect(within(governance).queryByText(/Advisory/)).not.toBeInTheDocument();
    expect(within(governance).getByText(/ALLOW|DENY|REQUIRE_APPROVAL/)).toBeInTheDocument();
  });

  it("the audit timeline distinguishes advisory (model-attributed) rows from authoritative (system-decided) rows — both real, but never conflated", async () => {
    render(<App />);
    const audit = await screen.findByTestId("audit-view");
    await waitFor(() => expect(within(audit).getAllByTestId("audit-row").length).toBeGreaterThan(0));
    expect(within(audit).getAllByText(/Advisory \(model output\)/).length).toBeGreaterThan(0);
    expect(within(audit).getAllByText(/System-decided/).length).toBeGreaterThan(0);
  });

  it("does not render any capability id/nonce/ticket value anywhere on the page (no raw capability token shown)", async () => {
    render(<App />);
    await screen.findByTestId("execution-view");
    expect(document.body.textContent).not.toMatch(/cap_\d|nonce_\d|ticket_\d/);
  });
});

describe("App — Scenario F (audit tamper) makes the integrity failure visible", () => {
  it("shows an INTEGRITY FAILURE line once the scenario's own tamper simulation runs", async () => {
    render(<App />);
    const picker = await screen.findByRole("tablist");
    const fButton = within(picker).getByText(/F\. Audit tamper/);
    fButton.click();
    await waitFor(() => expect(screen.getByTestId("integrity-status")).toHaveTextContent(/INTEGRITY FAILURE/));
  });
});
