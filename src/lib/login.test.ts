import { describe, expect, it, vi } from "vitest";
import { defaultForm, type SimulatorForm } from "./config";
import { startTrustedLogin, type LoginDependencies } from "./login";

function validForm(): SimulatorForm {
  return {
    ...defaultForm(),
    provider: "horizon",
    privateKey: "private-key",
    issuer: "trusted-client",
    externalUserId: "external-user-1",
    username: "alice",
  };
}

function dependencies(overrides: Partial<LoginDependencies> = {}) {
  const deps: LoginDependencies = {
    signToken: vi.fn(async () => ({
      token: "signed.jwt.value",
      header: { alg: "RS256", typ: "JWT" },
      payload: {
        iss: "trusted-client",
        sub: "external-user-1",
        username: "alice",
      },
    })),
    probe: vi.fn(async () => ({
      status: 302,
      location: "https://swan.example.com/sso?state=state-1",
    })),
    ...overrides,
  };
  return { deps };
}

describe("startTrustedLogin", () => {
  it("signs the token, probes the redirect target, and returns both", async () => {
    const { deps } = dependencies();

    const result = await startTrustedLogin(validForm(), deps);

    expect(deps.signToken).toHaveBeenCalledOnce();
    expect(deps.probe).toHaveBeenCalledWith(
      "signed.jwt.value",
      "https://commercial.internal.powerducker.com",
      "horizon",
    );
    expect(result).toEqual({
      header: { alg: "RS256", typ: "JWT" },
      payload: {
        iss: "trusted-client",
        sub: "external-user-1",
        username: "alice",
      },
      redirect: {
        status: 302,
        location: "https://swan.example.com/sso?state=state-1",
      },
    });
  });

  it("validates the form before signing or probing", async () => {
    const { deps } = dependencies();

    await expect(
      startTrustedLogin({ ...validForm(), provider: "" }, deps),
    ).rejects.toThrow("Provider");

    expect(deps.signToken).not.toHaveBeenCalled();
    expect(deps.probe).not.toHaveBeenCalled();
  });

  it("propagates signing errors without probing", async () => {
    const { deps } = dependencies({
      signToken: vi.fn(async () => {
        throw new Error("无法读取 PKCS#8 私钥");
      }),
    });

    await expect(startTrustedLogin(validForm(), deps)).rejects.toThrow(
      "无法读取 PKCS#8 私钥",
    );
    expect(deps.probe).not.toHaveBeenCalled();
  });

  it("appends the manual redirectTo value to the intercepted location", async () => {
    const { deps } = dependencies();

    const result = await startTrustedLogin(
      { ...validForm(), redirectTo: "@admin/test/v1/hgcyig/runs/test-2/chart" },
      deps,
    );

    expect(result.redirect.location).toBe(
      "https://swan.example.com/sso?state=state-1&redirectTo=%40admin%2Ftest%2Fv1%2Fhgcyig%2Fruns%2Ftest-2%2Fchart",
    );
  });

  it("propagates probe errors", async () => {
    const { deps } = dependencies({
      probe: vi.fn(async () => {
        throw new Error("无法访问上游回调：超时");
      }),
    });

    await expect(startTrustedLogin(validForm(), deps)).rejects.toThrow(
      "无法访问上游回调：超时",
    );
  });
});
