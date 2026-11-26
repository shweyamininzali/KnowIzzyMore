import { currentUser, supabase, supabaseReady } from "./auth.js?v=pages-avatars-1";

const signInButton = document.querySelector("#board-signin");
const boardJoin = document.querySelector("#board-join");
const boardStatus = document.querySelector("#board-status");
const boardNotice = document.querySelector("#board-notice");
const postList = document.querySelector("#post-list");
const postForm = document.querySelector("#post-form");
const postAuthor = document.querySelector("#post-author");
const postMessage = document.querySelector("#post-message");
const postVisibility = document.querySelector("#post-visibility");
const postSubmit = document.querySelector("#post-submit");
const postStatus = document.querySelector("#post-status");
const messages = new Map();
let feedGeneration = 0;
let profileGeneration = 0;
let boardAvatarPath = null;

function getErrorMessage(error, fallback) {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

function isMissingAvatarColumn(error) {
  return (
    ["42703", "PGRST204"].includes(error?.code) &&
    typeof error.message === "string" &&
    error.message.includes("avatar_path")
  );
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function setPostStatus(message, isError) {
  postStatus.textContent = message;
  postStatus.classList.toggle("is-error", Boolean(isError));
}

function setRealtimeStatus(status, connected) {
  boardStatus.textContent = status;
  boardStatus.classList.toggle("is-connected", connected);
}

async function updateBoardAccess(user) {
  const request = ++profileGeneration;
  const signedIn = Boolean(user);
  boardJoin.hidden = signedIn;

  if (!signedIn) {
    postForm.hidden = true;
    postForm.reset();
    postAuthor.textContent = "";
    boardAvatarPath = null;
    setPostStatus("");
    return;
  }

  postForm.hidden = true;
  try {
    let result = await supabase
      .from("profiles")
      .select("display_name, avatar_path")
      .eq("user_id", user.id)
      .single();

    if (isMissingAvatarColumn(result.error)) {
      result = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .single();
    }

    const { data, error } = result;
    if (error) {
      throw error;
    }
    if (request !== profileGeneration) {
      return;
    }

    postAuthor.textContent = data.display_name;
    boardAvatarPath = data.avatar_path || null;
    postForm.hidden = false;
    setPostStatus("");
  } catch (error) {
    if (request === profileGeneration) {
      setPostStatus(
        getErrorMessage(error, "Could not load your profile. Update it before posting."),
        true,
      );
    }
  }
}

function renderPosts() {
  const posts = [...messages.values()].sort((first, second) =>
    first.created_at.localeCompare(second.created_at),
  );
  const nearBottom =
    postList.scrollHeight - postList.clientHeight - postList.scrollTop < 80;

  postList.replaceChildren();
  if (posts.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "guestbook-empty";
    emptyState.textContent = "No messages yet. Start the conversation.";
    postList.append(emptyState);
    return;
  }

  for (const post of posts) {
    const article = document.createElement("article");
    article.className = "guestbook-post";

    const metadata = document.createElement("div");
    metadata.className = "guestbook-post-meta";

    if (post.avatar_path) {
      const avatar = document.createElement("img");
      avatar.className = "guestbook-avatar";
      avatar.alt = "";
      avatar.loading = "lazy";
      avatar.src = supabase.storage.from("avatars").getPublicUrl(post.avatar_path).data.publicUrl;
      avatar.addEventListener("error", () => avatar.remove(), { once: true });
      metadata.append(avatar);
    }

    const author = document.createElement("span");
    author.className = "guestbook-author";
    author.textContent = post.name;

    const time = document.createElement("time");
    time.className = "guestbook-time";
    time.dateTime = post.created_at;
    time.textContent = formatTime(post.created_at);
    metadata.append(author, time);

    if (post.visibility === "private") {
      const visibility = document.createElement("span");
      visibility.className = "guestbook-visibility";
      visibility.textContent = "Private";
      metadata.append(visibility);
    }

    const message = document.createElement("p");
    message.className = "guestbook-message";
    message.textContent = post.message;

    article.append(metadata, message);
    postList.append(article);
  }

  if (nearBottom) {
    postList.scrollTop = postList.scrollHeight;
  }
}

function showLoadingPosts() {
  feedGeneration += 1;
  messages.clear();
  postList.setAttribute("aria-busy", "true");
  const loadingState = document.createElement("p");
  loadingState.className = "guestbook-empty";
  loadingState.textContent = "Loading messages…";
  postList.replaceChildren(loadingState);
}

function trimOldPosts() {
  const orderedPosts = [...messages.values()].sort((first, second) =>
    first.created_at.localeCompare(second.created_at),
  );
  while (orderedPosts.length > 100) {
    const oldest = orderedPosts.shift();
    messages.delete(oldest.id);
  }
}

function addPost(post) {
  if (!post?.id || messages.has(post.id)) {
    return;
  }

  messages.set(post.id, post);
  trimOldPosts();
  renderPosts();
}

async function loadPosts() {
  showLoadingPosts();
  const generation = ++feedGeneration;

  try {
    let result = await supabase
      .from("posts")
      .select("id, name, message, created_at, visibility, avatar_path")
      .order("created_at", { ascending: false })
      .limit(100);

    if (isMissingAvatarColumn(result.error)) {
      result = await supabase
        .from("posts")
        .select("id, name, message, created_at, visibility")
        .order("created_at", { ascending: false })
        .limit(100);
    }

    const { data, error } = result;
    if (error) {
      throw error;
    }
    if (generation !== feedGeneration) {
      return;
    }

    for (const post of data) {
      messages.set(post.id, post);
    }
    trimOldPosts();
    renderPosts();
    boardNotice.textContent = "";
  } catch (error) {
    if (generation !== feedGeneration) {
      return;
    }
    const emptyState = document.createElement("p");
    emptyState.className = "guestbook-empty";
    emptyState.textContent = "Messages aren’t available right now.";
    postList.replaceChildren(emptyState);
    boardNotice.textContent = `Could not load messages: ${getErrorMessage(error, "Please try again later.")}`;
  } finally {
    if (generation === feedGeneration) {
      postList.setAttribute("aria-busy", "false");
    }
  }
}

signInButton.addEventListener("click", () => {
  document.querySelector("#auth-open").click();
});

postForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) {
    setPostStatus("Please sign in before posting.", true);
    return;
  }

  if (!postMessage.value.trim()) {
    setPostStatus("Write a message before sending it.", true);
    postMessage.focus();
    return;
  }

  postSubmit.disabled = true;
  setPostStatus("Sending your message…");
  try {
    const { data, error } = await supabase
      .from("posts")
      .insert({
        message: postMessage.value.trim(),
        visibility: postVisibility.value,
        user_id: currentUser.id,
      })
      .select("id, name, message, created_at, visibility")
      .single();

    if (error) {
      throw error;
    }

    addPost({ ...data, avatar_path: boardAvatarPath });
    postMessage.value = "";
    setPostStatus("Your message has been posted.");
    postMessage.focus();
  } catch (error) {
    setPostStatus(getErrorMessage(error, "Could not post your message. Please try again."), true);
  } finally {
    postSubmit.disabled = false;
  }
});

