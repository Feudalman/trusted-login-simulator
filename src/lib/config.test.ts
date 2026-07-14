import { describe, expect, it } from "vitest";
import { defaultForm, validateForm, type SimulatorForm } from "./config";

function validForm(overrides: Partial<SimulatorForm> = {}): SimulatorForm {
  return {
    ...defaultForm(),
    provider: "horizon",
    privateKey:
      "-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----",
    issuer: "trusted-client",
    externalUserId: "external-user-1",
    username: "alice",
    ...overrides,
  };
}

describe("defaultForm", () => {
  it("uses safe TRUSTED defaults", () => {
    expect(defaultForm()).toMatchObject({
      algorithm: "RS256",
      expiresIn: 60,
      externalUserIdClaim: "sub",
      usernameClaim: "username",
      extraClaims: "{}",
    });
  });
});

describe("validateForm", () => {
  it("trims fields and parses extra claims", () => {
    const result = validateForm(
      validForm({
        provider: " horizon ",
        issuer: " trusted-client ",
        externalUserIdClaim: " subject ",
        externalUserId: " external-user-1 ",
        usernameClaim: " login ",
        username: " alice ",
        extraClaims: '{"department":"research"}',
      }),
    );

    expect(result).toMatchObject({
      provider: "horizon",
      issuer: "trusted-client",
      externalUserIdClaim: "subject",
      externalUserId: "external-user-1",
      usernameClaim: "login",
      username: "alice",
      extraClaims: { department: "research" },
    });
  });

  it.each([
    ["Provider", "provider"],
    ["私钥", "privateKey"],
    ["Issuer", "issuer"],
    ["用户 ID Claim", "externalUserIdClaim"],
    ["用户 ID", "externalUserId"],
    ["用户名 Claim", "usernameClaim"],
    ["用户名", "username"],
  ] as const)("rejects an empty %s", (label, field) => {
    expect(() => validateForm(validForm({ [field]: " " }))).toThrow(label);
  });

  it.each([0, 601, 1.5, Number.NaN])(
    "rejects invalid lifetime %s",
    (expiresIn) => {
      expect(() => validateForm(validForm({ expiresIn }))).toThrow("有效期");
    },
  );

  it("rejects equal identity claim names", () => {
    expect(() =>
      validateForm(
        validForm({
          externalUserIdClaim: "identity",
          usernameClaim: "identity",
        }),
      ),
    ).toThrow("不能相同");
  });

  it.each(["not-json", "[]", "null", '"text"'])(
    "rejects non-object extra claims: %s",
    (extraClaims) => {
      expect(() => validateForm(validForm({ extraClaims }))).toThrow(
        "额外 Claims",
      );
    },
  );

  it("treats blank extra claims as an empty object", () => {
    expect(validateForm(validForm({ extraClaims: "  " })).extraClaims).toEqual(
      {},
    );
  });

  it.each(["iss", "iat", "exp", "sub", "username"])(
    "rejects protected extra claim %s",
    (claim) => {
      expect(() =>
        validateForm(
          validForm({ extraClaims: JSON.stringify({ [claim]: "override" }) }),
        ),
      ).toThrow(claim);
    },
  );
});
