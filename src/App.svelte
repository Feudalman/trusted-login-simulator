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
        在浏览器内签发短期 JWT，并模拟受信第三方平台打开 SwanLab。
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
      <TargetSection bind:provider={form.provider} />
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
        <strong>准备好后，在新窗口继续流程</strong>
        <span>Auth 将负责验签、账号绑定或自动创建。</span>
      </div>
      <button class="primary-button" type="submit" disabled={loading}>
        {loading ? "正在签名…" : "打开 SwanLab"}
        <span aria-hidden="true">↗</span>
      </button>
    </div>
  </form>

  <Diagnostics {error} {preview} />
</main>
