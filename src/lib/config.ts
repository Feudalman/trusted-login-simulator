export const DEFAULT_SWANLAB_ORIGIN =
  "https://commercial.internal.powerducker.com";

export const algorithms = [
  "RS256",
  "RS384",
  "RS512",
  "ES256",
  "ES384",
  "ES512",
] as const;

export type SigningAlgorithm = (typeof algorithms)[number];

export interface SimulatorForm {
  origin: string;
  provider: string;
  redirectTo: string;
  algorithm: SigningAlgorithm;
  privateKey: string;
  issuer: string;
  expiresIn: number;
  externalUserIdClaim: string;
  externalUserId: string;
  usernameClaim: string;
  username: string;
  extraClaims: string;
}

export interface ValidatedConfig extends Omit<SimulatorForm, "extraClaims"> {
  extraClaims: Record<string, unknown>;
}

export function defaultForm(): SimulatorForm {
  return {
    origin: DEFAULT_SWANLAB_ORIGIN,
    provider: "",
    redirectTo: "",
    algorithm: "RS256",
    privateKey: "",
    issuer: "",
    expiresIn: 60,
    externalUserIdClaim: "sub",
    externalUserId: "",
    usernameClaim: "username",
    username: "",
    extraClaims: "{}",
  };
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} 不能为空`);
  return normalized;
}

function validateOrigin(value: string): string {
  const source = required(value, "SwanLab 根地址");
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new Error("SwanLab 根地址必须是有效的 URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("SwanLab 根地址只支持 HTTP 或 HTTPS");
  }
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("SwanLab 根地址不能包含凭据、路径、查询参数或锚点");
  }
  return url.origin;
}

function parseExtraClaims(source: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source.trim() || "{}");
  } catch {
    throw new Error("额外 Claims 必须是有效的 JSON 对象");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("额外 Claims 必须是 JSON 对象");
  }
  return parsed as Record<string, unknown>;
}

export function validateForm(form: SimulatorForm): ValidatedConfig {
  const origin = validateOrigin(form.origin);
  const provider = required(form.provider, "Provider");
  const privateKey = required(form.privateKey, "私钥");
  const issuer = required(form.issuer, "Issuer");
  const externalUserIdClaim = required(
    form.externalUserIdClaim,
    "用户 ID Claim",
  );
  const externalUserId = required(form.externalUserId, "用户 ID");
  const usernameClaim = required(form.usernameClaim, "用户名 Claim");
  const username = required(form.username, "用户名");

  if (
    !Number.isInteger(form.expiresIn) ||
    form.expiresIn < 1 ||
    form.expiresIn > 600
  ) {
    throw new Error("Token 有效期必须是 1 到 600 之间的整数秒");
  }
  if (externalUserIdClaim === usernameClaim) {
    throw new Error("用户 ID Claim 与用户名 Claim 不能相同");
  }

  const extraClaims = parseExtraClaims(form.extraClaims);
  const protectedClaims = new Set([
    "iss",
    "iat",
    "exp",
    externalUserIdClaim,
    usernameClaim,
  ]);
  for (const claim of Object.keys(extraClaims)) {
    if (protectedClaims.has(claim))
      throw new Error(`额外 Claims 不能覆盖 ${claim}`);
  }

  return {
    origin,
    provider,
    redirectTo: form.redirectTo,
    algorithm: form.algorithm,
    privateKey,
    issuer,
    expiresIn: form.expiresIn,
    externalUserIdClaim,
    externalUserId,
    usernameClaim,
    username,
    extraClaims,
  };
}
