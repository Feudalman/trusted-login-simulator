import { validateForm, type SimulatorForm } from "./config";
import {
  appendLocationParam,
  probeTrustedRedirect,
  type RedirectProbe,
} from "./submit";
import { signTrustedToken, type SignedToken } from "./token";

export interface LoginPreview {
  header: SignedToken["header"];
  payload: SignedToken["payload"];
  redirect: RedirectProbe;
}

export interface LoginDependencies {
  signToken: typeof signTrustedToken;
  probe: typeof probeTrustedRedirect;
}

const defaultDependencies: LoginDependencies = {
  signToken: signTrustedToken,
  probe: probeTrustedRedirect,
};

export async function startTrustedLogin(
  form: SimulatorForm,
  dependencies: LoginDependencies = defaultDependencies,
): Promise<LoginPreview> {
  const config = validateForm(form);
  const signed = await dependencies.signToken(config);
  const probed = await dependencies.probe(
    signed.token,
    config.origin,
    config.provider,
  );
  const redirect: RedirectProbe = {
    status: probed.status,
    location: appendLocationParam(
      probed.location,
      "redirectTo",
      config.redirectTo,
    ),
  };
  return { header: signed.header, payload: signed.payload, redirect };
}
