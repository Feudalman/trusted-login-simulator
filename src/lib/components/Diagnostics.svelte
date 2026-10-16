<script lang="ts">
  import type { LoginPreview } from "../login";

  export let error = "";
  export let preview: LoginPreview | null = null;

  let copied = false;
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  async function copyLocation(location: string) {
    try {
      await navigator.clipboard.writeText(location);
      copied = true;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 1500);
    } catch {
      // 剪贴板不可用时静默忽略
    }
  }
</script>

{#if error}
  <div class="message error-message" role="alert">
    <strong>无法发起登录</strong>
    <span>{error}</span>
  </div>
{/if}

{#if preview}
  <section class="preview" aria-labelledby="redirect-title">
    <div class="preview-heading">
      <div>
        <span class="eyebrow">REDIRECT PROBE</span>
        <h2 id="redirect-title">302 重定向目标</h2>
      </div>
      <span class="status-dot">未跳转 · HTTP {preview.redirect.status}</span>
    </div>
    {#if preview.redirect.location}
      {@const redirectLocation = preview.redirect.location}
      <div class="redirect-row">
        <pre class="redirect-url">{redirectLocation}</pre>
        <button
          class="copy-button"
          type="button"
          onclick={() => copyLocation(redirectLocation)}
        >
          {copied ? "已复制" : "复制地址"}
        </button>
      </div>
      <p class="hint">
        浏览器没有跟随这次重定向；复制地址后可在新标签页手动打开。
      </p>
    {:else}
      <p class="hint">
        上游返回 HTTP {preview.redirect.status}，响应中没有 Location 头。
      </p>
    {/if}
  </section>

  <section class="preview" aria-labelledby="preview-title">
    <div class="preview-heading">
      <div>
        <span class="eyebrow">SIGNED LOCALLY</span>
        <h2 id="preview-title">JWT 预览</h2>
      </div>
      <span class="status-dot">已签发</span>
    </div>
    <div class="preview-grid">
      <div>
        <h3>Header</h3>
        <pre>{JSON.stringify(preview.header, null, 2)}</pre>
      </div>
      <div>
        <h3>Payload</h3>
        <pre>{JSON.stringify(preview.payload, null, 2)}</pre>
      </div>
    </div>
  </section>
{/if}
