import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.svelte";
import { startTrustedLogin } from "./lib/login";

vi.mock("./lib/login", () => ({ startTrustedLogin: vi.fn() }));

const startTrustedLoginMock = vi.mocked(startTrustedLogin);

async function fillRequiredFields() {
  const values = [
    ["Provider", "horizon"],
    [
      "PKCS#8 私钥",
      "-----BEGIN PRIVATE KEY-----\\nfixture\\n-----END PRIVATE KEY-----",
    ],
    ["Issuer (iss)", "trusted-client"],
    ["用户 ID", "external-user-1"],
    ["用户名", "alice"],
  ] as const;
  for (const [name, value] of values) {
    await fireEvent.input(screen.getByRole("textbox", { name }), {
      target: { value },
    });
  }
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  startTrustedLoginMock.mockResolvedValue({
    header: { alg: "RS256", typ: "JWT" },
    payload: {
      iss: "trusted-client",
      sub: "external-user-1",
      username: "alice",
    },
    redirect: {
      status: 302,
      location: "https://commercial.internal.powerducker.com/sso?state=abc123",
    },
  });
});

describe("App", () => {
  it("shows the editable target and all configurable TRUSTED fields", () => {
    render(App);

    expect(screen.getByRole("textbox", { name: "SwanLab 根地址" })).toHaveValue(
      "https://commercial.internal.powerducker.com",
    );
    expect(
      screen.getByRole("textbox", { name: "Provider" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "redirectTo（可选）" }),
    ).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "签名算法" })).toHaveValue(
      "RS256",
    );
    expect(
      screen.getByRole("textbox", { name: "PKCS#8 私钥" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("选择私钥文件")).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Issuer (iss)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: "有效期（秒）" }),
    ).toHaveValue(60);
    expect(screen.getByRole("textbox", { name: "用户 ID Claim" })).toHaveValue(
      "sub",
    );
    expect(
      screen.getByRole("textbox", { name: "用户 ID" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "用户名 Claim" })).toHaveValue(
      "username",
    );
    expect(screen.getByRole("textbox", { name: "用户名" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "额外 Claims" })).toHaveValue(
      "{}",
    );
  });

  it("reads a selected private key only into the textarea", async () => {
    render(App);
    const file = new File(
      ["-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----"],
      "key.pem",
      {
        type: "application/x-pem-file",
      },
    );

    await fireEvent.change(screen.getByLabelText("选择私钥文件"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "PKCS#8 私钥" })).toHaveValue(
        "-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----",
      );
    });
  });

  it("submits the in-memory form and shows the signed preview", async () => {
    render(App);
    await fireEvent.input(
      screen.getByRole("textbox", { name: "SwanLab 根地址" }),
      {
        target: { value: "https://auth.example.com" },
      },
    );
    await fillRequiredFields();

    await fireEvent.click(
      screen.getByRole("button", { name: "签发并显示 302 目标" }),
    );

    await waitFor(() => expect(startTrustedLoginMock).toHaveBeenCalledOnce());
    expect(startTrustedLoginMock).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "https://auth.example.com",
        provider: "horizon",
        issuer: "trusted-client",
        externalUserId: "external-user-1",
        username: "alice",
      }),
    );
    expect(
      await screen.findByText(
        "https://commercial.internal.powerducker.com/sso?state=abc123",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/未跳转 · HTTP 302/)).toBeInTheDocument();
    expect(await screen.findByText(/"alg": "RS256"/)).toBeInTheDocument();
    expect(screen.getByText(/"sub": "external-user-1"/)).toBeInTheDocument();
  });

  it("shows signing errors without exposing them outside the page", async () => {
    startTrustedLoginMock.mockRejectedValueOnce(
      new Error("无法读取 PKCS#8 私钥"),
    );
    render(App);
    await fillRequiredFields();

    await fireEvent.click(
      screen.getByRole("button", { name: "签发并显示 302 目标" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "无法读取 PKCS#8 私钥",
    );
  });
});
