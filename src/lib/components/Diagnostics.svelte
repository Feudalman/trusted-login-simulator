<script lang="ts">
  import type { LoginPreview } from "../login";

  export let error = "";
  export let preview: LoginPreview | null = null;
</script>

{#if error}
  <div class="message error-message" role="alert">
    <strong>无法发起登录</strong>
    <span>{error}</span>
  </div>
{/if}

{#if preview}
  <section class="preview" aria-labelledby="preview-title">
    <div class="preview-heading">
      <div>
        <span class="eyebrow">SIGNED LOCALLY</span>
        <h2 id="preview-title">JWT 预览</h2>
      </div>
      <span class="status-dot">已提交</span>
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
