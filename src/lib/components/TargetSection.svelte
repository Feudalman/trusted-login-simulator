<script lang="ts">
  export let origin = "";
  export let provider = "";
</script>

<section class="card" aria-labelledby="target-title">
  <div class="section-heading">
    <span class="step">01</span>
    <div>
      <h2 id="target-title">SwanLab 目标</h2>
      <p>默认连接测试环境，也可以指定其他 SwanLab 服务。</p>
    </div>
  </div>

  <div class="target-field">
    <label for="origin">SwanLab 根地址</label>
    <input
      id="origin"
      name="origin"
      type="url"
      bind:value={origin}
      autocomplete="url"
      required
    />
    <p class="hint">只填写服务器根地址，TRUSTED 回调路由会自动拼接。</p>
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
