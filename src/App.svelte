<script lang="ts">
  import ClaimsSection from "./lib/components/ClaimsSection.svelte";
  import Diagnostics from "./lib/components/Diagnostics.svelte";
  import SigningSection from "./lib/components/SigningSection.svelte";
  import TargetSection from "./lib/components/TargetSection.svelte";
  import { defaultForm } from "./lib/config";
  import { startTrustedLogin, type LoginPreview } from "./lib/login";

  let form = defaultForm();
  let loading = false;
  let error = "";
  let preview: LoginPreview | null = null;

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    loading = true;
    error = "";
    try {
      preview = await startTrustedLogin(form);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "无法发起 TRUSTED 登录";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>TRUSTED Login Simulator</title>
</svelte:head>

<main>
  <header class="hero">
    <div>
      <span class="eyebrow">SWANLAB AUTH LAB</span>
      <h1>TRUSTED Login Simulator</h1>
      <p class="lead">
        在浏览器内签发短期 JWT，并探测 SwanLab Auth 返回的 302 重定向目标。
      </p>
    </div>
    <div class="privacy-note">
      <span class="privacy-icon" aria-hidden="true">◆</span>
      <div>
        <strong>完全无状态</strong>
        <span>私钥、配置与 Token 不会离开当前页面，也不会被保存。</span>
      </div>
    </div>
  </header>

  <form autocomplete="off" onsubmit={submit}>
    <div class="form-grid">
      <TargetSection
        bind:origin={form.origin}
        bind:provider={form.provider}
        bind:redirectTo={form.redirectTo}
      />
      <SigningSection
        bind:algorithm={form.algorithm}
        bind:privateKey={form.privateKey}
      />
      <ClaimsSection
        bind:issuer={form.issuer}
        bind:expiresIn={form.expiresIn}
        bind:externalUserIdClaim={form.externalUserIdClaim}
        bind:externalUserId={form.externalUserId}
        bind:usernameClaim={form.usernameClaim}
        bind:username={form.username}
        bind:extraClaims={form.extraClaims}
      />
    </div>

    <div class="action-bar">
      <div>
        <strong>签发后自动探测，不打开新窗口</strong>
        <span>显示 Auth 302 的 Location 目标地址，浏览器不会跳转。</span>
      </div>
      <button class="primary-button" type="submit" disabled={loading}>
        {loading ? "正在签发并探测…" : "签发并显示 302 目标"}
      </button>
    </div>
  </form>

  <Diagnostics {error} {preview} />
</main>
