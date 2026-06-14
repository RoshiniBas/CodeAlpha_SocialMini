# 🌱 SocialMini — Mini Social Media App

A simple social media app built by a CS student using:
- **Backend:** Node.js + Express.js
- **Database:** lowdb (JSON file — no SQL setup needed!)
- **Frontend:** HTML + CSS + Vanilla JavaScript
- **Auth:** JWT tokens + bcrypt password hashing

---

## 📁 Project Structure

```
socialmini/
│
├── backend/
│   ├── server.js       ← All Express routes (API)
│   ├── db.json         ← Auto-created database file
│   └── package.json
│
└── frontend/
    ├── index.html      ← Single page app shell
    ├── css/
    │   └── style.css   ← All styles
    └── js/
        ├── api.js      ← API call helpers
        └── app.js      ← All UI logic
```

---

## 🚀 How to Run

### Step 1: Install dependencies
```bash
cd backend
npm install
```

### Step 2: Start the server
```bash
node server.js
```

### Step 3: Open the app
Open your browser and go to: **http://localhost:3000**

That's it! The frontend is served by Express itself.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Register / Login** | Create account, login with JWT authentication |
| **Create Posts** | Write posts (max 280 characters) |
| **Like Posts** | Like/unlike any post with a toggle |
| **Comments** | Click on a post to open it and add comments |
| **Follow / Unfollow** | Follow users, see a personalized feed |
| **User Profiles** | View any user's profile, posts, follower count |
| **Edit Bio** | Update your own bio from the profile page |
| **Search Users** | Search for users by username |
| **Explore** | See all posts from everyone |
| **Feed** | See posts only from people you follow |

---

## 🗃️ Database Tables (stored in db.json)

```
users    → { id, username, email, password(hashed), bio, avatar, createdAt }
posts    → { id, content, authorId, authorUsername, createdAt }
comments → { id, postId, content, authorId, authorUsername, createdAt }
likes    → { id, postId, userId, createdAt }
follows  → { id, followerId, followingId, createdAt }
```

---

## 🔒 API Routes

### Auth
- `POST /api/register` — Create account
- `POST /api/login`    — Login, get JWT token

### Users (requires login)
- `GET  /api/me`                          — Get your profile
- `PUT  /api/me`                          — Update your bio
- `GET  /api/users/:username`             — Get any user's profile
- `GET  /api/users/:username/posts`       — Get a user's posts
- `POST /api/users/:username/follow`      — Follow/unfollow toggle
- `GET  /api/search/users?q=query`        — Search users

### Posts (requires login)
- `GET  /api/feed`          — Personalized feed
- `GET  /api/posts`         — All posts (explore)
- `POST /api/posts`         — Create a post
- `GET  /api/posts/:id`     — Get post + comments
- `DELETE /api/posts/:id`   — Delete your post
- `POST /api/posts/:id/like` — Like/unlike toggle

### Comments (requires login)
- `POST   /api/posts/:id/comments`  — Add comment
- `DELETE /api/comments/:id`        — Delete your comment

---

## 💡 How JWT Auth Works (simple explanation)

1. User logs in → server creates a **token** (like a wristband)
2. Token is saved in **localStorage** on the browser
3. Every API request sends the token in the header
4. Server verifies the token before responding

---

## 🧠 Things You Could Improve Later

- Add image upload support
- Add notifications
- Add real-time updates with WebSockets
- Move to a real database (PostgreSQL / MongoDB)
- Add pagination for posts
- Deploy to a cloud server (Railway, Render, etc.)
