import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCallbackUrl, openLoginWindow, submitToken } from "./submit";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("buildCallbackUrl", () => {
  it("uses the fixed SwanLab origin and encodes provider as one segment", () => {
    expect(buildCallbackUrl("horizon / dev")).toBe(
      "https://swanlab.aruing.top/api/auth/sso/trusted/callback/horizon%20%2F%20dev",
    );
  });
});

describe("openLoginWindow", () => {
  it("opens a named blank window synchronously", () => {
    const popup = { close: vi.fn() } as unknown as Window;
    const openWindow = vi.fn(() => popup);

    const result = openLoginWindow(openWindow);

    expect(openWindow).toHaveBeenCalledWith("", result.target);
    expect(result.target).toMatch(/^trusted-login-/);
    expect(result.popup).toBe(popup);
  });

  it("reports popup blocking", () => {
    expect(() => openLoginWindow(() => null)).toThrow("阻止了新窗口");
  });
});

describe("submitToken", () => {
  it("submits an urlencoded token form to the target window and removes it", () => {
    let submitted: HTMLFormElement | undefined;
    vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(function (
      this: HTMLFormElement,
    ) {
      submitted = this;
    });

    submitToken("signed.jwt.value", "horizon", "trusted-window");

    expect(submitted).toBeDefined();
    expect(submitted?.method).toBe("post");
    expect(submitted?.action).toBe(
      "https://swanlab.aruing.top/api/auth/sso/trusted/callback/horizon",
    );
    expect(submitted?.enctype).toBe("application/x-www-form-urlencoded");
    expect(submitted?.target).toBe("trusted-window");
    expect(
      submitted?.querySelector<HTMLInputElement>('input[name="token"]')?.value,
    ).toBe("signed.jwt.value");
    expect(document.body.contains(submitted!)).toBe(false);
  });
});
