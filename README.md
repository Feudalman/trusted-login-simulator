# TRUSTED Login Simulator

用于模拟受信第三方平台发起 SwanLab TRUSTED 登录。页面在浏览器内使用用户提供的私钥签发短期 JWT，并通过新窗口向 SwanLab Auth 提交表单。

## 安全边界

- 私钥、表单配置和 JWT 只存在于当前页面内存中。
- 页面不使用 Cookie、Local Storage、Session Storage、IndexedDB 或服务端 API。
- 刷新或关闭页面会清空全部输入。
- CSP 禁止页面主动发起网络请求，并只允许向用户选择的 HTTP/HTTPS 目标提交登录表单。
- 应用不会生成、上传或保存密钥。

## 目标地址

SwanLab 根地址默认是 `https://swanlab.aruing.top`，可在页面中修改为其他 HTTP/HTTPS 服务。只需填写服务器根地址；应用会自动拼接 `/api/auth/sso/trusted/callback/{Provider}` 回调路由。

## Provider 配置

在 SwanLab 控制台创建并启用 TRUSTED Provider：

- Client ID：与页面填写的 `Issuer (iss)` 完全一致。
- Client Secret：用于验签的 RSA/ECDSA PEM 公钥。
- `userAttributeMapping.id`：默认可填写 `sub`。
- `userAttributeMapping.username`：默认可填写 `username`。

测试私钥必须是 PKCS#8 PEM。可在本机生成一套测试密钥：

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out trusted-private.pem
openssl pkey -in trusted-private.pem -pubout -out trusted-public.pem
```

将 `trusted-public.pem` 配置到 Provider，把 `trusted-private.pem` 选择或粘贴到模拟器页面。不要使用生产平台的真实私钥进行公开测试。

## 本地开发

```bash
pnpm install
pnpm dev
```

检查：

```bash
pnpm test
pnpm check
pnpm format:check
pnpm build
```

## Kubernetes 部署

部署文件位于：

```text
/Users/zirui/projects/arui/arui-iac/swanlab/arui/
```

执行：

```bash
/Users/zirui/projects/arui/arui-iac/swanlab/arui/trusted-login-simulator
```

脚本会构建静态资源、更新 ConfigMap、应用 Deployment/Service/IngressRoute，并等待 rollout。IngressRoute 使用域名 `trusted.aruing.top`；该域名还需要在 Cloudflare Tunnel 中指向与 `swanlab.aruing.top` 相同的入口。
