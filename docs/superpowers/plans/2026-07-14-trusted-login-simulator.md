# TRUSTED 登录模拟器实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 构建并部署一个公开、无状态的 Svelte 页面，在浏览器内用用户提供的私钥签发短期 JWT，并在新窗口发起 SwanLab TRUSTED 登录。

**Architecture:** Vite + Svelte 构建纯静态 SPA；校验、PKCS#8 私钥导入、JWT 签名和隐藏表单提交全部在浏览器完成。集群使用非 root nginx，静态产物通过生成的 ConfigMap 挂载，不依赖 SSH、镜像仓库或服务端签名。

**Tech Stack:** Svelte 5、TypeScript、Vite、jose、Vitest、Testing Library、nginx、Kubernetes、Traefik IngressRoute

---

### Task 1: 初始化 Svelte 与测试工具链

**Files:**
- Create: package.json
- Create: tsconfig.json
- Create: vite.config.ts
- Create: index.html
- Create: src/main.ts
- Create: src/App.svelte
- Create: src/test/setup.ts
- Create: .gitignore

- [ ] **Step 1: 创建项目元数据**

package.json 提供 dev、build、preview、check、test、test:watch、format:check 脚本。

- [ ] **Step 2: 安装依赖**

~~~bash
pnpm add jose
pnpm add -D @sveltejs/vite-plugin-svelte @testing-library/jest-dom @testing-library/svelte jsdom prettier prettier-plugin-svelte svelte svelte-check tslib typescript vite vitest
~~~

Expected: 生成 pnpm-lock.yaml。

- [ ] **Step 3: 创建 Vite 测试配置**

~~~ts
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [svelte()],
  build: { assetsDir: '' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true
  }
})
~~~

tsconfig.json 启用 strict、noEmit、Bundler 模块解析、DOM 类型和 vitest/globals。setup 只导入 @testing-library/jest-dom/vitest。index.html 提供 #app；main.ts 用 Svelte mount 挂载只含标题的 App。这是生成式脚手架，不实现业务行为。

- [ ] **Step 4: 验证并提交**

~~~bash
pnpm exec vitest run --passWithNoTests
pnpm check
pnpm build
git add package.json pnpm-lock.yaml tsconfig.json vite.config.ts index.html src .gitignore
git commit -m "chore: initialize Svelte simulator"
~~~

Expected: 三个检查 exit 0。

### Task 2: 表单配置校验

**Files:**
- Create: src/lib/config.test.ts
- Create: src/lib/config.ts

- [ ] **Step 1: 写失败测试**

覆盖默认 RS256/60 秒、字段 trim、必填字段、1–600 整数有效期、两个身份 claim 不得同名、extraClaims 必须为 object，并禁止覆盖 iss、iat、exp 或身份 claims。

~~~ts
const result = validateForm({
  ...validForm(),
  provider: ' horizon ',
  issuer: ' trusted-client '
})
expect(result.provider).toBe('horizon')
expect(result.issuer).toBe('trusted-client')
expect(() => validateForm({ ...validForm(), expiresIn: 601 })).toThrow('有效期')
expect(() => validateForm({ ...validForm(), extraClaims: '{"iss":"other"}' })).toThrow('iss')
~~~

- [ ] **Step 2: 运行并确认 RED**

Run: pnpm vitest run src/lib/config.test.ts

Expected: FAIL，因为配置模块不存在。

- [ ] **Step 3: 实现配置模型**

~~~ts
export const SWANLAB_ORIGIN = 'https://swanlab.aruing.top'
export const algorithms = ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'] as const
export type SigningAlgorithm = (typeof algorithms)[number]

export interface SimulatorForm {
  provider: string
  algorithm: SigningAlgorithm
  privateKey: string
  issuer: string
  expiresIn: number
  externalUserIdClaim: string
  externalUserId: string
  usernameClaim: string
  username: string
  extraClaims: string
}
~~~

validateForm 返回 trim 后的配置和解析后的 extraClaims；错误为不含 PEM 的中文消息。

- [ ] **Step 4: 运行 GREEN 并提交**

~~~bash
pnpm vitest run src/lib/config.test.ts
git add src/lib/config.ts src/lib/config.test.ts
git commit -m "feat: validate TRUSTED token configuration"
~~~

Expected: PASS。

### Task 3: 浏览器端 JWT 签名

**Files:**
- Create: src/lib/token.test.ts
- Create: src/lib/token.ts

- [ ] **Step 1: 写失败测试**

使用 jose 生成 RS256 测试密钥并导出 PKCS#8。调用 signTrustedToken 后用公钥 jwtVerify 验证 issuer、iat、exp 和自定义 claims；另测无效 PEM/算法不匹配消息不泄露密钥。

~~~ts
const result = await signTrustedToken(config, 1_784_000_000)
const verified = await jwtVerify(result.token, publicKey, { issuer: 'trusted-client' })
expect(verified.payload).toMatchObject({
  iss: 'trusted-client',
  sub: 'external-1',
  username: 'alice',
  iat: 1_784_000_000,
  exp: 1_784_000_060
})
~~~

