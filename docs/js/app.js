// =============================================
// app.js - Frontend Logic for SocialMini
// Controls all UI: auth, feed, profile, etc.
// =============================================

// Current logged-in user info stored here
let currentUser = null;

// ---- On page load ----
window.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (token) {
    // User was already logged in, load the app
    initApp();
  } else {
    showAuthScreen();
  }

  // Character counter for post textarea
  const postTextarea = document.getElementById("post-content");
  if (postTextarea) {
    postTextarea.addEventListener("input", () => {
      const count = postTextarea.value.length;
      document.getElementById("char-count").textContent = `${count}/280`;
    });
  }
});

// ============================
// AUTH FUNCTIONS
// ============================

function showAuthScreen() {
  document.getElementById("auth-screen").style.display = "flex";
  document.getElementById("app-screen").style.display = "none";
}

function showAppScreen() {
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app-screen").style.display = "grid";
}

function showTab(tab) {
  const tabs = ["login", "register"];
  tabs.forEach((t) => {
    document.getElementById(`${t}-tab`).style.display = t === tab ? "block" : "none";
  });
  document.querySelectorAll(".tab-btn").forEach((btn, i) => {
    btn.classList.toggle("active", (i === 0 && tab === "login") || (i === 1 && tab === "register"));
  });
}

async function login() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  errorEl.textContent = "";

  if (!username || !password) {
    errorEl.textContent = "Please fill in all fields!";
    return;
  }

  try {
    const data = await api.login(username, password);
    localStorage.setItem("token", data.token);
    localStorage.setItem("userId", data.user.id);
    initApp();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

async function register() {
  const username = document.getElementById("reg-username").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const bio = document.getElementById("reg-bio").value.trim();
  const errorEl = document.getElementById("register-error");
  errorEl.textContent = "";

  if (!username || !email || !password) {
    errorEl.textContent = "Username, email and password are required!";
    return;
  }

  try {
    await api.register(username, email, password, bio);
    showToast("Account created! Please login.");
    showTab("login");
    document.getElementById("login-username").value = username;
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("userId");
  currentUser = null;
  showAuthScreen();
}

// ============================
// APP INITIALIZATION
// ============================

async function initApp() {
  try {
    currentUser = await api.getMe();
    showAppScreen();
    renderSidebarUser();
    loadSuggestions();
    navigate("feed");
  } catch (err) {
    // Token might be expired
    logout();
  }
}

// ============================
// NAVIGATION
// ============================

function navigate(page, username = null) {
  // Hide all pages
  document.querySelectorAll(".page").forEach((p) => (p.style.display = "none"));

  // Reset nav button styles
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));

  if (page === "feed") {
    document.getElementById("page-feed").style.display = "block";
    document.getElementById("nav-feed").classList.add("active");
    document.getElementById("feed-avatar").src = currentUser.avatar;
    loadFeed();
  } else if (page === "explore") {
    document.getElementById("page-explore").style.display = "block";
    document.getElementById("nav-explore").classList.add("active");
    loadExplore();
  } else if (page === "profile") {
    document.getElementById("page-profile").style.display = "block";
    document.getElementById("nav-profile").classList.add("active");
    loadProfile(username || currentUser.username);
  }
}

// ============================
// FEED PAGE
// ============================

async function loadFeed() {
  const container = document.getElementById("feed-posts");
  container.innerHTML = '<p class="loading-msg">Loading your feed...</p>';

  try {
    const posts = await api.getFeed();
    if (posts.length === 0) {
      container.innerHTML = `<p class="empty-msg">No posts yet! Follow people or create your first post 🌱</p>`;
      return;
    }
    container.innerHTML = posts.map((p) => renderPostCard(p)).join("");
  } catch (err) {
    container.innerHTML = `<p class="empty-msg">Failed to load feed. ${err.message}</p>`;
  }
}

async function createPost() {
  const textarea = document.getElementById("post-content");
  const content = textarea.value.trim();

  if (!content) {
    showToast("Write something first!");
    return;
  }

  try {
    await api.createPost(content);
    textarea.value = "";
    document.getElementById("char-count").textContent = "0/280";
    showToast("Post created! 🎉");
    loadFeed();
  } catch (err) {
    showToast(err.message);
  }
}

// ============================
// EXPLORE PAGE
// ============================

