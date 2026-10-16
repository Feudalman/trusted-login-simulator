const CALLBACK_PATH = "/api/auth/sso/trusted/callback/";

export function buildCallbackUrl(origin: string, provider: string): string {
  return `${origin}${CALLBACK_PATH}${encodeURIComponent(provider)}`;
}

export interface RedirectProbe {
  status: number;
  location: string | null;
}

export type ProbeFetch = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

interface ProbePayload {
  status?: unknown;
  location?: unknown;
  error?: unknown;
}

// 向开发服务器探测回调：服务端转发 token 并返回 302 的 Location，浏览器不跳转
export async function probeTrustedRedirect(
  token: string,
  origin: string,
  provider: string,
  fetchImpl: ProbeFetch = fetch,
): Promise<RedirectProbe> {
  let response: Response;
  try {
    response = await fetchImpl(
      `${CALLBACK_PATH}${encodeURIComponent(provider)}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-trusted-origin": origin,
        },
        body: new URLSearchParams({ token }).toString(),
      },
    );
  } catch {
    throw new Error("无法连接本地开发服务器，请确认 pnpm dev 正在运行");
  }

  if (!response.ok) {
    throw new Error(await readProbeError(response));
  }

  let data: ProbePayload;
  try {
    data = (await response.json()) as ProbePayload;
  } catch {
    throw new Error("探测响应不是有效的 JSON");
  }
  if (typeof data.status !== "number") {
    throw new Error("探测响应格式异常");
  }
  return {
    status: data.status,
    location: typeof data.location === "string" ? data.location : null,
  };
}

async function readProbeError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as ProbePayload;
    if (typeof data.error === "string" && data.error) return data.error;
  } catch {
    // 忽略无法解析的错误响应体
  }
  return `回调探测失败（HTTP ${response.status}）`;
}

// Auth 返回的 302 不携带 redirectTo；在展示与复制时把用户填写的目标附加为查询参数
export function appendLocationParam(
  location: string | null,
  name: string,
  value: string,
): string | null {
  const trimmed = value.trim();
  if (!location || !trimmed) return location;
  try {
    const url = new URL(location);
    url.searchParams.set(name, trimmed);
    return url.toString();
  } catch {
    return location;
  }
}
