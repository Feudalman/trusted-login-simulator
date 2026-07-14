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
  const popup = { close: vi.fn() } as unknown as Window;
  const deps: LoginDependencies = {
    openWindow: vi.fn(() => ({ popup, target: "trusted-window" })),
    signToken: vi.fn(async () => ({
      token: "signed.jwt.value",
      header: { alg: "RS256", typ: "JWT" },
      payload: {
        iss: "trusted-client",
        sub: "external-user-1",
        username: "alice",
      },
    })),
    submit: vi.fn(),
    ...overrides,
  };
  return { deps, popup };
}

describe("startTrustedLogin", () => {
  it("opens the window synchronously, signs, submits, and returns a safe preview", async () => {
    const { deps, popup } = dependencies();

    const resultPromise = startTrustedLogin(validForm(), deps);

    expect(deps.openWindow).toHaveBeenCalledOnce();
    const result = await resultPromise;
    expect(deps.signToken).toHaveBeenCalledOnce();
    expect(deps.submit).toHaveBeenCalledWith(
      "signed.jwt.value",
      "horizon",
      "trusted-window",
    );
    expect(popup.close).not.toHaveBeenCalled();
    expect(result).toEqual({
      header: { alg: "RS256", typ: "JWT" },
      payload: {
        iss: "trusted-client",
        sub: "external-user-1",
        username: "alice",
      },
    });
  });

  it("validates before opening a window", async () => {
    const { deps } = dependencies();

    await expect(
      startTrustedLogin({ ...validForm(), provider: "" }, deps),
    ).rejects.toThrow("Provider");

    expect(deps.openWindow).not.toHaveBeenCalled();
  });

  it("closes the blank window when signing fails", async () => {
    const error = new Error("无法签名");
    const { deps, popup } = dependencies({
      signToken: vi.fn(async () => Promise.reject(error)),
    });

    await expect(startTrustedLogin(validForm(), deps)).rejects.toBe(error);

    expect(popup.close).toHaveBeenCalledOnce();
    expect(deps.submit).not.toHaveBeenCalled();
  });

  it("closes the blank window when form submission fails", async () => {
    const error = new Error("无法提交");
    const { deps, popup } = dependencies({
      submit: vi.fn(() => {
        throw error;
      }),
    });

    await expect(startTrustedLogin(validForm(), deps)).rejects.toBe(error);
    expect(popup.close).toHaveBeenCalledOnce();
  });
});
