import { currentUser, supabase, supabaseReady } from "./auth.js?v=profile-button-name-1";

const profileSignin = document.querySelector("#profile-signin");
const profileSigninButton = document.querySelector("#profile-signin-button");
const profileContent = document.querySelector("#profile-content");
const profileForm = document.querySelector("#profile-form");
const profileName = document.querySelector("#profile-name");
const profileCountry = document.querySelector("#profile-country");
const profileInterests = document.querySelector("#profile-interests");
const profileEmail = document.querySelector("#profile-email");
const profileSave = document.querySelector("#profile-save");
const profileSignout = document.querySelector("#profile-signout");
const profileStatus = document.querySelector("#profile-status");
const avatarInput = document.querySelector("#profile-avatar-input");
const avatarPreview = document.querySelector("#profile-avatar-preview");
const avatarPlaceholder = document.querySelector("#profile-avatar-placeholder");
const avatarUpload = document.querySelector("#profile-avatar-upload");
const avatarStatus = document.querySelector("#profile-avatar-status");
let loadSequence = 0;
let profileAvatarPath = null;
let selectedPreviewUrl = null;

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function getErrorMessage(error, fallback) {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

function showAvatar(path) {
  profileAvatarPath = path || null;
  if (!profileAvatarPath || !supabase) {
    avatarPreview.removeAttribute("src");
    avatarPreview.hidden = true;
    avatarPlaceholder.hidden = false;
    return;
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(profileAvatarPath);
  avatarPreview.src = data.publicUrl;
  avatarPreview.hidden = false;
  avatarPlaceholder.hidden = true;
}

async function loadProfile(user) {
  const sequence = ++loadSequence;
  profileSignin.hidden = Boolean(user);
  profileContent.hidden = !user;

  if (!user || !supabase) {
    profileForm.reset();
    profileEmail.textContent = "";
    showAvatar(null);
    setStatus(profileStatus, "");
    setStatus(avatarStatus, "");
    return;
  }

  profileSave.disabled = true;
  avatarUpload.disabled = false;
  profileEmail.textContent = user.email || "Unavailable";
  setStatus(profileStatus, "Loading your profile…");
  try {
    let result = await supabase
      .from("profiles")
      .select("display_name, country, interests, avatar_path")
      .eq("user_id", user.id)
      .single();

    const needsAvatarSetup = isMissingAvatarColumn(result.error);
    if (needsAvatarSetup) {
      result = await supabase
        .from("profiles")
        .select("display_name, country, interests")
        .eq("user_id", user.id)
        .single();
    }

    const { data, error } = result;
    if (error) {
      throw error;
    }
    if (sequence !== loadSequence) {
      return;
    }

    profileName.value = data.display_name;
    profileCountry.value = data.country;
    profileInterests.value = data.interests;
    showAvatar(data.avatar_path);
    if (needsAvatarSetup) {
      avatarUpload.disabled = true;
      setStatus(
        avatarStatus,
        "Photo uploads need the latest Supabase setup. Run the updated supabase/message-board-access.sql script in the Supabase SQL Editor.",
        true,
      );
    } else {
      setStatus(avatarStatus, "");
    }
    setStatus(profileStatus, "");
  } catch (error) {
    if (sequence === loadSequence) {
      setStatus(profileStatus, getErrorMessage(error, "Could not load your profile."), true);
    }
  } finally {
    if (sequence === loadSequence) {
      profileSave.disabled = false;
    }
  }
}

function isMissingAvatarColumn(error) {
  return (
    ["42703", "PGRST204"].includes(error?.code) &&
    typeof error.message === "string" &&
    error.message.includes("avatar_path")
  );
}

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser || !supabase) {
    setStatus(profileStatus, "Please sign in again to update your profile.", true);
    return;
  }

  profileSave.disabled = true;
  profileSave.setAttribute("aria-busy", "true");
  setStatus(profileStatus, "Saving your profile…");
  try {
    const profile = {
      display_name: profileName.value.trim(),
      country: profileCountry.value.trim(),
      interests: profileInterests.value.trim(),
    };
    if (!profile.display_name) {
      setStatus(profileStatus, "Enter a name for your profile.", true);
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
    setStatus(profileStatus, "Your profile has been saved.");
  } catch (error) {
    setStatus(profileStatus, getErrorMessage(error, "Could not save your profile."), true);
  } finally {
    profileSave.disabled = false;
    profileSave.removeAttribute("aria-busy");
  }
});

