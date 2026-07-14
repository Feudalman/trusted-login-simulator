<script lang="ts">
  import { algorithms, type SigningAlgorithm } from "../config";

  export let algorithm: SigningAlgorithm = "RS256";
  export let privateKey = "";

  let fileError = "";

  function readPrivateKey(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      privateKey = typeof reader.result === "string" ? reader.result : "";
      fileError = privateKey ? "" : "私钥文件为空";
    });
    reader.addEventListener("error", () => {
      fileError = "无法读取私钥文件";
    });
    reader.readAsText(file);
  }
</script>

<section class="card" aria-labelledby="signing-title">
  <div class="section-heading">
    <span class="step">02</span>
    <div>
      <h2 id="signing-title">签名配置</h2>
      <p>私钥只在当前浏览器页面的内存中使用。</p>
    </div>
  </div>

  <div class="field-row compact">
    <div>
      <label for="algorithm">签名算法</label>
      <select id="algorithm" name="algorithm" bind:value={algorithm}>
        {#each algorithms as item}
          <option value={item}>{item}</option>
        {/each}
      </select>
    </div>
    <div>
      <label for="key-file">选择私钥文件</label>
      <input
        id="key-file"
        class="file-input"
        type="file"
        accept=".pem,.key,text/plain,application/x-pem-file"
        onchange={readPrivateKey}
      />
    </div>
  </div>

  <label for="private-key">PKCS#8 私钥</label>
  <textarea
    id="private-key"
    name="privateKey"
    bind:value={privateKey}
    rows="9"
    placeholder="-----BEGIN PRIVATE KEY-----"
    autocomplete="off"
    spellcheck="false"
    required></textarea>
  {#if fileError}<p class="field-error" role="alert">{fileError}</p>{/if}
  <p class="hint">
    支持 Auth 接受的 RSA 与 ECDSA 算法；私钥格式必须为 PKCS#8 PEM。
  </p>
</section>
