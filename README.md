# Campus Voice 📢

**Campus Voice** is a digital announcement portal designed for **Government Engineering College**, featuring Role-Based Access Control (RBAC) for **Students** and **Faculty**.

---

## ✨ Features

### 🎓 Student Interface
* **Role Selection**: Enter the portal instantly with one click.
* **Browse & Search**: Live search across notice titles, descriptions, and departments.
* **Category Filtering**: Filter announcements by *Placements*, *Exams*, *Hackathons*, *Cultural*, or *All*.
* **Single Upvoting**: Students can upvote important notices (restricted to one upvote per notice; persisted in `localStorage`).
* **Bookmarks**: Save announcements to a personal reading list and access them via the **★ Saved** filter tab.

### 🏛️ Faculty Interface
* **Secure Access**: Protected by passcode authentication (`faculty123`) and personalized department identification.
* **Announcement Publishing**: Create and post official circulars with category tagging and department attribution.
* **Notice Management**: Edit and delete notices posted under the faculty member's profile with built-in confirmation dialogs.
* **Faculty Dashboard**: Live statistics showing:
  * Notices posted by the faculty member.
  * Total upvotes accumulated.
  * Top-performing circular.

---

## 🛠️ Tech Stack
* **HTML5** & **Vanilla JavaScript** (ES6+)
* **Tailwind CSS** (via CDN with custom brand palette)
* **CSS3** (Custom transitions, animations, and role visibility rules)
* **Local Storage** (Client-side persistence for notices, bookmarks, upvotes, and sessions)

---

## 🚀 Running Locally

1. Clone this repository:
   ```bash
   git clone https://github.com/Linet2006/Campus-Voice.git
   cd Campus-Voice
   ```

2. Open `index.html` in your browser:
   * Double click `index.html`, or
   * Use VS Code Live Server, or
   * Run with a local server:
     ```bash
     npx serve
     ```

---

## 🔐 Demo Credentials
* **Student Mode**: No credentials needed.
* **Faculty Mode**:
  * **Passcode**: `faculty123`
  * **Name**: e.g. `Dr. Ramesh (CSE Dept)`

---

## 📄 License
Open source under the [MIT License](LICENSE).
