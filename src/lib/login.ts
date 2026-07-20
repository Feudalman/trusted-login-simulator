import { validateForm, type SimulatorForm } from "./config";
import { openLoginWindow, submitToken } from "./submit";
import { signTrustedToken, type SignedToken } from "./token";

export interface LoginPreview {
  header: SignedToken["header"];
  payload: SignedToken["payload"];
}

export interface LoginDependencies {
  openWindow: typeof openLoginWindow;
  signToken: typeof signTrustedToken;
  submit: typeof submitToken;
}

const defaultDependencies: LoginDependencies = {
  openWindow: openLoginWindow,
  signToken: signTrustedToken,
  submit: submitToken,
};

export async function startTrustedLogin(
  form: SimulatorForm,
  dependencies: LoginDependencies = defaultDependencies,
): Promise<LoginPreview> {
  const config = validateForm(form);
  const { popup, target } = dependencies.openWindow();
  try {
    const signed = await dependencies.signToken(config);
    dependencies.submit(signed.token, config.origin, config.provider, target);
    return { header: signed.header, payload: signed.payload };
  } catch (error) {
    popup.close();
    throw error;
  }
}
