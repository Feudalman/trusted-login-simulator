import { describe, expect, it, vi } from "vitest";
import {
  buildCallbackUrl,
  appendLocationParam,
  probeTrustedRedirect,
} from "./submit";

function fakeResponse(overrides: {
  ok?: boolean;
  status?: number;
  json?: () => Promise<unknown>;
}): Response {
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    json: overrides.json ?? (async () => ({})),
  } as unknown as Response;
}

describe("buildCallbackUrl", () => {
  it("uses the supplied SwanLab origin and encodes provider as one segment", () => {
    expect(buildCallbackUrl("https://auth.example.com", "horizon / dev")).toBe(
      "https://auth.example.com/api/auth/sso/trusted/callback/horizon%20%2F%20dev",
    );
  });
});

describe("appendLocationParam", () => {
  it("appends a query parameter to the intercepted redirect location", () => {
    expect(
      appendLocationParam(
        "https://commercial.internal.powerducker.com/sso?state=MnqJtnTsSQsnJY3cGIa61jy4YPk07_z36rk662-hNiw",
        "redirectTo",
        "@admin/test/v1/hgcyig/runs/test-2/chart",
      ),
    ).toBe(
      "https://commercial.internal.powerducker.com/sso?state=MnqJtnTsSQsnJY3cGIa61jy4YPk07_z36rk662-hNiw&redirectTo=%40admin%2Ftest%2Fv1%2Fhgcyig%2Fruns%2Ftest-2%2Fchart",
    );
  });

  it("keeps the location unchanged without a value or on invalid URLs", () => {
    const location = "https://swan.example.com/sso?state=state-1";
    expect(appendLocationParam(location, "redirectTo", "")).toBe(location);
    expect(appendLocationParam(location, "redirectTo", "  ")).toBe(location);
    expect(appendLocationParam(null, "redirectTo", "/x")).toBeNull();
    expect(appendLocationParam("not-a-url", "redirectTo", "/x")).toBe(
      "not-a-url",
    );
  });
});

describe("probeTrustedRedirect", () => {
  it("posts the token to the dev-server probe route with the chosen origin", async () => {
    const fetchImpl = vi.fn(async () =>
      fakeResponse({
        json: async () => ({
          status: 302,
          location: "https://swan.example.com/sso?state=state-1",
        }),
      }),
    );

    const result = await probeTrustedRedirect(
      "signed.jwt.value",
      "https://auth.example.com",
      "horizon",
      fetchImpl,
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/auth/sso/trusted/callback/horizon",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-trusted-origin": "https://auth.example.com",
        },
        body: "token=signed.jwt.value",
      },
    );
    expect(result).toEqual({
      status: 302,
      location: "https://swan.example.com/sso?state=state-1",
    });
  });

  it("allows responses without a Location header", async () => {
    const fetchImpl = vi.fn(async () =>
      fakeResponse({ json: async () => ({ status: 200, location: null }) }),
    );

    await expect(
      probeTrustedRedirect(
        "signed.jwt.value",
        "https://auth.example.com",
        "horizon",
        fetchImpl,
      ),
    ).resolves.toEqual({ status: 200, location: null });
  });

  it("surfaces upstream errors from the probe route", async () => {
    const fetchImpl = vi.fn(async () =>
      fakeResponse({
        ok: false,
        status: 502,
        json: async () => ({ error: "无法访问上游回调：超时" }),
      }),
    );

    await expect(
      probeTrustedRedirect(
        "signed.jwt.value",
        "https://auth.example.com",
        "horizon",
        fetchImpl,
      ),
    ).rejects.toThrow("无法访问上游回调：超时");
  });

  it("falls back to the HTTP status when the error body is unusable", async () => {
    const fetchImpl = vi.fn(async () =>
      fakeResponse({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("bad json");
        },
      }),
    );

    await expect(
      probeTrustedRedirect(
        "signed.jwt.value",
        "https://auth.example.com",
        "horizon",
        fetchImpl,
      ),
    ).rejects.toThrow("回调探测失败（HTTP 500）");
  });

  it("reports connectivity problems to the dev server", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    await expect(
      probeTrustedRedirect(
        "signed.jwt.value",
        "https://auth.example.com",
        "horizon",
        fetchImpl,
      ),
    ).rejects.toThrow("无法连接本地开发服务器");
  });

  it("rejects malformed probe payloads", async () => {
    const fetchImpl = vi.fn(async () =>
      fakeResponse({ json: async () => "not-an-object" }),
    );

    await expect(
      probeTrustedRedirect(
        "signed.jwt.value",
        "https://auth.example.com",
        "horizon",
        fetchImpl,
      ),
    ).rejects.toThrow("探测响应格式异常");
  });
});
