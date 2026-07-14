export interface LoginWindow {
  popup: Window;
  target: string;
}

export function buildCallbackUrl(provider: string): string {
  return `${SWANLAB_ORIGIN}/api/auth/sso/trusted/callback/${encodeURIComponent(provider)}`;
}

export function openLoginWindow(openWindow = window.open): LoginWindow {
  const target = `trusted-login-${crypto.randomUUID()}`;
  const popup = openWindow("", target);
  if (!popup) throw new Error("浏览器阻止了新窗口，请允许本站打开弹窗");
  return { popup, target };
}

export function submitToken(
  token: string,
  provider: string,
  target: string,
  doc = document,
): void {
  const form = doc.createElement("form");
  const input = doc.createElement("input");
  form.method = "POST";
  form.action = buildCallbackUrl(provider);
  form.enctype = "application/x-www-form-urlencoded";
  form.target = target;
  form.hidden = true;
  input.type = "hidden";
  input.name = "token";
  input.value = token;
  form.append(input);
  doc.body.append(form);
  try {
    form.submit();
  } finally {
    form.remove();
  }
}
import { SWANLAB_ORIGIN } from "./config";
