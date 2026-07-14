<script lang="ts">
  export let issuer = "";
  export let expiresIn = 60;
  export let externalUserIdClaim = "sub";
  export let externalUserId = "";
  export let usernameClaim = "username";
  export let username = "";
  export let extraClaims = "{}";
</script>

<section class="card card-wide" aria-labelledby="claims-title">
  <div class="section-heading">
    <span class="step">03</span>
    <div>
      <h2 id="claims-title">Token 身份</h2>
      <p>Claim 名需要与 Provider 的用户属性映射保持一致。</p>
    </div>
  </div>

  <div class="field-row">
    <div>
      <label for="issuer">Issuer (iss)</label>
      <input
        id="issuer"
        bind:value={issuer}
        placeholder="Provider Client ID"
        autocomplete="off"
        required
      />
    </div>
    <div>
      <label for="expires-in">有效期（秒）</label>
      <input
        id="expires-in"
        type="number"
        bind:value={expiresIn}
        min="1"
        max="600"
        step="1"
        required
      />
    </div>
  </div>

  <div class="claim-grid">
    <div>
      <label for="external-id-claim">用户 ID Claim</label>
      <input
        id="external-id-claim"
        bind:value={externalUserIdClaim}
        autocomplete="off"
        required
      />
    </div>
    <div>
      <label for="external-id">用户 ID</label>
      <input
        id="external-id"
        bind:value={externalUserId}
        placeholder="external-user-123"
        autocomplete="off"
        required
      />
    </div>
    <div>
      <label for="username-claim">用户名 Claim</label>
      <input
        id="username-claim"
        bind:value={usernameClaim}
        autocomplete="off"
        required
      />
    </div>
    <div>
      <label for="username">用户名</label>
      <input
        id="username"
        bind:value={username}
        placeholder="alice"
        autocomplete="off"
        required
      />
    </div>
  </div>

  <label for="extra-claims">额外 Claims</label>
  <textarea
    id="extra-claims"
    bind:value={extraClaims}
    rows="5"
    autocomplete="off"
    spellcheck="false"></textarea>
  <p class="hint">
    可选 JSON 对象；不能覆盖 iss、iat、exp 或上面的身份 Claim。
  </p>
</section>