- [ ] **Step 2: 运行 RED**

Run: pnpm vitest run src/lib/token.test.ts

Expected: FAIL，因为签名模块不存在。

- [ ] **Step 3: 最小实现**

~~~ts
const key = await importPKCS8(config.privateKey, config.algorithm)
const token = await new SignJWT({
  ...config.extraClaims,
  [config.externalUserIdClaim]: config.externalUserId,
  [config.usernameClaim]: config.username
})
  .setProtectedHeader({ alg: config.algorithm, typ: 'JWT' })
  .setIssuer(config.issuer)
  .setIssuedAt(now)
  .setExpirationTime(now + config.expiresIn)
  .sign(key)
~~~

返回 token、decodeProtectedHeader 和 decodeJwt 结果。底层错误转换为不含私钥的中文错误。

- [ ] **Step 4: 运行 GREEN 并提交**

~~~bash
pnpm vitest run src/lib/token.test.ts
git add src/lib/token.ts src/lib/token.test.ts
git commit -m "feat: sign TRUSTED JWT in browser"
~~~

### Task 4: 新窗口与隐藏表单

**Files:**
- Create: src/lib/submit.test.ts
- Create: src/lib/submit.ts
- Create: src/lib/login.test.ts
- Create: src/lib/login.ts

- [ ] **Step 1: 写 callback 和表单失败测试**

断言 callback 固定为 swanlab.aruing.top 且 Provider 编码为一个路径段。表单必须为 POST、application/x-www-form-urlencoded、指向预开窗口、只有 token 隐藏输入，并在 submit 后移除。

- [ ] **Step 2: 运行 RED**

Run: pnpm vitest run src/lib/submit.test.ts

Expected: FAIL，因为 helper 不存在。

- [ ] **Step 3: 实现提交 helper**

~~~ts
export function buildCallbackUrl(provider: string) {
  return SWANLAB_ORIGIN + '/api/auth/sso/trusted/callback/' + encodeURIComponent(provider)
}

export function openLoginWindow(openWindow = window.open) {
  const target = 'trusted-login-' + crypto.randomUUID()
  const popup = openWindow('', target)
  if (!popup) throw new Error('浏览器阻止了新窗口，请允许本站打开弹窗')
  return { popup, target }
}
~~~

submitToken 动态创建 form/input，调用 form.submit() 并在 finally 中 remove。

- [ ] **Step 4: 写登录编排失败测试**

验证同步校验、同步开窗、异步签名、提交的顺序；签名失败时 popup.close()，成功返回预览。

- [ ] **Step 5: RED 后实现 startTrustedLogin，再确认 GREEN**

~~~bash
pnpm vitest run src/lib/login.test.ts
pnpm vitest run src/lib/submit.test.ts src/lib/login.test.ts
git add src/lib/submit.ts src/lib/submit.test.ts src/lib/login.ts src/lib/login.test.ts
git commit -m "feat: submit TRUSTED login in a new window"
~~~

Expected: 第一次 FAIL；实现后 PASS。

### Task 5: Svelte 表单界面

**Files:**
- Create: src/App.test.ts
- Modify: src/App.svelte
- Create: src/app.css
- Create: src/lib/components/TargetSection.svelte
- Create: src/lib/components/SigningSection.svelte
- Create: src/lib/components/ClaimsSection.svelte
- Create: src/lib/components/Diagnostics.svelte

- [ ] **Step 1: 写失败测试**

断言固定显示 SwanLab 地址且没有地址输入；包含 Provider、算法、私钥、issuer、有效期、claims 和额外 JSON；选择本地文件更新私钥 textarea；提交时 loading 禁用，成功显示预览，失败显示中文错误。

- [ ] **Step 2: 运行 RED**

Run: pnpm vitest run src/App.test.ts

Expected: FAIL，因为表单不存在。

- [ ] **Step 3: 实现四个组件**

TargetSection 只显示固定地址并编辑 Provider。SigningSection 提供算法、PEM textarea 和 accept=".pem,.key,text/plain" 文件选择。ClaimsSection 编辑 issuer、有效期、映射和值、额外 JSON。Diagnostics 只接收 error/header/payload。

- [ ] **Step 4: 实现页面编排**

~~~svelte
<script lang="ts">
  import { defaultForm } from './lib/config'
  import { startTrustedLogin } from './lib/login'

  let form = defaultForm()
  let loading = false
  let error = ''
  let preview: { header: unknown; payload: unknown } | null = null

  async function submit() {
    loading = true
    error = ''
    try {
      preview = await startTrustedLogin(form)
    } catch (cause) {
      error = cause instanceof Error ? cause.message : '无法发起 TRUSTED 登录'
    } finally {
      loading = false
    }
  }
</script>
~~~

使用本地响应式 CSS，不加载外部字体、图片、脚本或统计。

- [ ] **Step 5: 验证并提交**

