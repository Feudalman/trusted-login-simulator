# Editable SwanLab Origin Design

## Goal

Allow a user to change the SwanLab server root address at runtime while preserving the existing TRUSTED callback-route construction. The current production address remains the default.

## Scope

- Replace the fixed target display with an editable `SwanLab 根地址` URL field.
- Default the field to `https://swanlab.aruing.top`.
- Keep the Provider field separate and continue constructing the callback route as `/api/auth/sso/trusted/callback/{encodedProvider}`.
- Keep the address in page memory only. Do not add persistence or server-side configuration.

## Data Flow

Add an `origin` property to `SimulatorForm`. `defaultForm()` supplies the current SwanLab origin. `TargetSection` binds the origin and Provider fields to the form. `validateForm()` validates and normalizes the origin before `startTrustedLogin()` passes it to `submitToken()`. The submit layer constructs the final callback URL from the validated origin and encoded Provider.

The final URL has this form:

```text
{origin}/api/auth/sso/trusted/callback/{encodeURIComponent(provider)}
```

## Validation and Normalization

The root address must:

- be a syntactically valid absolute URL;
- use the `http:` or `https:` protocol;
- contain no username or password;
- contain no path other than `/`, query string, or fragment.

Hostname forms such as domains, IP addresses, `localhost`, and explicit ports are supported. Validation normalizes the accepted value to `URL.origin`, which also removes a trailing slash. Invalid values produce a user-facing `SwanLab 根地址` error before a login window is opened.

## UI

`TargetSection` replaces the `固定地址` block with a labeled URL input. Its supporting copy explains that the application appends the TRUSTED callback route automatically. No reset control or saved history is included.

## Content Security Policy

The deployed Nginx policy currently restricts `form-action` to one origin. Change it to allow the `http:` and `https:` schemes so the browser can submit to a user-selected root address. Other CSP directives remain unchanged, including `connect-src 'none'`.

Browsers may still warn about or block an HTTP form target when the simulator itself is served over HTTPS. This is browser mixed-content behavior; HTTPS targets remain the production-safe choice.

Update the README to state that form submission is permitted to the user-selected HTTP/HTTPS target instead of only the original fixed host.

## Tests

- Configuration tests verify the default origin, accepted domain/localhost/port values, normalization, and rejection of invalid protocols, credentials, paths, queries, and fragments.
- Submission tests verify callback construction with a supplied origin and encoded Provider.
- Login tests verify that the validated origin reaches the submission dependency.
- App tests verify that the address field is prefilled, editable, and included in the submitted in-memory form.
- The full test, type-check, formatting, and production-build commands must pass.

## Out of Scope

- Custom callback paths.
- Persisting the selected address.
- Build-time or server-side default-address configuration.
- Bypassing browser mixed-content restrictions.
