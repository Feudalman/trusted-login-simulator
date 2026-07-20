# Editable SwanLab Origin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the SwanLab server root editable at runtime while retaining the current origin as the default and preserving the existing TRUSTED callback path.

**Architecture:** Add the origin to the in-memory simulator form, validate and normalize it centrally, and pass it through the login orchestration into the form-submission layer. Keep callback routing in `submit.ts`, update the target component to edit the root, and widen only the CSP `form-action` directive.

**Tech Stack:** Svelte 5, TypeScript, Vite, Vitest, Testing Library, Nginx CSP

---

### Task 1: Form model and root-address validation

**Files:**
- Modify: `src/lib/config.test.ts`
- Modify: `src/lib/config.ts`

- [ ] **Step 1: Write failing configuration tests**

Add expectations that `defaultForm().origin` equals `https://swanlab.aruing.top`, valid roots normalize to `URL.origin`, and invalid URLs, non-HTTP protocols, credentials, paths, queries, and fragments throw an error containing `SwanLab 根地址`.

```ts
expect(defaultForm()).toMatchObject({
  origin: "https://swanlab.aruing.top",
});

it.each([
  ["https://example.com/", "https://example.com"],
  ["http://localhost:3000", "http://localhost:3000"],
])("normalizes SwanLab root %s", (origin, expected) => {
  expect(validateForm(validForm({ origin })).origin).toBe(expected);
});

it.each([
  "not-a-url",
  "ftp://example.com",
  "https://user:pass@example.com",
  "https://example.com/base",
  "https://example.com?tenant=one",
  "https://example.com#target",
])("rejects invalid SwanLab root %s", (origin) => {
  expect(() => validateForm(validForm({ origin }))).toThrow("SwanLab 根地址");
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm vitest run src/lib/config.test.ts`
Expected: FAIL because `SimulatorForm` and `defaultForm()` do not yet expose `origin` and validation does not reject invalid roots.

- [ ] **Step 3: Implement the form property and validator**

Rename the constant to `DEFAULT_SWANLAB_ORIGIN`, add `origin: string` to `SimulatorForm`, set it in `defaultForm()`, and validate it before the remaining fields:

```ts
function validateOrigin(value: string): string {
  const source = required(value, "SwanLab 根地址");
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new Error("SwanLab 根地址必须是有效的 URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("SwanLab 根地址只支持 HTTP 或 HTTPS");
  }
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("SwanLab 根地址不能包含凭据、路径、查询参数或锚点");
  }
  return url.origin;
}
```

Return the normalized `origin` from `validateForm()`.

- [ ] **Step 4: Run configuration tests and verify GREEN**

Run: `pnpm vitest run src/lib/config.test.ts`
Expected: all configuration tests pass.

### Task 2: Callback construction and login data flow

**Files:**
- Modify: `src/lib/submit.test.ts`
- Modify: `src/lib/submit.ts`
- Modify: `src/lib/login.test.ts`
- Modify: `src/lib/login.ts`

- [ ] **Step 1: Write failing callback and orchestration tests**

Change callback tests to call `buildCallbackUrl("https://auth.example.com", provider)` and `submitToken(token, origin, provider, target)`. Update the login expectation to require the normalized origin:

```ts
expect(deps.submit).toHaveBeenCalledWith(
  "signed.jwt.value",
  "https://swanlab.aruing.top",
  "horizon",
  "trusted-window",
);
```

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm vitest run src/lib/submit.test.ts src/lib/login.test.ts`
Expected: FAIL because the submission APIs do not accept an origin and login does not forward it.

- [ ] **Step 3: Implement origin-aware callback submission**

Use these signatures and forward `config.origin` from `startTrustedLogin()`:

```ts
export function buildCallbackUrl(origin: string, provider: string): string {
  return `${origin}/api/auth/sso/trusted/callback/${encodeURIComponent(provider)}`;
}

export function submitToken(
  token: string,
  origin: string,
  provider: string,
  target: string,
  doc = document,
): void {
  // Existing temporary form logic; set form.action with buildCallbackUrl(origin, provider).
}
```

Remove the unused fixed-origin import from `login.ts` and call `dependencies.submit(signed.token, config.origin, config.provider, target)`.

- [ ] **Step 4: Run submission and login tests and verify GREEN**

Run: `pnpm vitest run src/lib/submit.test.ts src/lib/login.test.ts`
Expected: all submission and login tests pass.

### Task 3: Editable target UI

**Files:**
- Modify: `src/App.test.ts`
- Modify: `src/App.svelte`
- Modify: `src/lib/components/TargetSection.svelte`
- Modify: `src/app.css`

- [ ] **Step 1: Write failing UI tests**

Replace the assertion that no address textbox exists with:

```ts
expect(screen.getByRole("textbox", { name: "SwanLab 根地址" })).toHaveValue(
  "https://swanlab.aruing.top",
);
```

In the submit test, change the address field to `https://auth.example.com` and expect the submitted object to include `origin: "https://auth.example.com"`.

- [ ] **Step 2: Run the App test and verify RED**

Run: `pnpm vitest run src/App.test.ts`
Expected: FAIL because the address is still rendered as fixed text and is not bound to the form.

- [ ] **Step 3: Implement the editable field**

Bind the new form property in `App.svelte`:

```svelte
<TargetSection bind:origin={form.origin} bind:provider={form.provider} />
```

Expose `origin` from `TargetSection.svelte` and replace the fixed block with:

```svelte
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
```

Change the section description to explain that the default target can be edited. Remove the obsolete `.fixed-target` CSS rules.

- [ ] **Step 4: Run the App test and verify GREEN**

Run: `pnpm vitest run src/App.test.ts`
Expected: all App tests pass.

### Task 4: Deployment policy and documentation

**Files:**
- Modify: `nginx.conf`
- Modify: `README.md`

- [ ] **Step 1: Update CSP and safety documentation**

Change the CSP fragment from:

```text
form-action https://swanlab.aruing.top
```

to:

```text
form-action http: https:
```

Update README safety text to say CSP permits form submission to the user-selected HTTP/HTTPS target, while all entered data remains in memory and `connect-src 'none'` still forbids application network requests.

- [ ] **Step 2: Verify the exact policy and docs text**

Run: `rg -n "form-action|用户选择|根地址" nginx.conf README.md`
Expected: Nginx contains `form-action http: https:` and README describes editable root behavior.

### Task 5: Full verification

**Files:**
- Verify all modified files

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: all Vitest tests pass with zero failures.

- [ ] **Step 2: Run type and Svelte checks**

Run: `pnpm check`
Expected: zero errors and zero warnings.

- [ ] **Step 3: Run formatting checks**

Run: `pnpm format:check`
Expected: all matched files use Prettier formatting.

- [ ] **Step 4: Build the production bundle**

Run: `pnpm build`
Expected: Vite exits successfully and writes the production bundle to `dist/`.

- [ ] **Step 5: Inspect the final diff**

Run: `git diff --check && git status --short && git diff --stat`
Expected: no whitespace errors; only the planned implementation files plus the existing `.gitignore` change and this plan are present.
