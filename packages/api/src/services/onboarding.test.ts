import { describe, expect, it } from "vitest";

import {
  furthestStep,
  resolveStep,
  type OnboardingState,
} from "./onboarding";

const fresh: OnboardingState = {
  hasMembership: false,
  supersetConnected: false,
  organizationHasProjects: false,
  hasAgentName: false,
};

const state = (over: Partial<OnboardingState> = {}): OnboardingState => ({
  ...fresh,
  ...over,
});

describe("furthestStep", () => {
  it("starts a brand new user at the workspace step", () => {
    expect(furthestStep(fresh)).toBe("workspace");
  });

  it("sends an invitee straight to connect, because they already have a team", () => {
    expect(furthestStep(state({ hasMembership: true }))).toBe("connect");
  });

  it("asks for projects once Superset is connected", () => {
    expect(
      furthestStep(state({ hasMembership: true, supersetConnected: true })),
    ).toBe("projects");
  });

  it("skips the project picker when the workspace already has projects", () => {
    expect(
      furthestStep(
        state({
          hasMembership: true,
          supersetConnected: true,
          organizationHasProjects: true,
        }),
      ),
    ).toBe("agent");
  });

  it("is done once the agent is named", () => {
    expect(
      furthestStep(
        state({
          hasMembership: true,
          supersetConnected: true,
          organizationHasProjects: true,
          hasAgentName: true,
        }),
      ),
    ).toBe("done");
  });

  it("is done with an agent but no projects — a sleeping laptop must not strand anyone", () => {
    expect(
      furthestStep(
        state({
          hasMembership: true,
          supersetConnected: true,
          organizationHasProjects: false,
          hasAgentName: true,
        }),
      ),
    ).toBe("done");
  });
});

describe("resolveStep", () => {
  const atProjects = state({ hasMembership: true, supersetConnected: true });

  it("ignores the URL when no step is requested", () => {
    expect(resolveStep(atProjects)).toBe("projects");
    expect(resolveStep(atProjects, null)).toBe("projects");
  });

  it("lets someone skip the project picker forward to naming their agent", () => {
    expect(resolveStep(atProjects, "agent")).toBe("agent");
  });

  it("keeps the skip across a refresh, since it lives in the URL", () => {
    expect(resolveStep(atProjects, "agent")).toBe("agent");
    expect(resolveStep(atProjects, "agent")).toBe("agent");
  });

  it("refuses to jump ahead of what has actually been done", () => {
    expect(resolveStep(state({ hasMembership: true }), "agent")).toBe("connect");
    expect(resolveStep(fresh, "agent")).toBe("workspace");
  });

  it("ignores any step name other than the one skip we allow", () => {
    expect(resolveStep(fresh, "done")).toBe("workspace");
    expect(resolveStep(fresh, "projects")).toBe("workspace");
    expect(resolveStep(atProjects, "nonsense")).toBe("projects");
  });

  it("does not hold someone on agent once they are finished", () => {
    const finished = state({
      hasMembership: true,
      supersetConnected: true,
      organizationHasProjects: true,
      hasAgentName: true,
    });
    expect(resolveStep(finished, "agent")).toBe("done");
  });
});
