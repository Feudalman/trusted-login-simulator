import {
  decodeJwt,
  decodeProtectedHeader,
  importPKCS8,
  SignJWT,
  type JWTPayload,
} from "jose";
import type { ValidatedConfig } from "./config";

export interface SignedToken {
  token: string;
  header: ReturnType<typeof decodeProtectedHeader>;
  payload: JWTPayload;
}

export async function signTrustedToken(
  config: ValidatedConfig,
  now = Math.floor(Date.now() / 1000),
): Promise<SignedToken> {
  try {
    const key = await importPKCS8(config.privateKey, config.algorithm);
    const token = await new SignJWT({
      ...config.extraClaims,
      [config.externalUserIdClaim]: config.externalUserId,
      [config.usernameClaim]: config.username,
    })
      .setProtectedHeader({ alg: config.algorithm, typ: "JWT" })
      .setIssuer(config.issuer)
      .setIssuedAt(now)
      .setExpirationTime(now + config.expiresIn)
      .sign(key);

    return {
      token,
      header: decodeProtectedHeader(token),
      payload: decodeJwt(token),
    };
  } catch {
    throw new Error("无法读取 PKCS#8 私钥或使用所选算法签发 JWT");
  }
}
