import { currentUser, supabase, supabaseReady } from "./auth.js";

const signInButton = document.querySelector("#board-signin");
const boardJoin = document.querySelector("#board-join");
const boardStatus = document.querySelector("#board-status");
const boardNotice = document.querySelector("#board-notice");
const postList = document.querySelector("#post-list");
const postForm = document.querySelector("#post-form");
const postName = document.querySelector("#post-name");
const postMessage = document.querySelector("#post-message");
const postSubmit = document.querySelector("#post-submit");
const postStatus = document.querySelector("#post-status");
const messages = new Map();

function getErrorMessage(error, fallback) {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
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

function updateBoardAccess(user) {
  const signedIn = Boolean(user);
  boardJoin.hidden = signedIn;
  postForm.hidden = !signedIn;

  if (!signedIn) {
    postForm.reset();
    setPostStatus("");
    return;
  }

  const displayName = user.user_metadata?.display_name;
  if (typeof displayName === "string" && !postName.value) {
    postName.value = displayName;
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

    const author = document.createElement("span");
    author.className = "guestbook-author";
    author.textContent = post.name;

    const time = document.createElement("time");
    time.className = "guestbook-time";
    time.dateTime = post.created_at;
    time.textContent = formatTime(post.created_at);

    const message = document.createElement("p");
    message.className = "guestbook-message";
    message.textContent = post.message;

    metadata.append(author, time);
    article.append(metadata, message);
    postList.append(article);
  }

  if (nearBottom) {
    postList.scrollTop = postList.scrollHeight;
  }
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
  postList.setAttribute("aria-busy", "true");
  try {
    const { data, error } = await supabase
      .from("posts")
      .select("id, name, message, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    for (const post of data) {
      messages.set(post.id, post);
    }
    trimOldPosts();
    renderPosts();
    boardNotice.textContent = "";
  } catch (error) {
    const emptyState = document.createElement("p");
    emptyState.className = "guestbook-empty";
    emptyState.textContent = "Messages aren’t available right now.";
    postList.replaceChildren(emptyState);
    boardNotice.textContent = `Could not load messages: ${getErrorMessage(error, "Please try again later.")}`;
  } finally {
    postList.setAttribute("aria-busy", "false");
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

  postSubmit.disabled = true;
  setPostStatus("Sending your message…");
  try {
    const { data, error } = await supabase
      .from("posts")
      .insert({
        name: postName.value.trim(),
        message: postMessage.value.trim(),
        user_id: currentUser.id,
      })
      .select("id, name, message, created_at")
      .single();

    if (error) {
      throw error;
    }

    addPost(data);
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

    updateBoardAccess(currentUser);
    supabase.auth.onAuthStateChange((_event, session) => {
      updateBoardAccess(session?.user ?? null);
    });

    supabase
      .channel("public-message-board")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        ({ new: post }) => addPost(post),
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