~~~bash
pnpm vitest run src/App.test.ts
pnpm test
pnpm check
pnpm format:check
git add src/App.svelte src/App.test.ts src/app.css src/lib/components src/main.ts
git commit -m "feat: add TRUSTED login simulator UI"
~~~

### Task 6: 静态容器

**Files:**
- Create: nginx.conf
- Create: Dockerfile
- Create: .dockerignore

- [ ] **Step 1: 创建 nginx 配置**

监听 8080，try_files 回落 index.html。CSP 只允许本站脚本/样式，禁止 connect/object/frame，form-action 仅允许 https://swanlab.aruing.top。

- [ ] **Step 2: 创建 Dockerfile**

Node Alpine 阶段冻结 lockfile 构建；运行阶段使用 nginxinc/nginx-unprivileged:alpine，复制 dist 和 nginx.conf，暴露 8080。

- [ ] **Step 3: 验证并提交**

~~~bash
pnpm build
docker build -t trusted-login-simulator:test .
docker run --rm -d --name trusted-login-simulator-test -p 18080:8080 trusted-login-simulator:test
curl -fsSI http://127.0.0.1:18080/
docker stop trusted-login-simulator-test
git add Dockerfile .dockerignore nginx.conf
git commit -m "build: package simulator as static site"
~~~

Expected: HTTP 200 且有 CSP。

### Task 7: Kubernetes 清单与部署脚本

**Files:**
- Create: /Users/zirui/projects/arui/arui-iac/swanlab/arui/trusted-login-simulator.yaml
- Create: /Users/zirui/projects/arui/arui-iac/swanlab/arui/trusted-login-simulator-assets.yaml
- Create: /Users/zirui/projects/arui/arui-iac/swanlab/arui/trusted-login-simulator

- [ ] **Step 1: 创建固定清单**

包含 nginx 配置 ConfigMap、Deployment、ClusterIP Service 和 Traefik IngressRoute。Deployment 使用 nginxinc/nginx-unprivileged:alpine、8080、非 root、只读 rootfs、/tmp emptyDir、静态资源 ConfigMap、探针和资源限额。IngressRoute 匹配 trusted.aruing.top。

- [ ] **Step 2: 创建部署脚本**

~~~bash
pnpm --dir "$PROJECT_DIR" build
"$KUBECTL_BIN" -n "$NAMESPACE" create configmap trusted-login-simulator-assets \
  --from-file="$PROJECT_DIR/dist" --dry-run=client -o yaml \
  > "$SCRIPT_DIR/trusted-login-simulator-assets.yaml"
"$KUBECTL_BIN" apply -f "$SCRIPT_DIR/trusted-login-simulator-assets.yaml"
"$KUBECTL_BIN" apply -f "$SCRIPT_DIR/trusted-login-simulator.yaml"
"$KUBECTL_BIN" -n "$NAMESPACE" rollout restart deployment/trusted-login-simulator
"$KUBECTL_BIN" -n "$NAMESPACE" rollout status deployment/trusted-login-simulator --timeout=180s
~~~

默认 NAMESPACE=swanlab，PROJECT_DIR 指向 simulator，并允许环境变量覆盖。

- [ ] **Step 3: 校验并提交 IaC**

~~~bash
kubectl apply --dry-run=client -f trusted-login-simulator-assets.yaml
kubectl apply --dry-run=client -f trusted-login-simulator.yaml
git add swanlab/arui/trusted-login-simulator swanlab/arui/trusted-login-simulator.yaml swanlab/arui/trusted-login-simulator-assets.yaml
git commit -m "feat: deploy TRUSTED login simulator"
~~~

Expected: 清单通过；不加入 IaC 现有 .DS_Store 和 swanlab/self-hosted。

### Task 8: 集群与公网验证

**Files:**
- Modify only if verification exposes a defect in Tasks 1–7.

- [ ] **Step 1: 部署**

Run: /Users/zirui/projects/arui/arui-iac/swanlab/arui/trusted-login-simulator

Expected: ConfigMap、Deployment、Service、IngressRoute 应用成功并 rollout 完成。

- [ ] **Step 2: 验证服务**

~~~bash
kubectl -n swanlab get deployment,pods,service,ingressroute
kubectl -n swanlab port-forward service/trusted-login-simulator 18080:80
curl -fsSI http://127.0.0.1:18080/
~~~

Expected: Pod Ready；HTTP 200 和 CSP。

- [ ] **Step 3: 验证公网**

Run: curl -fsSI https://trusted.aruing.top/

Expected: Cloudflare 后返回 200。若 hostname 尚未加入 tunnel，则报告 DNS/tunnel 阻塞，不输出或修改 Cloudflare 凭据。

- [ ] **Step 4: 验证 TRUSTED 登录**

用已启用的测试 Provider 和配套私钥确认：未绑定 ID 自动创建并登录；相同 ID 再次提交直接登录；错误 issuer、过期时间或签名被 Auth 拒绝。

- [ ] **Step 5: 最终验证**

~~~bash
pnpm test
pnpm check
pnpm format:check
pnpm build
git status --short
~~~

Expected: 所有命令 exit 0，工作区只有预期变更。