async function loadExplore() {
  const container = document.getElementById("explore-posts");
  container.innerHTML = '<p class="loading-msg">Loading posts...</p>';

  try {
    const posts = await api.getAllPosts();
    if (posts.length === 0) {
      container.innerHTML = `<p class="empty-msg">No posts yet. Be the first! ✨</p>`;
      return;
    }
    container.innerHTML = posts.map((p) => renderPostCard(p)).join("");
  } catch (err) {
    container.innerHTML = `<p class="empty-msg">Error: ${err.message}</p>`;
  }
}

let searchTimeout = null;
async function searchUsers() {
  const query = document.getElementById("search-input").value.trim();
  const container = document.getElementById("search-results");

  if (!query) {
    container.innerHTML = "";
    return;
  }

  // Debounce: wait 300ms after user stops typing
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    try {
      const users = await api.searchUsers(query);
      if (users.length === 0) {
        container.innerHTML = `<p class="empty-msg" style="padding:10px">No users found.</p>`;
        return;
      }
      container.innerHTML = users.map((u) => renderUserItem(u)).join("");
    } catch (err) {
      container.innerHTML = `<p class="empty-msg">Search failed.</p>`;
    }
  }, 300);
}

// ============================
// PROFILE PAGE
// ============================

async function loadProfile(username) {
  const container = document.getElementById("profile-content");
  container.innerHTML = '<p class="loading-msg">Loading profile...</p>';

  try {
    const user = await api.getUser(username);
    const posts = await api.getUserPosts(username);
    const isMe = user.isMe;

    let followBtnHtml = "";
    if (!isMe) {
      const btnClass = user.isFollowing ? "follow-btn following" : "follow-btn not-following";
      const btnText = user.isFollowing ? "Following" : "Follow";
      followBtnHtml = `<button class="${btnClass}" onclick="toggleFollow('${user.username}', this)">${btnText}</button>`;
    }

    let editBioHtml = "";
    if (isMe) {
      editBioHtml = `
        <div class="edit-bio-form" style="margin-top:12px">
          <input type="text" id="bio-input" value="${user.bio}" placeholder="Your bio" maxlength="100" />
          <button class="btn btn-primary" onclick="saveBio()">Save</button>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="profile-header">
        <div class="profile-top">
          <img src="${user.avatar}" alt="avatar" class="avatar-lg" />
          <div class="profile-info">
            <h2>@${user.username}</h2>
            <p class="profile-bio">${user.bio || "No bio yet."}</p>
            ${followBtnHtml}
          </div>
        </div>
        <div class="profile-stats">
          <div class="stat">
            <strong>${user.postCount}</strong>
            <span>Posts</span>
          </div>
          <div class="stat">
            <strong>${user.followerCount}</strong>
            <span>Followers</span>
          </div>
          <div class="stat">
            <strong>${user.followingCount}</strong>
            <span>Following</span>
          </div>
        </div>
        ${editBioHtml}
      </div>

      <h3 class="section-title">Posts</h3>
      <div class="posts-list">
        ${posts.length === 0
          ? `<p class="empty-msg">No posts yet.</p>`
          : posts.map((p) => renderPostCard(p)).join("")}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="empty-msg">Failed to load profile. ${err.message}</p>`;
  }
}

async function saveBio() {
  const bio = document.getElementById("bio-input").value.trim();
  try {
    await api.updateBio(bio);
    currentUser.bio = bio;
    showToast("Bio updated! ✅");
    renderSidebarUser();
    loadProfile(currentUser.username);
  } catch (err) {
    showToast(err.message);
  }
}

// ============================
// FOLLOW / LIKE ACTIONS
// ============================

async function toggleFollow(username, btn) {
  try {
    const result = await api.followUser(username);
    if (result.following) {
      btn.className = "follow-btn following";
      btn.textContent = "Following";
    } else {
      btn.className = "follow-btn not-following";
      btn.textContent = "Follow";
    }
    showToast(result.message);
    // Refresh sidebar suggestions
    loadSuggestions();
  } catch (err) {
    showToast(err.message);
  }
}

async function toggleLike(postId, btn) {
  try {
    const result = await api.likePost(postId);
    const card = btn.closest(".post-card, .modal-box");
    const likeCountEl = card.querySelector(`[data-like-count="${postId}"]`);

    if (result.liked) {
      btn.classList.add("liked");
      btn.querySelector(".like-icon").textContent = "❤️";
      if (likeCountEl) likeCountEl.textContent = parseInt(likeCountEl.textContent) + 1;
    } else {
      btn.classList.remove("liked");
      btn.querySelector(".like-icon").textContent = "🤍";
      if (likeCountEl) likeCountEl.textContent = parseInt(likeCountEl.textContent) - 1;
    }
  } catch (err) {
    showToast(err.message);
  }
}

async function deletePost(postId) {
  if (!confirm("Delete this post?")) return;
  try {
    await api.deletePost(postId);
    showToast("Post deleted.");
    // Reload current page
    const feedVisible = document.getElementById("page-feed").style.display !== "none";
    const exploreVisible = document.getElementById("page-explore").style.display !== "none";
    const profileVisible = document.getElementById("page-profile").style.display !== "none";

    if (feedVisible) loadFeed();
    if (exploreVisible) loadExplore();
    if (profileVisible) loadProfile(currentUser.username);
  } catch (err) {
    showToast(err.message);
  }
}

// ============================
// POST DETAIL MODAL
// ============================

async function openPostModal(postId) {
  const modal = document.getElementById("post-modal");
  const content = document.getElementById("modal-content");
  modal.style.display = "flex";
  content.innerHTML = '<p class="loading-msg">Loading...</p>';

  try {
    const post = await api.getPost(postId);

    const isOwner = post.authorId === currentUser.id;
    const isLiked = post.userLiked;

    content.innerHTML = `
      <div class="post-header">
        <img src="${post.authorAvatar}" class="avatar-sm" alt="avatar" />
        <div class="post-meta">
          <span class="post-author" onclick="goToProfile('${post.authorUsername}')">${post.authorUsername}</span>
          <span class="post-time">${formatTime(post.createdAt)}</span>
        </div>
        ${isOwner ? `<button class="delete-btn-post" onclick="deletePost('${post.id}'); closePostModal()">🗑️</button>` : ""}
      </div>
      <p class="post-content">${escapeHtml(post.content)}</p>
      <div class="post-footer">
        <button class="action-btn ${isLiked ? "liked" : ""}" onclick="toggleLike('${post.id}', this)">
          <span class="like-icon">${isLiked ? "❤️" : "🤍"}</span>
          <span data-like-count="${post.id}">${post.likeCount}</span>
        </button>
      </div>

      <div class="comments-section">
        <h4>Comments (${post.comments.length})</h4>
        <div id="modal-comments">
          ${post.comments.length === 0
            ? '<p class="empty-msg" style="padding:10px 0">No comments yet. Be the first!</p>'
            : post.comments.map((c) => renderComment(c)).join("")}
        </div>
        <div class="add-comment-row">
          <img src="${currentUser.avatar}" class="avatar-sm" alt="avatar" />
          <input type="text" id="comment-input-${post.id}" placeholder="Add a comment..." 
            onkeydown="if(event.key==='Enter') submitComment('${post.id}')" />
          <button class="btn btn-primary" onclick="submitComment('${post.id}')">Send</button>
        </div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<p class="empty-msg">Failed to load post. ${err.message}</p>`;
  }
}

async function submitComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  const content = input.value.trim();
  if (!content) return;

  try {
    const comment = await api.addComment(postId, content);
    input.value = "";
    const commentsContainer = document.getElementById("modal-comments");
    const emptyMsg = commentsContainer.querySelector(".empty-msg");
    if (emptyMsg) emptyMsg.remove();
    commentsContainer.insertAdjacentHTML("beforeend", renderComment(comment));
  } catch (err) {
    showToast(err.message);
  }
}

