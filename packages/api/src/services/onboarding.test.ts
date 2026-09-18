import { describe, expect, it } from "vitest";

import { furthestStep, resolveStep, type OnboardingState } from "./onboarding";

const fresh: OnboardingState = {
  hasInvitations: false,
  hasMembership: false,
  supersetKeyStored: false,
  supersetOrgChosen: false,
  organizationHasProjects: false,
  hasAgentName: false,
};

const state = (over: Partial<OnboardingState> = {}): OnboardingState => ({
  ...fresh,
  ...over,
});

const connected = {
  hasMembership: true,
  supersetKeyStored: true,
  supersetOrgChosen: true,
};

describe("furthestStep", () => {
  it("starts a brand new user at the workspace step", () => {
    expect(furthestStep(fresh)).toBe("workspace");
  });

  it("sends an invitee straight to connect", () => {
    expect(furthestStep(state({ hasMembership: true }))).toBe("connect");
  });

  it("offers the waiting team before offering to make a new one", () => {
    expect(furthestStep(state({ hasInvitations: true }))).toBe("invitations");
  });

  it("does not interrupt someone who already joined", () => {
    expect(
      furthestStep(state({ hasInvitations: true, hasMembership: true })),
    ).toBe("connect");
  });

  it("asks which Superset org once a key is stored", () => {
    expect(
      furthestStep(state({ hasMembership: true, supersetKeyStored: true })),
    ).toBe("organization");
  });

  it("asks for projects once an org is chosen", () => {
    expect(furthestStep(state(connected))).toBe("projects");
  });

  it("skips the picker when the workspace already has projects", () => {
    expect(
      furthestStep(state({ ...connected, organizationHasProjects: true })),
    ).toBe("agent");
  });

  it("is done once the agent is named", () => {
    expect(
      furthestStep(
        state({
          ...connected,
          organizationHasProjects: true,
          hasAgentName: true,
        }),
      ),
    ).toBe("done");
  });

  it("is done with an agent but no projects, so a sleeping laptop strands nobody", () => {
    expect(furthestStep(state({ ...connected, hasAgentName: true }))).toBe(
      "done",
    );
  });

  it("does not skip the org step just because a key exists", () => {
    expect(
      furthestStep(
        state({
          hasMembership: true,
          supersetKeyStored: true,
          organizationHasProjects: true,
          hasAgentName: true,
        }),
      ),
    ).toBe("organization");
  });
});

describe("resolveStep", () => {
  const atProjects = state(connected);

  it("ignores the URL when no step is requested", () => {
    expect(resolveStep(atProjects)).toBe("projects");
    expect(resolveStep(atProjects, null)).toBe("projects");
  });

  it("lets someone skip the picker forward to naming their agent", () => {
    expect(resolveStep(atProjects, "agent")).toBe("agent");
  });

  it("refuses to jump ahead of what has actually been done", () => {
    expect(resolveStep(state({ hasMembership: true }), "agent")).toBe("connect");
    expect(
      resolveStep(
        state({ hasMembership: true, supersetKeyStored: true }),
        "agent",
      ),
    ).toBe("organization");
    expect(resolveStep(fresh, "agent")).toBe("workspace");
    expect(resolveStep(state({ hasInvitations: true }), "agent")).toBe(
      "invitations",
    );
  });

  it("ignores any step name other than the two skips we allow", () => {
    expect(resolveStep(fresh, "done")).toBe("workspace");
    expect(resolveStep(atProjects, "nonsense")).toBe("projects");
  });

  it("lets someone turn down their invitations and start their own workspace", () => {
    expect(resolveStep(state({ hasInvitations: true }), "workspace")).toBe(
      "workspace",
    );
  });

  it("does not let the workspace skip drag anyone backwards", () => {
    expect(resolveStep(atProjects, "workspace")).toBe("projects");
    expect(resolveStep(state({ hasMembership: true }), "workspace")).toBe(
      "connect",
    );
  });

  it("does not hold someone on agent once they are finished", () => {
    expect(
      resolveStep(
        state({
          ...connected,
          organizationHasProjects: true,
          hasAgentName: true,
        }),
        "agent",
      ),
    ).toBe("done");
  });
});