async function initializeBoard() {
  try {
    await supabaseReady;
    if (!supabase) {
      throw new Error("Supabase could not be initialized. Please try again later.");
    }

    void updateBoardAccess(currentUser);
    supabase.auth.onAuthStateChange((_event, session) => {
      showLoadingPosts();
      if (!session?.user) {
        void updateBoardAccess(null);
      } else {
        postForm.hidden = true;
      }
      setTimeout(() => {
        void updateBoardAccess(session?.user ?? null);
        void loadPosts();
      }, 0);
    });

    supabase
      .channel("public-message-board")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        ({ new: post }) => addPost(post),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts" },
        ({ new: post }) => {
          if (post?.id) {
            messages.set(post.id, post);
            trimOldPosts();
            renderPosts();
          }
        },
      )
      .subscribe((status, error) => {
        const connected = status === "SUBSCRIBED";
        setRealtimeStatus(connected ? "Live" : "Reconnecting…", connected);
        if (error) {
          boardNotice.textContent = `Live updates unavailable: ${getErrorMessage(error, "Please refresh to see new messages.")}`;
        }
      });

    await loadPosts();
  } catch (error) {
    setRealtimeStatus("Unavailable", false);
    boardNotice.textContent = getErrorMessage(error, "The message board could not be initialized.");
    postList.setAttribute("aria-busy", "false");
  }
}

initializeBoard();
