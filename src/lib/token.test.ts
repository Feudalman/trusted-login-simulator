import {
  exportPKCS8,
  generateKeyPair,
  importPKCS8,
  jwtVerify,
  SignJWT,
} from "jose";
import { describe, expect, it } from "vitest";
import { defaultForm, validateForm } from "./config";
import { signTrustedToken } from "./token";

async function rsaConfig() {
  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  const privateKeyPem = await exportPKCS8(privateKey);
  const config = validateForm({
    ...defaultForm(),
    provider: "horizon",
    privateKey: privateKeyPem,
    issuer: "trusted-client",
    externalUserIdClaim: "employee_id",
    externalUserId: "external-user-1",
    usernameClaim: "login",
    username: "alice",
    extraClaims: '{"department":"research"}',
  });
  return { config, publicKey };
}

describe("signTrustedToken", () => {
  it("can re-import and use the generated PKCS#8 fixture in the test environment", async () => {
    const { config } = await rsaConfig();
    const key = await importPKCS8(config.privateKey, config.algorithm);

    const token = await new SignJWT({ sub: "fixture" })
      .setProtectedHeader({ alg: config.algorithm })
      .sign(key);
    expect(token.split(".")).toHaveLength(3);
  });

  it("signs a verifiable TRUSTED token with mapped claims", async () => {
    const { config, publicKey } = await rsaConfig();

    const result = await signTrustedToken(config, 1_784_000_000);
    const verified = await jwtVerify(result.token, publicKey, {
      issuer: "trusted-client",
      currentDate: new Date(1_784_000_030_000),
    });

    expect(verified.payload).toMatchObject({
      iss: "trusted-client",
      employee_id: "external-user-1",
      login: "alice",
      department: "research",
      iat: 1_784_000_000,
      exp: 1_784_000_060,
    });
    expect(result.header).toEqual({ alg: "RS256", typ: "JWT" });
    expect(result.payload).toEqual(verified.payload);
  });

  it("does not expose invalid private-key contents in its error", async () => {
    const privateKey = "SENSITIVE-PRIVATE-KEY-CONTENT";
    const config = validateForm({
      ...defaultForm(),
      provider: "horizon",
      privateKey,
      issuer: "trusted-client",
      externalUserId: "external-user-1",
      username: "alice",
    });

    await expect(signTrustedToken(config)).rejects.toThrow("PKCS#8");
    await expect(signTrustedToken(config)).rejects.not.toThrow(privateKey);
  });
});
// @vitest-environment node