async function deleteComment(commentId, el) {
  if (!confirm("Delete comment?")) return;
  try {
    await api.deleteComment(commentId);
    el.closest(".comment-item").remove();
    showToast("Comment deleted.");
  } catch (err) {
    showToast(err.message);
  }
}

function closePostModal() {
  document.getElementById("post-modal").style.display = "none";
}

function closeModal(event) {
  if (event.target === document.getElementById("post-modal")) {
    closePostModal();
  }
}

// ============================
// SIDEBAR
// ============================

function renderSidebarUser() {
  const card = document.getElementById("sidebar-user-card");
  card.innerHTML = `
    <div class="user-card-inner">
      <img src="${currentUser.avatar}" class="avatar-sm" alt="avatar" />
      <div class="user-card-info">
        <strong>@${currentUser.username}</strong>
        <span>${currentUser.bio || "No bio yet"}</span>
      </div>
    </div>
  `;
}

async function loadSuggestions() {
  const container = document.getElementById("suggestions-list");

  try {
    // Get all users and filter out people we already follow and ourselves
    const allUsers = await api.searchUsers("");
    const filtered = allUsers
      .filter((u) => u.id !== currentUser.id)
      .slice(0, 5);

    if (filtered.length === 0) {
      container.innerHTML = `<p style="font-size:13px;color:var(--text-muted)">No suggestions right now.</p>`;
      return;
    }

    container.innerHTML = filtered
      .map(
        (u) => `
      <div class="suggestion-item">
        <img src="${u.avatar}" class="avatar-sm" alt="avatar" style="width:32px;height:32px;" />
        <span class="suggestion-name" onclick="goToProfile('${u.username}')">${u.username}</span>
        <button class="suggestion-follow-btn" onclick="quickFollow('${u.username}', this)">Follow</button>
      </div>
    `
      )
      .join("");
  } catch (err) {
    container.innerHTML = `<p style="font-size:13px;color:var(--text-muted)">Could not load suggestions.</p>`;
  }
}

