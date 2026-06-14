// =============================================
// api.js - All API calls to our Express backend
// This keeps network code separate from UI code
// =============================================

const BASE_URL = "http://localhost:3000/api";

// Get the stored auth token
function getToken() {
  return localStorage.getItem("token");
}

// Headers with token for protected routes
function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

// Reusable fetch wrapper
async function apiFetch(endpoint, method = "GET", body = null) {
  const options = {
    method,
    headers: authHeaders(),
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(BASE_URL + endpoint, options);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }
  return data;
}

// ---- Auth ----
const api = {
  register: (username, email, password, bio) =>
    apiFetch("/register", "POST", { username, email, password, bio }),

  login: (username, password) =>
    apiFetch("/login", "POST", { username, password }),

  // ---- User ----
  getMe: () => apiFetch("/me"),
  updateBio: (bio) => apiFetch("/me", "PUT", { bio }),
  getUser: (username) => apiFetch(`/users/${username}`),
  searchUsers: (query) => apiFetch(`/search/users?q=${encodeURIComponent(query)}`),
  getUserPosts: (username) => apiFetch(`/users/${username}/posts`),
  getFollowers: (username) => apiFetch(`/users/${username}/followers`),
  getFollowing: (username) => apiFetch(`/users/${username}/following`),
  followUser: (username) => apiFetch(`/users/${username}/follow`, "POST"),

  // ---- Posts ----
  getFeed: () => apiFetch("/feed"),
  getAllPosts: () => apiFetch("/posts"),
  getPost: (postId) => apiFetch(`/posts/${postId}`),
  createPost: (content) => apiFetch("/posts", "POST", { content }),
  deletePost: (postId) => apiFetch(`/posts/${postId}`, "DELETE"),
  likePost: (postId) => apiFetch(`/posts/${postId}/like`, "POST"),

  // ---- Comments ----
  addComment: (postId, content) =>
    apiFetch(`/posts/${postId}/comments`, "POST", { content }),
  deleteComment: (commentId) =>
    apiFetch(`/comments/${commentId}`, "DELETE"),
};
