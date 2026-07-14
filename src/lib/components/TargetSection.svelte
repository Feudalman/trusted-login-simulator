<script lang="ts">
  import { SWANLAB_ORIGIN } from "../config";

  export let provider = "";
</script>

<section class="card" aria-labelledby="target-title">
  <div class="section-heading">
    <span class="step">01</span>
    <div>
      <h2 id="target-title">SwanLab 目标</h2>
      <p>请求始终发送到已部署的测试环境。</p>
    </div>
  </div>

  <div class="fixed-target">
    <span>固定地址</span>
    <code>{SWANLAB_ORIGIN}</code>
  </div>

  <label for="provider">Provider</label>
  <input
    id="provider"
    name="provider"
    bind:value={provider}
    placeholder="例如：horizon"
    autocomplete="off"
    required
  />
  <p class="hint">填写 SwanLab 控制台中已启用的 TRUSTED Provider 唯一标识。</p>
</section>
