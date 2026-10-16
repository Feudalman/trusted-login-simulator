import type { Connect, Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vitest/config";
import http from "node:http";
import https from "node:https";

const CALLBACK_PATH = "/api/auth/sso/trusted/callback/";
const MAX_PROBE_BODY_BYTES = 32 * 1024;
const UPSTREAM_TIMEOUT_MS = 15_000;

function jsonReply(
  res: http.ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  if (res.writableEnded) return;
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

// 浏览器无法读取跨域 302 的 Location 头，这里校验目标后由开发服务器代为转发
function normalizeOrigin(
  headerValue: string | string[] | undefined,
): string | null {
  const source = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!source) return null;
  let parsed: URL;
  try {
    parsed = new URL(source.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }
  if (
    parsed.username ||
    parsed.password ||
    (parsed.pathname !== "/" && parsed.pathname !== "")
  ) {
    return null;
  }
  return parsed.origin;
}

function forwardProbe(
  origin: string,
  provider: string,
  body: Buffer,
  res: http.ServerResponse,
): void {
  let target: URL;
  try {
    target = new URL(`${origin}${CALLBACK_PATH}${provider}`);
  } catch {
    jsonReply(res, 400, { error: "无法构造回调地址" });
    return;
  }

  // 自签证书环境可设置 TRUSTED_PROBE_INSECURE=1 跳过校验
  const insecure = process.env.TRUSTED_PROBE_INSECURE === "1";
  const options: https.RequestOptions = {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "content-length": String(body.byteLength),
    },
    ...(insecure ? { rejectUnauthorized: false } : {}),
  };
  const upstreamReq =
    target.protocol === "https:"
      ? https.request(target, options)
      : http.request(target, options);

  const timer = setTimeout(
    () => upstreamReq.destroy(new Error("上游请求超时")),
    UPSTREAM_TIMEOUT_MS,
  );

  upstreamReq.on("response", (upstreamRes) => {
    clearTimeout(timer);
    upstreamRes.resume();
    jsonReply(res, 200, {
      status: upstreamRes.statusCode ?? 0,
      location:
        typeof upstreamRes.headers.location === "string"
          ? upstreamRes.headers.location
          : null,
    });
  });

  upstreamReq.on("error", (error) => {
    clearTimeout(timer);
    jsonReply(res, 502, {
      error: `无法访问上游回调：${error.message}`,
    });
  });

  upstreamReq.end(body);
}

function trustedRedirectProbe(): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (req.method !== "POST" || !req.url?.startsWith(CALLBACK_PATH)) {
      next();
      return;
    }
    const provider = req.url.slice(CALLBACK_PATH.length).split("?")[0];
    const origin = normalizeOrigin(req.headers["x-trusted-origin"]);
    if (!origin) {
      jsonReply(res, 400, { error: "缺少或非法的 x-trusted-origin 请求头" });
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    let oversized = false;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_PROBE_BODY_BYTES) {
        oversized = true;
        jsonReply(res, 413, { error: "探测请求体过大" });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("error", () => {
      // 客户端中断时忽略
    });
    req.on("end", () => {
      if (oversized) return;
      forwardProbe(origin, provider, Buffer.concat(chunks), res);
    });
  };

  return {
    name: "trusted-redirect-probe",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  plugins: [trustedRedirectProbe(), svelte(), svelteTesting()],
  build: { assetsDir: "" },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
});
