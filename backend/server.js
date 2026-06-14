// ============================================
// SocialMini - Backend Server
// Built with Express.js + lowdb (JSON database)
// A simple social media app by a CS student
// ============================================

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { Low } = require("lowdb");
const { JSONFileSync } = require("lowdb/node");
const path = require("path");

const app = express();
const PORT = 3000;
const SECRET_KEY = "mysecretkey123"; // In real apps, use env variables!

// ---- Setup Database ----
const dbFile = path.join(__dirname, "db.json");
const adapter = new JSONFileSync(dbFile);
const db = new Low(adapter, {
  users: [],
  posts: [],
  comments: [],
  likes: [],
  follows: [],
});
db.read();

// ---- Middleware ----
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// ---- Helper: Check if user is logged in ----
function checkAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "Please login first" });

  const token = authHeader.split(" ")[1]; // Format: "Bearer <token>"
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ==========================================
// AUTH ROUTES
// ==========================================

// Register a new user
app.post("/api/register", async (req, res) => {
  const { username, email, password, bio } = req.body;

  // Check if username already taken
  const existingUser = db.data.users.find((u) => u.username === username || u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: "Username or email already taken!" });
  }

  // Hash the password before saving
  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = {
    id: uuidv4(),
    username,
    email,
    password: hashedPassword,
    bio: bio || "Hey there! I am using SocialMini.",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
    createdAt: new Date().toISOString(),
  };

  db.data.users.push(newUser);
  db.write();

  res.status(201).json({ message: "Account created successfully!" });
});

// Login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  const user = db.data.users.find((u) => u.username === username);
  if (!user) return res.status(400).json({ error: "User not found!" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ error: "Wrong password!" });

  // Create a token that expires in 7 days
  const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: "7d" });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      bio: user.bio,
      avatar: user.avatar,
    },
  });
});

// ==========================================
// USER ROUTES
// ==========================================

// Get current logged-in user profile
app.get("/api/me", checkAuth, (req, res) => {
  const user = db.data.users.find((u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const followerCount = db.data.follows.filter((f) => f.followingId === user.id).length;
  const followingCount = db.data.follows.filter((f) => f.followerId === user.id).length;
  const postCount = db.data.posts.filter((p) => p.authorId === user.id).length;

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    bio: user.bio,
    avatar: user.avatar,
    followerCount,
    followingCount,
    postCount,
  });
});

// Get any user's profile by username
app.get("/api/users/:username", checkAuth, (req, res) => {
  const user = db.data.users.find((u) => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: "User not found" });

  const followerCount = db.data.follows.filter((f) => f.followingId === user.id).length;
  const followingCount = db.data.follows.filter((f) => f.followerId === user.id).length;
  const postCount = db.data.posts.filter((p) => p.authorId === user.id).length;
  const isFollowing = db.data.follows.some(
    (f) => f.followerId === req.userId && f.followingId === user.id
  );

  res.json({
    id: user.id,
    username: user.username,
    bio: user.bio,
    avatar: user.avatar,
    followerCount,
    followingCount,
    postCount,
    isFollowing,
    isMe: user.id === req.userId,
  });
});

// Update profile
app.put("/api/me", checkAuth, (req, res) => {
  const { bio } = req.body;
  const userIndex = db.data.users.findIndex((u) => u.id === req.userId);
  if (userIndex === -1) return res.status(404).json({ error: "User not found" });

  db.data.users[userIndex].bio = bio;
  db.write();

  res.json({ message: "Profile updated!" });
});

// Search users
app.get("/api/search/users", checkAuth, (req, res) => {
  const query = req.query.q?.toLowerCase() || "";
  const results = db.data.users
    .filter((u) => u.username.toLowerCase().includes(query))
    .slice(0, 10)
    .map((u) => ({ id: u.id, username: u.username, avatar: u.avatar, bio: u.bio }));

  res.json(results);
});

// ==========================================
// POST ROUTES
// ==========================================