avatarInput.addEventListener("change", () => {
  if (selectedPreviewUrl) {
    URL.revokeObjectURL(selectedPreviewUrl);
    selectedPreviewUrl = null;
  }
  const file = avatarInput.files?.[0];
  if (!file) {
    showAvatar(profileAvatarPath);
    setStatus(avatarStatus, "");
    return;
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    avatarInput.value = "";
    showAvatar(profileAvatarPath);
    setStatus(avatarStatus, "Choose a JPG, PNG, or WebP image.", true);
    return;
  }
  if (!file.size || file.size > 3 * 1024 * 1024) {
    avatarInput.value = "";
    showAvatar(profileAvatarPath);
    setStatus(avatarStatus, "Choose an image smaller than 3 MB.", true);
    return;
  }

  selectedPreviewUrl = URL.createObjectURL(file);
  avatarPreview.src = selectedPreviewUrl;
  avatarPreview.hidden = false;
  avatarPlaceholder.hidden = true;
  setStatus(avatarStatus, "Preview ready. Upload when you’re happy with it.");
});

avatarUpload.addEventListener("click", async () => {
  if (!currentUser || !supabase) {
    setStatus(avatarStatus, "Please sign in again before uploading a photo.", true);
    return;
  }

  const file = avatarInput.files?.[0];
  if (!file) {
    setStatus(avatarStatus, "Choose a profile photo first.", true);
    avatarInput.focus();
    return;
  }

  const extensionByType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensionByType[file.type];
  if (!extension || !file.size || file.size > 3 * 1024 * 1024) {
    setStatus(avatarStatus, "Choose a JPG, PNG, or WebP image up to 3 MB.", true);
    return;
  }

  const previousPath = profileAvatarPath;
  const nextPath = `${currentUser.id}/${crypto.randomUUID()}.${extension}`;
  let uploadedPath = null;
  avatarUpload.disabled = true;
  avatarUpload.setAttribute("aria-busy", "true");
  setStatus(avatarStatus, "Uploading your photo…");
  try {
    const { error: uploadError } = await supabase.storage.from("avatars").upload(nextPath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      throw uploadError;
    }
    uploadedPath = nextPath;

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_path: nextPath })
      .eq("user_id", currentUser.id)
      .select("user_id")
      .single();
    if (profileError) {
      throw profileError;
    }

    showAvatar(nextPath);
    avatarInput.value = "";
    if (selectedPreviewUrl) {
      URL.revokeObjectURL(selectedPreviewUrl);
      selectedPreviewUrl = null;
    }

    if (previousPath) {
      const { error: cleanupError } = await supabase.storage.from("avatars").remove([previousPath]);
      if (cleanupError) {
        setStatus(avatarStatus, `Photo uploaded, but the previous photo could not be removed: ${cleanupError.message}`, true);
        return;
      }
    }
    setStatus(avatarStatus, "Your profile photo has been uploaded.");
  } catch (error) {
    let message = getErrorMessage(error, "Could not upload your profile photo.");
    if (uploadedPath) {
      const { error: cleanupError } = await supabase.storage.from("avatars").remove([uploadedPath]);
      if (cleanupError) {
        message += ` The unused upload could not be removed: ${cleanupError.message}`;
      }
    }
    setStatus(avatarStatus, message, true);
  } finally {
    avatarUpload.disabled = false;
    avatarUpload.removeAttribute("aria-busy");
  }
});

profileSigninButton.addEventListener("click", () => {
  document.querySelector("#auth-open").click();
});

profileSignout.addEventListener("click", async () => {
  if (!supabase) {
    setStatus(profileStatus, "The account service is unavailable. Please try again later.", true);
    return;
  }

  profileSignout.disabled = true;
  setStatus(profileStatus, "Signing you out…");
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  } catch (error) {
    setStatus(profileStatus, getErrorMessage(error, "Could not sign out."), true);
  } finally {
    profileSignout.disabled = false;
  }
});

document.addEventListener("auth-state-changed", (event) => {
  const user = event.detail.user;
  if (user) {
    setTimeout(() => void loadProfile(user), 0);
  } else {
    void loadProfile(null);
  }
});

await supabaseReady;
if (currentUser) {
  await loadProfile(currentUser);
} else {
  await loadProfile(null);
}
