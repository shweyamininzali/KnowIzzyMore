const SUPABASE_URL = "https://hznyusajrxpivjljpzwd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_o5jFrP0zT0zL6X2Oxgws6w_mEu3xwrJ";
const SUPABASE_SDK_URL = "https://esm.sh/@supabase/supabase-js@2";

const authOpen = document.querySelector("#auth-open");
const authDialog = document.querySelector("#auth-dialog");
const authClose = document.querySelector("#auth-close");
const authTitle = document.querySelector("#auth-title");
const authDescription = document.querySelector("#auth-description");
const authForm = document.querySelector("#auth-form");
const authDisplayNameLabel = document.querySelector("#auth-display-name-label");
const authDisplayName = document.querySelector("#auth-display-name");
const authEmail = document.querySelector("#auth-email");
const authPassword = document.querySelector("#auth-password");
const authSubmit = document.querySelector("#auth-submit");
const authLoginMode = document.querySelector("#auth-login-mode");
const authSignupMode = document.querySelector("#auth-signup-mode");
const authModeToggle = document.querySelector("#auth-mode-toggle");
const authSession = document.querySelector("#auth-session");
const authUserLine = document.querySelector("#auth-user-line");
const authSignout = document.querySelector("#auth-signout");
const authStatus = document.querySelector("#auth-status");
const authFootnote = document.querySelector("#auth-footnote");

export let supabase = null;
let connectionState = "loading";
let connectionError = null;
export let currentUser = null;
let mode = "login";

function setStatus(message, state) {
  authStatus.textContent = message;
  if (state) {
    authStatus.dataset.state = state;
  } else {
    delete authStatus.dataset.state;
  }
}

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error.message === "string") {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

function updateView() {
  const signedIn = Boolean(currentUser);
  const signingUp = !signedIn && mode === "signup";
  authOpen.textContent = signedIn ? "My profile" : "Sign in";
  authForm.hidden = signedIn;
  authModeToggle.hidden = signedIn;
  authSession.hidden = !signedIn;
  authFootnote.hidden = signedIn;
  authDisplayNameLabel.hidden = !signingUp;
  authDisplayName.hidden = !signingUp;
  authDisplayName.required = signingUp;

  if (signedIn) {
    authTitle.textContent = "You’re signed in.";
    authDescription.textContent = "Your account is ready whenever you need it.";
    authUserLine.textContent = `Signed in as ${currentUser.email || "your account"}.`;
    return;
  }

  authTitle.textContent = mode === "signup" ? "Make yourself at home." : "Welcome back.";
  authDescription.textContent =
    mode === "signup"
      ? "Choose a profile name, email, and password of at least six characters."
      : "Sign in with your email address and password.";
  authFootnote.textContent =
    mode === "signup"
      ? "You may need to confirm your email before logging in."
      : "Your account is managed securely by Supabase.";
  authLoginMode.setAttribute("aria-pressed", String(mode === "login"));
  authSignupMode.setAttribute("aria-pressed", String(mode === "signup"));
  authSubmit.textContent = mode === "signup" ? "Create account" : "Log in";
  authPassword.autocomplete = mode === "signup" ? "new-password" : "current-password";
}

function setMode(nextMode) {
  mode = nextMode;
  authPassword.value = "";
  setStatus("");
  updateView();
}

authOpen.addEventListener("click", () => {
  if (currentUser) {
    window.location.hash = "profile";
    return;
  }

  authDialog.showModal();
  if (connectionError) {
    setStatus(`Could not connect to Supabase: ${getErrorMessage(connectionError)}`, "error");
  } else if (connectionState === "loading") {
    setStatus("Connecting to your account…");
  } else {
    setStatus("");
  }
  if (currentUser) {
    authSignout.focus();
  } else {
    authEmail.focus();
  }
});

authClose.addEventListener("click", () => authDialog.close());
authDialog.addEventListener("click", (event) => {
  if (event.target === authDialog) {
    authDialog.close();
  }
});

authLoginMode.addEventListener("click", () => setMode("login"));
authSignupMode.addEventListener("click", () => setMode("signup"));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) {
    setStatus(
      connectionError
        ? `Could not connect to Supabase: ${getErrorMessage(connectionError)}`
        : "The account service is still connecting. Please try again in a moment.",
      connectionError ? "error" : undefined,
    );
    return;
  }

  const email = authEmail.value.trim();
  const password = authPassword.value;
  authSubmit.disabled = true;
  authSubmit.setAttribute("aria-busy", "true");
  setStatus(mode === "signup" ? "Creating your account…" : "Signing you in…");

  try {
    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                display_name: authDisplayName.value.trim(),
              },
              emailRedirectTo: new URL("./", window.location.href).href,
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      throw result.error;
    }

    if (mode === "signup" && result.data.user && !result.data.session) {
      authForm.reset();
      setStatus("If this address can be registered, check your email for a confirmation link.", "success");
      return;
    }

    if (!result.data.user) {
      setStatus("Supabase did not return an account. Please try again.", "error");
      return;
    }

    setStatus(mode === "signup" ? "Your account is ready." : "You’re signed in.", "success");
  } catch (error) {
    setStatus(getErrorMessage(error), "error");
  } finally {
    authSubmit.disabled = false;
    authSubmit.removeAttribute("aria-busy");
  }
});

authSignout.addEventListener("click", async () => {
  if (!supabase) {
    setStatus("The account service is unavailable. Please try again later.", "error");
    return;
  }

  authSignout.disabled = true;
  authSignout.setAttribute("aria-busy", "true");
  setStatus("Signing you out…");
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    setStatus("You’re signed out.", "success");
  } catch (error) {
    setStatus(getErrorMessage(error), "error");
  } finally {
    authSignout.disabled = false;
    authSignout.removeAttribute("aria-busy");
  }
});

async function initializeAuth() {
  try {
    const { createClient } = await import(SUPABASE_SDK_URL);
    supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    supabase.auth.onAuthStateChange((_event, session) => {
      const hadUser = Boolean(currentUser);
      currentUser = session?.user ?? null;
      if (hadUser && !currentUser) {
        mode = "login";
      }
      updateView();
      document.dispatchEvent(
        new CustomEvent("auth-state-changed", { detail: { user: currentUser } }),
      );
    });

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    currentUser = data.session?.user ?? null;
    connectionState = "ready";
    updateView();
    document.dispatchEvent(
      new CustomEvent("auth-state-changed", { detail: { user: currentUser } }),
    );
    if (authDialog.open) {
      setStatus("");
    }
  } catch (error) {
    connectionState = "error";
    connectionError = error;
    if (authDialog.open) {
      setStatus(`Could not connect to Supabase: ${getErrorMessage(error)}`, "error");
    }
  }
}

updateView();
export const supabaseReady = initializeAuth();