// Create a post
app.post("/api/posts", checkAuth, (req, res) => {
  const { content } = req.body;
  if (!content || content.trim() === "") {
    return res.status(400).json({ error: "Post cannot be empty!" });
  }

  const user = db.data.users.find((u) => u.id === req.userId);

  const newPost = {
    id: uuidv4(),
    content: content.trim(),
    authorId: req.userId,
    authorUsername: user.username,
    authorAvatar: user.avatar,
    createdAt: new Date().toISOString(),
  };

  db.data.posts.unshift(newPost); // Add at the beginning
  db.write();

  res.status(201).json(newPost);
});

// Get feed (posts from people you follow + your own)
app.get("/api/feed", checkAuth, (req, res) => {
  const followingIds = db.data.follows
    .filter((f) => f.followerId === req.userId)
    .map((f) => f.followingId);

  followingIds.push(req.userId); // Also include your own posts

  const feedPosts = db.data.posts
    .filter((p) => followingIds.includes(p.authorId))
    .map((post) => {
      const likeCount = db.data.likes.filter((l) => l.postId === post.id).length;
      const commentCount = db.data.comments.filter((c) => c.postId === post.id).length;
      const userLiked = db.data.likes.some((l) => l.postId === post.id && l.userId === req.userId);
      return { ...post, likeCount, commentCount, userLiked };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json(feedPosts);
});

// Get explore feed (all posts)
app.get("/api/posts", checkAuth, (req, res) => {
  const allPosts = db.data.posts.map((post) => {
    const likeCount = db.data.likes.filter((l) => l.postId === post.id).length;
    const commentCount = db.data.comments.filter((c) => c.postId === post.id).length;
    const userLiked = db.data.likes.some((l) => l.postId === post.id && l.userId === req.userId);
    return { ...post, likeCount, commentCount, userLiked };
  });

  res.json(allPosts);
});

// Get a single post with comments
app.get("/api/posts/:postId", checkAuth, (req, res) => {
  const post = db.data.posts.find((p) => p.id === req.params.postId);
  if (!post) return res.status(404).json({ error: "Post not found" });

  const likeCount = db.data.likes.filter((l) => l.postId === post.id).length;
  const userLiked = db.data.likes.some((l) => l.postId === post.id && l.userId === req.userId);
  const comments = db.data.comments
    .filter((c) => c.postId === post.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  res.json({ ...post, likeCount, userLiked, comments });
});

// Get posts by a specific user
app.get("/api/users/:username/posts", checkAuth, (req, res) => {
  const user = db.data.users.find((u) => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: "User not found" });

  const userPosts = db.data.posts
    .filter((p) => p.authorId === user.id)
    .map((post) => {
      const likeCount = db.data.likes.filter((l) => l.postId === post.id).length;
      const commentCount = db.data.comments.filter((c) => c.postId === post.id).length;
      const userLiked = db.data.likes.some(
        (l) => l.postId === post.id && l.userId === req.userId
      );
      return { ...post, likeCount, commentCount, userLiked };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json(userPosts);
});

// Delete a post
app.delete("/api/posts/:postId", checkAuth, (req, res) => {
  const postIndex = db.data.posts.findIndex(
    (p) => p.id === req.params.postId && p.authorId === req.userId
  );
  if (postIndex === -1) return res.status(404).json({ error: "Post not found or not yours" });

  db.data.posts.splice(postIndex, 1);
  // Also delete related likes and comments
  db.data.likes = db.data.likes.filter((l) => l.postId !== req.params.postId);
  db.data.comments = db.data.comments.filter((c) => c.postId !== req.params.postId);
  db.write();

  res.json({ message: "Post deleted!" });
});

// ==========================================
// COMMENT ROUTES
// ==========================================

// Add a comment
app.post("/api/posts/:postId/comments", checkAuth, (req, res) => {
  const { content } = req.body;
  if (!content || content.trim() === "") {
    return res.status(400).json({ error: "Comment cannot be empty!" });
  }

  const post = db.data.posts.find((p) => p.id === req.params.postId);
  if (!post) return res.status(404).json({ error: "Post not found" });

  const user = db.data.users.find((u) => u.id === req.userId);

  const newComment = {
    id: uuidv4(),
    postId: req.params.postId,
    content: content.trim(),
    authorId: req.userId,
    authorUsername: user.username,
    authorAvatar: user.avatar,
    createdAt: new Date().toISOString(),
  };

  db.data.comments.push(newComment);
  db.write();

  res.status(201).json(newComment);
});

// Delete a comment
app.delete("/api/comments/:commentId", checkAuth, (req, res) => {
  const commentIndex = db.data.comments.findIndex(
    (c) => c.id === req.params.commentId && c.authorId === req.userId
  );
  if (commentIndex === -1)
    return res.status(404).json({ error: "Comment not found or not yours" });

  db.data.comments.splice(commentIndex, 1);
  db.write();

  res.json({ message: "Comment deleted!" });
});

// ==========================================
// LIKE ROUTES
// ==========================================

// Like or unlike a post (toggle)
app.post("/api/posts/:postId/like", checkAuth, (req, res) => {
  const post = db.data.posts.find((p) => p.id === req.params.postId);
  if (!post) return res.status(404).json({ error: "Post not found" });

  const existingLike = db.data.likes.findIndex(
    (l) => l.postId === req.params.postId && l.userId === req.userId
  );

  if (existingLike !== -1) {
    // Already liked → unlike it
    db.data.likes.splice(existingLike, 1);
    db.write();
    return res.json({ liked: false, message: "Unliked!" });
  } else {
    // Not liked → like it
    db.data.likes.push({
      id: uuidv4(),
      postId: req.params.postId,
      userId: req.userId,
      createdAt: new Date().toISOString(),
    });
    db.write();
    return res.json({ liked: true, message: "Liked!" });
  }
});

// ==========================================
// FOLLOW ROUTES
// ==========================================

// Follow or unfollow a user (toggle)
app.post("/api/users/:username/follow", checkAuth, (req, res) => {
  const userToFollow = db.data.users.find((u) => u.username === req.params.username);
  if (!userToFollow) return res.status(404).json({ error: "User not found" });
  if (userToFollow.id === req.userId) {
    return res.status(400).json({ error: "You can't follow yourself!" });
  }

  const existingFollow = db.data.follows.findIndex(
    (f) => f.followerId === req.userId && f.followingId === userToFollow.id
  );

  if (existingFollow !== -1) {
    // Already following → unfollow
    db.data.follows.splice(existingFollow, 1);
    db.write();
    return res.json({ following: false, message: `Unfollowed ${userToFollow.username}` });
  } else {
    // Not following → follow
    db.data.follows.push({
      id: uuidv4(),
      followerId: req.userId,
      followingId: userToFollow.id,
      createdAt: new Date().toISOString(),
    });
    db.write();
    return res.json({ following: true, message: `Now following ${userToFollow.username}!` });
  }
});

// Get followers of a user
app.get("/api/users/:username/followers", checkAuth, (req, res) => {
  const user = db.data.users.find((u) => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: "User not found" });

  const followerIds = db.data.follows
    .filter((f) => f.followingId === user.id)
    .map((f) => f.followerId);

  const followers = db.data.users
    .filter((u) => followerIds.includes(u.id))
    .map((u) => ({ id: u.id, username: u.username, avatar: u.avatar, bio: u.bio }));

  res.json(followers);
});

// Get people a user is following
app.get("/api/users/:username/following", checkAuth, (req, res) => {
  const user = db.data.users.find((u) => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: "User not found" });

  const followingIds = db.data.follows
    .filter((f) => f.followerId === user.id)
    .map((f) => f.followingId);

  const following = db.data.users
    .filter((u) => followingIds.includes(u.id))
    .map((u) => ({ id: u.id, username: u.username, avatar: u.avatar, bio: u.bio }));

  res.json(following);
});

// ==========================================
// Serve Frontend
// ==========================================
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Start the server!
app.listen(PORT, () => {
  console.log(`✅ SocialMini server running at http://localhost:${PORT}`);
  console.log(`📁 Database stored in: ${dbFile}`);
});
