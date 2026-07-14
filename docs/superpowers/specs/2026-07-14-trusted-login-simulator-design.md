# TRUSTED Login Simulator Design

## Goal

Build a public, stateless Svelte test application that behaves like a trusted third-party platform: it signs a short-lived JWT entirely in the browser and opens the deployed SwanLab TRUSTED login flow in a new window.

The application will live at `temp/trusted-login-simulator`, be deployed in the `swanlab` Kubernetes namespace, and be exposed as `https://trusted.aruing.top`.

## Confirmed SwanLab Contract

The simulator submits an HTML form to:

```text
POST {swanlabOrigin}/api/auth/sso/trusted/callback/{provider}
Content-Type: application/x-www-form-urlencoded

token={signedJwt}
```

The deployed test target is fixed to `https://swanlab.aruing.top` and is not configurable in the page. The Auth service accepts only enabled `TRUSTED` providers, validates an asymmetric JWT signature, requires an unexpired `exp`, requires `iss` to equal the Provider `clientId`, and maps the configured ID and username claims. On success, Auth redirects the new window into SwanLab's `/sso` flow, where an existing binding is logged in or a new private-deployment user is provisioned.

## Architecture

The application is a static Svelte SPA. All configuration, PEM parsing, JWT construction, signing, and form submission happen in the browser. The deployed container serves only static assets and has no signing endpoint, database, session, analytics, or application logs containing user input.

The browser uses `jose` to import a user-supplied PKCS#8 PEM private key and sign the JWT. Supported algorithms match Auth: `RS256`, `RS384`, `RS512`, `ES256`, `ES384`, and `ES512`. No HMAC algorithms are offered.

The app is built in a multi-stage container and served by nginx. Kubernetes resources consist of one Deployment, one ClusterIP Service, and one Traefik `IngressRoute` matching `Host(`trusted.aruing.top`)`.

## User Interface

The page is a compact single-screen testing form with these sections:

1. SwanLab target
   - Fixed target display: `https://swanlab.aruing.top`
   - TRUSTED Provider name
2. Signing
   - Algorithm selector, default `RS256`
   - PEM private-key textarea
   - Local file picker that reads a key file into the textarea
3. Token identity
   - Issuer (`iss`)
   - Token lifetime in seconds, default `60`
   - External-user claim name, default `sub`
   - External-user claim value
   - Username claim name, default `username`
   - Username claim value
   - Optional extra claims as a JSON object
4. Action and diagnostics
   - “Open SwanLab” button
   - Inline validation or signing error
   - Read-only decoded header and payload preview after successful signing

The app does not generate keys. The user can paste a private key or select a local file. Selecting a file only invokes the browser `FileReader`; it does not upload the file.

## Data Flow

1. The user clicks “Open SwanLab”.
2. The click handler synchronously opens a named blank window so browser popup protection does not block the later navigation.
3. The app normalizes and validates all fields.
4. The app parses extra claims, rejecting non-object JSON and conflicts with claims controlled by the form.
5. The app imports the private key for the selected algorithm.
6. The app creates a JWT containing:
   - `iss` from the form
   - `iat` as the current Unix time
   - `exp` as current time plus the configured lifetime
   - the configured external-user claim and value
   - the configured username claim and value
   - non-conflicting extra claims
7. The app signs the JWT and updates the decoded preview.
8. The app constructs a temporary hidden form with `method="POST"`, `enctype="application/x-www-form-urlencoded"`, and a `token` input.
9. The form targets the previously opened window and submits to the encoded Provider callback URL.
10. The temporary form is removed. SwanLab owns all subsequent redirects and login/provision behavior in the new window.

No form values or tokens are written to local storage, session storage, IndexedDB, cookies, URLs, or the simulator server. Refreshing or closing the page clears all entered values.

## Validation and Error Handling

Validation occurs before key import and signing:

- Provider name, issuer, claim names, claim values, and private key are required and trimmed.
- Provider is encoded as one URL path segment.
- Lifetime must be an integer from 1 through 600 seconds.
- ID and username claim names must differ.
- Extra claims must be a plain JSON object.
- Extra claims may not override `iss`, `iat`, `exp`, or either configured identity claim.
- The selected algorithm and supplied private key must be compatible.

If validation or signing fails, the blank window is closed and the error appears next to the action area. Errors should distinguish invalid configuration, invalid JSON, unreadable key files, unsupported or mismatched PEM keys, and popup blocking. Raw private-key contents are never included in errors or diagnostic previews.

Network and SwanLab business errors render in the new window because the form navigates directly to Auth. This intentionally preserves the real third-party-platform behavior.

## Component Boundaries

- `src/lib/config.ts`: form types, defaults, normalization, and validation.
- `src/lib/token.ts`: extra-claim parsing, JWT payload construction, private-key import, and signing.
- `src/lib/submit.ts`: callback URL construction, popup lifecycle, and hidden-form submission.
- `src/lib/components/*`: focused form sections and diagnostics.
- `src/routes/+page.svelte`: page-level state and orchestration only.

Pure validation, payload, URL, and submission helpers remain independent from Svelte components so they can be unit tested without a browser page.

## Testing

Vitest and Testing Library cover:

- target URL normalization and rejection cases;
- lifetime and required-field validation;
- identity claim collision and protected extra-claim rejection;
- JWT payload timestamps and custom claim mappings;
- RS256 signing with a test-only fixture key and signature verification with its public key;
- callback URL path encoding;
- hidden form method, action, token input, and target window;
- popup cleanup when signing fails;
- the page's file-input behavior and successful submit orchestration.

The implementation follows red-green-refactor: each behavior receives a failing test before production code. Final verification includes unit tests, lint/type checks, a production build, container startup and HTTP smoke test, Kubernetes rollout status, public `trusted.aruing.top` response, and an end-to-end TRUSTED login using a separately configured test Provider.

## Deployment

Project deployment assets stay with the simulator, while cluster-facing manifests and a deployment helper are added under `/Users/zirui/projects/arui/arui-iac/swanlab/arui` as requested.

The deployment helper follows the existing personal-server workflow: build the image on the target Fedora host, import it into the k3s container runtime, apply the manifests, restart the Deployment, and wait for rollout. The Kubernetes workload uses a non-root nginx container, readiness/liveness probes, resource requests/limits, and `imagePullPolicy: IfNotPresent` for the locally imported image.

The `IngressRoute` sends `trusted.aruing.top` traffic directly to the simulator Service. Cloudflare DNS/tunnel routing must send that hostname to the same Traefik entry point already serving `swanlab.aruing.top`; the manifest does not store Cloudflare credentials.

## Out of Scope

- Saving presets or form history
- Uploading or storing private keys
- Server-side token signing
- Automatic key-pair generation
- Creating or editing SwanLab Provider records
- Supporting symmetric JWT algorithms
- Replacing SwanLab's existing SSO callback or provisioning UI
