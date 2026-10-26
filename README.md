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
  * Persistent sessions stored in `localStorage` (`campusSession`).
  * USN validation matching Karnataka/VTU formats (e.g., `1GE22CS045`, `4GH24AI020`).
  * Automatic department auto-detection from USN digits.
  * Client-side cryptographic password hashing via `SubtleCrypto` (SHA-256).
* **Faculty Authentication**:
  * Protected via department passcodes (`faculty123`).
  * Unlocks administrative controls: Post Notice, Edit/Delete Circulars, Add New Category, Pin Question, Moderate Content.
* **CSS-Driven Privilege Enforcement**:
  Role visibility is enforced natively by the browser CSS rendering engine (`body.role-faculty .faculty-only` and `body.role-student .student-only`), guaranteeing instant reflow with zero JavaScript DOM query overhead.

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

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/notices` | Retrieve all official departmental announcements |
| `POST` | `/api/notices` | Publish or update a notice (atomic JSON commit) |
| `GET` | `/api/categories` | Retrieve list of active notice categories |
| `POST` | `/api/categories` | Create a new notice category (Faculty only) |
| `GET` | `/api/questions` | Fetch all Community Q&A questions |
| `POST` | `/api/questions` | Submit a new question or update status/upvotes |
| `GET` | `/api/answers` | Fetch all community answers |
| `POST` | `/api/answers` | Submit a peer/faculty response or upvote |
| `GET` | `/api/users` | Fetch registered student registry |
| `POST` | `/api/users` | Register a new student account |
| `GET` | `/api/files/:id` | Stream binary attachment with correct MIME headers |
| `POST` | `/api/files/:id` | Upload raw binary attachment (via custom `X-File-Name` / `X-File-Type`) |
| `DELETE` | `/api/files/:id` | Delete attachment and its metadata from server disk |

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

## 🔐 Demo Credentials

| Role | Username / USN | Password / Passcode | Notes |
| :--- | :--- | :--- | :--- |
| **Student** | `1GE22CS045` | `student123` | Demo CSE Student (*Aditya Sharma*) |
| **Student (Registration)** | Any valid USN (e.g. `1GE22AI012`) | Your choice | Automatic branch detection from USN |
| **Faculty** | `Dr. Ramesh (CSE Dept)` | `faculty123` | Full announcement & moderation privileges |

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