async function quickFollow(username, btn) {
  try {
    const result = await api.followUser(username);
    btn.textContent = result.following ? "Following ✓" : "Follow";
    btn.disabled = result.following;
    showToast(result.message);
  } catch (err) {
    showToast(err.message);
  }
}

// ============================
// HELPER / RENDER FUNCTIONS
// ============================

function renderPostCard(post) {
  const isOwner = post.authorId === currentUser.id;
  const isLiked = post.userLiked;

  return `
    <div class="post-card" data-post-id="${post.id}">
      <div class="post-header">
        <img src="${post.authorAvatar}" class="avatar-sm" alt="avatar" />
        <div class="post-meta">
          <span class="post-author" onclick="goToProfile('${post.authorUsername}')">${post.authorUsername}</span>
          <div class="post-time">${formatTime(post.createdAt)}</div>
        </div>
        ${isOwner ? `<button class="delete-btn-post" onclick="deletePost('${post.id}')">🗑️</button>` : ""}
      </div>
      <p class="post-content">${escapeHtml(post.content)}</p>
      <div class="post-footer">
        <button class="action-btn ${isLiked ? "liked" : ""}" onclick="toggleLike('${post.id}', this)">
          <span class="like-icon">${isLiked ? "❤️" : "🤍"}</span>
          <span data-like-count="${post.id}">${post.likeCount}</span> Likes
        </button>
        <button class="action-btn" onclick="openPostModal('${post.id}')">
          💬 ${post.commentCount} Comments
        </button>
      </div>
    </div>
  `;
}

function renderComment(comment) {
  const isOwner = comment.authorId === currentUser.id;
  return `
    <div class="comment-item" data-comment-id="${comment.id}">
      <img src="${comment.authorAvatar}" class="avatar-sm" alt="avatar" />
      <div class="comment-body">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="comment-author" onclick="goToProfile('${comment.authorUsername}')">${comment.authorUsername}</span>
          <span style="font-size:11px;color:var(--text-muted)">${formatTime(comment.createdAt)}</span>
          ${isOwner ? `<button class="comment-delete-btn" onclick="deleteComment('${comment.id}', this)">🗑️</button>` : ""}
        </div>
        <p class="comment-text">${escapeHtml(comment.content)}</p>
      </div>
    </div>
  `;
}

function renderUserItem(user) {
  return `
    <div class="user-item">
      <img src="${user.avatar}" class="avatar-sm" alt="avatar" />
      <div class="user-item-info">
        <div class="user-item-name" onclick="goToProfile('${user.username}')">${user.username}</div>
        <div class="user-item-bio">${user.bio || "No bio"}</div>
      </div>
      <button class="btn btn-outline" onclick="goToProfile('${user.username}')" style="font-size:12px;padding:6px 12px">View</button>
    </div>
  `;
}

function goToProfile(username) {
  closePostModal(); // Close modal if open
  navigate("profile", username);
  // Update nav highlight if it's our own profile
  if (username === currentUser.username) {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    document.getElementById("nav-profile").classList.add("active");
  }
}

// ============================
// UTILITIES
// ============================

function showToast(msg, duration = 2500) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, duration);
}

function formatTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000); // seconds

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function escapeHtml(text) {
  // Prevent XSS by escaping HTML characters
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
