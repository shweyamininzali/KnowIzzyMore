import { currentUser, supabase, supabaseReady } from "./auth.js?v=950eba3";

const profilePage = document.querySelector("#profile-page");
const profileForm = document.querySelector("#profile-form");
const profileName = document.querySelector("#profile-name");
const profileCountry = document.querySelector("#profile-country");
const profileInterests = document.querySelector("#profile-interests");
const profileEmail = document.querySelector("#profile-email");
const profileSave = document.querySelector("#profile-save");
const profileSignout = document.querySelector("#profile-signout");
const profileStatus = document.querySelector("#profile-status");
const siteSections = [...document.querySelectorAll("main > section:not(#profile-page)")];
let loadSequence = 0;

function setStatus(message, isError = false) {
  profileStatus.textContent = message;
  profileStatus.classList.toggle("is-error", isError);
}

function updatePageRoute() {
  const showingProfile = window.location.hash === "#profile" && Boolean(currentUser);
  profilePage.hidden = !showingProfile;
  for (const section of siteSections) {
    section.hidden = showingProfile;
  }

  if (window.location.hash === "#profile" && !currentUser) {
    window.location.hash = "#home";
  }
}

async function loadProfile(user) {
  const sequence = ++loadSequence;
  if (!user || !supabase) {
    profileForm.reset();
    profileEmail.textContent = "";
    setStatus("");
    return;
  }

  profileSave.disabled = true;
  profileEmail.textContent = user.email || "Unavailable";
  setStatus("Loading your profile…");
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, country, interests")
      .eq("user_id", user.id)
      .single();

    if (error) {
      throw error;
    }
    if (sequence !== loadSequence) {
      return;
    }

    profileName.value = data.display_name;
    profileCountry.value = data.country;
    profileInterests.value = data.interests;
    setStatus("");
  } catch (error) {
    if (sequence === loadSequence) {
      setStatus(error instanceof Error ? error.message : "Could not load your profile.", true);
    }
  } finally {
    if (sequence === loadSequence) {
      profileSave.disabled = false;
    }
  }
}

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser || !supabase) {
    setStatus("Please sign in again to update your profile.", true);
    return;
  }

  profileSave.disabled = true;
  profileSave.setAttribute("aria-busy", "true");
  setStatus("Saving your profile…");
  try {
    const profile = {
      display_name: profileName.value.trim(),
      country: profileCountry.value.trim(),
      interests: profileInterests.value.trim(),
    };
    if (!profile.display_name) {
      setStatus("Enter a name for your profile.", true);
      profileName.focus();
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update(profile)
      .eq("user_id", currentUser.id)
      .select("user_id")
      .single();

    if (error) {
      throw error;
    }

    document.dispatchEvent(
      new CustomEvent("profile-updated", { detail: { displayName: profile.display_name } }),
    );
    setStatus("Your profile has been saved.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not save your profile.", true);
  } finally {
    profileSave.disabled = false;
    profileSave.removeAttribute("aria-busy");
  }
});

profileSignout.addEventListener("click", async () => {
  if (!supabase) {
    setStatus("The account service is unavailable. Please try again later.", true);
    return;
  }

  profileSignout.disabled = true;
  setStatus("Signing you out…");
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not sign out.", true);
  } finally {
    profileSignout.disabled = false;
  }
});

document.addEventListener("auth-state-changed", (event) => {
  const user = event.detail.user;
  if (!user && window.location.hash === "#profile") {
    window.location.hash = "#home";
  }
  updatePageRoute();
  if (user) {
    setTimeout(() => void loadProfile(user), 0);
  } else {
    void loadProfile(null);
  }
});
window.addEventListener("hashchange", updatePageRoute);

await supabaseReady;
updatePageRoute();
if (currentUser) {
  await loadProfile(currentUser);
}
