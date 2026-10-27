# Campus Voice 📢

> **Unified Institutional Announcement & Student Peer-to-Peer Q&A Portal**  
> *Designed for Government Engineering College*

[![Node.js](https://img.shields.io/badge/Node.js-16%2B-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![JavaScript](https://img.shields.io/badge/Vanilla_JS-ES6%2B-F7DF1E?style=flat&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-CDN-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![PDF.js](https://img.shields.io/badge/PDF.js-3.11.174-FF6F00?style=flat&logo=adobeacrobatreader&logoColor=white)](https://mozilla.github.io/pdf.js/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 📌 Overview

In collegiate engineering environments, official communications (exam timetables, placement drives, lab schedules, hackathon invitations) and academic problem-solving are frequently scattered across unstructured WhatsApp groups, informal Telegram chats, or physical pin boards.

**Campus Voice** provides a unified, web-based digital ecosystem integrating:
1. **Official Departmental Notice Board**: Faculty-published circulars with fine-grained branch targeting, category classification, single-vote popularity ranking, and in-browser PDF/image attachment previewing.
2. **Student Community Q&A**: A structured, StackOverflow/Reddit-style peer learning forum categorized into topics (*Placements, Exams, Projects, Academics, Hostel*), featuring verified faculty responses, accepted answer marks, anonymous asking, and community moderation.

---

## 🌟 Key Features

### 🏛️ Module 1: Departmental Notice Board
* **Audience / Branch Targeting**: Faculty can publish circulars targeted to **All Branches (College-wide)** or restricted specifically to selected departments (**CSE**, **AIML**, **ECE**, **ME**, **CV**).
* **Strict Feed Filtering**:
  * **🎯 My Branch**: Filters and displays circulars targeted specifically to the student's enrolled department.
  * **🌐 All Notices**: Displays college-wide announcements and campus broadsheets.
* **In-Website Document Viewer (PDF.js)**: High-resolution vector canvas preview of PDF circulars and images directly inside the portal with zoom in/out, page navigation, and download controls—without forcing external downloads.
* **Upvoting & Bookmarking**: Students can upvote important circulars (preventing duplicate votes) and save notices to a personal **★ Saved** reading list.
* **Live Search & Category Pills**: Real-time keyword filtering across titles, descriptions, and authors, combined with horizontal category filter chips (*Placements, Exams, Hackathons, Cultural, Sports*).

### 💬 Module 2: Student Community Q&A
* **Topic-Based Organization**: Peer inquiries segmented by topics: `Placements`, `Exams`, `Projects`, `Academics`, and `Hostel`.
* **Smart Sorting**:
  * **Newest**: Chronological feed with faculty-pinned questions pinned to the top.
  * **Most Upvoted**: Ranked by community vote score.
  * **Unanswered First**: Immediately prioritizes open questions with 0 answers so peers can assist.
* **Verified Faculty Badges**: Answers contributed by faculty members feature an official green `Faculty Verified` credential badge.
* **Accepted Answer Resolution**: Question authors can mark the best answer as **Accepted**, displaying a distinctive green highlight and verified checkmark.
* **Anonymous Asking**: Students can post sensitive inquiries anonymously to protect privacy while preserving academic integrity.
* **Community Moderation**: Students and faculty can flag inappropriate content. Items with 3+ flags are automatically highlighted for faculty review and moderation.

### 🛡️ Authentication & Role-Based Access Control (RBAC)
* **Student Authentication**:
  * Cryptographic session tokens (32 random bytes, hashed with SHA-256 in `data/sessions.json`).
  * 30-day session expiry with server-side validation (`/api/auth/me`).
  * USN validation matching Karnataka/VTU formats (e.g., `1GE22CS045`, `4GH24AI020`).
  * Automatic department detection from USN digits.
  * Password verification with timing-safe SHA-256 comparison.
* **Faculty Authentication (Institutional Allowlist & Single-Use OTP)**:
  * Strict institutional allowlist defined in `data/faculty.json`. Only designated faculty emails can request access.
  * Single-use 6-digit verification code with cryptographic salt & SHA-256 hash in `data/otps.json`.
  * 10-minute code expiry with automatic invalidation after 5 incorrect attempts.
  * Multi-tier rate limiting: 1 request/60s per email, 5 requests/hour per email, and 15 requests/10 min per IP.
  * Secure delivery via Nodemailer SMTP (e.g., Gmail/Outlook) or formatted terminal console log (`DEV_OTP_CONSOLE`).
  * Issues 8-hour cryptographic faculty session tokens. Name and department are pulled strictly from the server allowlist.
* **Granular Endpoint Protection**:
  * Notice publication, modification, and deletion are restricted strictly to faculty on the backend.
  * Document upload restricted to faculty with a 10 MB file cap, MIME validation, and path traversal defense.
  * CSS-driven role enforcement (`body.role-faculty .faculty-only` and `body.role-student .student-only`) for instantaneous client rendering.

### 🎨 Design System & Accessibility
* **Color Palette**: Tailored Indigo brand spectrum (`brand-50` to `brand-950`) with warm amber accents (`accent`), emerald success, and rose danger tokens.
* **Typography**: Clean hierarchy with Google Fonts (*Plus Jakarta Sans* and *Inter*).
* **Dark Mode Engine**: Instant dark theme with a zero-flash (FOUC) inline initializer in `<head>`, with persistent state stored in `localStorage.campusTheme`.
* **Micro-Interactions**: Hover elevation lifts, button press feedbacks (`.btn-press`), and upvote pop animations (`.upvote-pop`), respecting `prefers-reduced-motion`.

---

## 🏗️ Architecture & Data Flow

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (Browser)                          │
│                                                                        │
│   index.html ◄──────► app.js (State Machine) ◄──────► PDF.js 3.11.174  │
│   Tailwind CSS        Event Handlers & DOM            Canvas Renderer  │
│   style.css           XSS Sanitizer                                    │
│                             ▲                                          │
│                             │ Offline Cache / Session                  │
│                             ▼                                          │
│                  [localStorage / IndexedDB]                            │
└─────────────────────────────┬──────────────────────────────────────────┘
                              │
                              │ REST API JSON & Chunked Binary Stream
                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   BACKEND SERVER (Node.js - server.js)                 │
│                                                                        │
│   • Native http.createServer() (Zero external dependencies)            │
│   • REST Endpoints: /api/notices, /api/questions, /api/answers, etc.   │
│   • Streaming File Upload Handler (Buffer concats + MIME meta)         │
│   • Static File & PDF Delivery with CORS support                       │
└─────────────────────────────┬──────────────────────────────────────────┘
                              │
                              │ Atomic Read / Write Operations
                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA PERSISTENCE LAYER                          │
│                                                                        │
│   data/                                                                │
│     ├── notices.json       (Departmental circulars & audience rules)   │
│     ├── questions.json     (Community questions & metadata)            │
│     ├── answers.json       (Community peer & faculty responses)        │
│     ├── users.json         (Registered student accounts & SHA-256)     │
│     ├── categories.json    (Customizable notice categories)            │
│     └── uploads/           (Binary attachments & accompanying .meta)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ⚙️ REST API Reference

The backend provides a clean RESTful interface implemented on Node's native HTTP runtime:

| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/student/login` | Public | Authenticate student by USN & password; returns 30-day session token |
| `POST` | `/api/auth/faculty/request-otp` | Public (Rate Limited) | Send single-use 6-digit code to allowlisted faculty email |
| `POST` | `/api/auth/faculty/verify-otp` | Public (Rate Limited) | Verify OTP code; returns 8-hour faculty session token |
| `GET` | `/api/auth/me` | Bearer Token | Validate current session and retrieve verified role details |
| `POST` | `/api/auth/logout` | Bearer Token | Invalidate and purge session token |
| `GET` | `/api/notices` | Public | Retrieve official departmental announcements |
| `POST` | `/api/notices` | Faculty Only | Publish, edit, delete circulars, or record user upvotes |
| `GET` | `/api/categories` | Public | Retrieve list of active notice categories |
| `POST` | `/api/categories` | Faculty Only | Create a new notice category |
| `GET` | `/api/questions` | Public | Fetch all Community Q&A questions |
| `POST` | `/api/questions` | Student / Faculty | Ask question, upvote, delete (author/faculty), or pin (faculty) |
| `GET` | `/api/answers` | Public | Fetch all community answers |
| `POST` | `/api/answers` | Student / Faculty | Post answer, upvote, or delete |
| `GET` | `/api/users` | Public | Fetch student registry (passwords stripped) |
| `POST` | `/api/users` | Public | Register a new student account (enforced `role: student`) |
| `GET` | `/api/files/:id` | Public | Stream attachment with MIME headers & path traversal defense |
| `POST` | `/api/files/:id` | Faculty Only | Upload attachment (10 MB cap, MIME validation) |
| `DELETE` | `/api/files/:id` | Faculty Only | Delete notice attachment from disk |

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v16.0.0 or higher) installed on your system.

### Installation & Local Run

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Linet2006/Campus-Voice.git
   cd Campus-Voice
   ```

2. **Start the application**:
   ```bash
   node server.js
   ```
   *(Alternatively: `npm start`)*

3. **Open in browser**:
   Navigate to:
   ```text
   http://localhost:3000
   ```

### 📱 Testing Across Multiple Devices on Local Wi-Fi
Because the backend listens on `0.0.0.0` with standard CORS headers, any smartphone, tablet, or laptop on the **same Wi-Fi network** can open the app simultaneously:
```text
http://<YOUR_LOCAL_IP>:3000
```
*(Find your local IP by running `ipconfig` on Windows or `ifconfig` on macOS/Linux).*

---

## 🔐 Demo Credentials & Faculty Allowlist

### 1. Student Access
* **Registered Demo USN**: `1GE22CS045`
* **Password**: `student123`
* *Or register any new student account using your USN and email.*

### 2. Faculty Access (Allowlist + Single-Use OTP)
Enter an allowlisted institutional email address on the Faculty card:
* `ramesh.cse@gec.edu` (Dr. Ramesh, CSE Dept)
* `faculty@gec.edu` (Prof. S. Sharma, ECE Dept)

Click **Send Verification Code →**. In development mode, the 6-digit code is immediately output to your terminal/console:
```text
============================================================
 [DEMO MODE / DEV_OTP_CONSOLE] FACULTY OTP GENERATED
 To: Dr. Ramesh (CSE Dept) <ramesh.cse@gec.edu>
 One-Time Verification Code:  >>>  626828  <<<
 Valid for: 10 minutes | Single-use only
============================================================
```
Enter the 6-digit code and click **Verify & Sign In →** to unlock full administrative privileges.

---

## ⚙️ Environment Variables & Live SMTP Setup

Configure the following environment variables (via `.env` or your hosting dashboard like Render/Railway):

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port on which the HTTP server listens (`0.0.0.0`) |
| `DEV_OTP_CONSOLE` | `true` | When `true`, prints OTP verification codes directly to the server terminal |
| `SMTP_HOST` | *(none)* | Live SMTP server hostname (e.g., `smtp.gmail.com` or `smtp-mail.outlook.com`) |
| `SMTP_PORT` | `587` | SMTP port (e.g., `587` for STARTTLS or `465` for SSL) |
| `SMTP_USER` | *(none)* | SMTP username / institutional email |
| `SMTP_PASS` | *(none)* | SMTP password or Google App Password |
| `MAIL_FROM` | `"Campus Voice GEC" <noreply@gec.edu>` | Display name and sender address on verification emails |

> **Faculty Allowlist Management**:  
> To add or modify faculty members, edit `data/faculty.json`. Each entry defines:
> ```json
> {
>   "email": "professor@gec.edu",
>   "name": "Prof. Jane Doe",
>   "department": "Computer Science & Engineering",
>   "active": true
> }
> ```

---

## ☁️ Deployment Guide

### Deploying to Render (100% Free)
1. Fork or push this repository to your GitHub account.
2. Sign in to [Render.com](https://render.com) and click **New +** → **Web Service**.
3. Select your repository: `Linet2006/Campus-Voice`.
4. Configure:
   * **Environment**: `Node`
   * **Build Command**: *(leave blank)*
   * **Start Command**: `npm start`
   * **Plan**: `Free`
5. Click **Deploy Web Service**. You will receive an instantaneous public URL with free SSL:  
   `https://campus-voice.onrender.com`

---

## 📂 Project Directory Structure

```text
CampusVoice/
├── index.html                           # Main semantic single-page application entry point
├── style.css                            # Core design system, CSS variables, RBAC rules & animations
├── app.js                               # State machine, DOM renderer, CommunityData & PDF.js bindings
├── server.js                            # Native Node.js HTTP server, REST router & file uploader
├── package.json                         # Cloud platform manifest & start command
├── Campus_Voice_Technical_Documentation.html  # Comprehensive technical viva/interview reference
├── Campus_Voice_Technical_Documentation.pdf   # Formatted downloadable PDF documentation
├── data/
│   ├── notices.json                     # Departmental notices dataset
│   ├── questions.json                   # Community Q&A questions dataset
│   ├── answers.json                     # Community Q&A answers dataset
│   ├── users.json                       # Registered student credentials (SHA-256)
│   ├── categories.json                  # Notice categories list
│   └── uploads/                         # Stored binary PDF and image attachments
│       └── .gitkeep
└── README.md                            # Project documentation
```

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
