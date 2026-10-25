// ==================================================
// CAMPUS VOICE
// Role-Based Announcement Portal (Student & Faculty)
// With Student Accounts, Profiles & Branch-Based Audiences
// In-Website File Viewer (PDF.js + Click-to-Zoom Images)
// Cross-Browser Synchronization (Chrome & Edge)
// ==================================================

/* ==================================================
   SECURITY & STORAGE ARCHITECTURE NOTES:
   1. FRONT-END AUTH & SESSION SECURITY:
      This is a client-side demonstration of authentication and role-based
      access control (RBAC). In a real production deployment, authentication,
      session tokens, password verification, and authorization checks MUST be
      enforced on a secure backend server (e.g., Firebase Auth or Node.js + JWT
      + PostgreSQL/MongoDB) to prevent client-side tampering via DevTools.

   2. HYBRID STORAGE (INDEXEDDB + SERVER SYNC):
      - IndexedDB stores original file attachments as Blobs inside the local
        browser sandbox on this device.
      - To allow cross-browser testing (e.g., Faculty logged in Chrome and
        Student logged in Microsoft Edge on localhost:3000), file attachments
        and notices are automatically synchronized with the local server.
      - When opening an attachment in Edge that was uploaded in Chrome, the
        file is transparently retrieved from the server and cached in Edge's
        IndexedDB!
================================================== */

// ==================================================
// 1. CONSTANTS & BRANCH LIST
// ==================================================

// Exact 5 branches defined by college policy. Used everywhere.
const BRANCHES = [
    { code: "CSE",  name: "Computer Science" },
    { code: "AIML", name: "Artificial Intelligence & Machine Learning" },
    { code: "ECE",  name: "Electronics & Communication" },
    { code: "ME",   name: "Mechanical Engineering" },
    { code: "CV",   name: "Civil Engineering" }
];

// USN Validation Regex (Lenient pattern matching Karnataka / VTU formats e.g. 1GE22CS045)
const USN_REGEX = /^[1-4][A-Z]{2}\d{2}[A-Z]{2,3}\d{3}$/i;

// Demo Faculty Passcode Constant
const FACULTY_PASSCODE = "faculty123";

// IndexedDB Configuration for Attachments
const DB_NAME = "campusVoiceFiles";
const DB_VERSION = 1;
const STORE_NAME = "attachments";

// Configure PDF.js Worker using pinned CDN version
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}


// ==================================================
// 2. CRYPTO & BRANCH AUTO-DETECT HELPERS
// ==================================================

// SHA-256 password hashing with browser crypto.subtle (never store plain text)
async function hashPassword(plainText) {
    if (!plainText) return "";
    const encoder = new TextEncoder();
    const data = encoder.encode(plainText);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(function (b) {
        return b.toString(16).padStart(2, "0");
    }).join("");
}

// Auto-detect branch code from USN letters (CS→CSE, AI→AIML, EC→ECE, ME→ME, CV→CV)
function detectBranchFromUSN(usn) {
    if (!usn) return "";
    const upper = usn.toUpperCase();
    const match = upper.match(/^[1-4]?[A-Z]{2}\d{2}([A-Z]{2,3})/);
    const codePart = match ? match[1] : "";

    if (codePart === "CS" || codePart === "CSE") return "CSE";
    if (codePart === "AI" || codePart === "AIML") return "AIML";
    if (codePart === "EC" || codePart === "ECE") return "ECE";
    if (codePart === "ME") return "ME";
    if (codePart === "CV") return "CV";

    // Lenient fallback search within string
    if (upper.includes("AIML") || upper.includes("AI")) return "AIML";
    if (upper.includes("CSE") || upper.includes("CS")) return "CSE";
    if (upper.includes("ECE") || upper.includes("EC")) return "ECE";
    if (upper.includes("ME")) return "ME";
    if (upper.includes("CV")) return "CV";
    return "";
}

function getInitials(name) {
    if (!name) return "ST";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getBranchFullName(code) {
    const found = BRANCHES.find(function (b) {
        return b.code === code;
    });
    return found ? found.name : code;
}


// ==================================================
// 3. HYBRID ATTACHMENT STORAGE (INDEXEDDB + SERVER SYNC)
// ==================================================

function openDB() {
    return new Promise(function (resolve, reject) {
        try {
            if (!window.indexedDB) {
                reject(new Error("IndexedDB is not supported in this browser."));
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = function (event) {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };

            request.onsuccess = function (event) {
                resolve(event.target.result);
            };

            request.onerror = function (event) {
                reject(event.target.error || new Error("Failed to open IndexedDB"));
            };
        } catch (err) {
            reject(err);
        }
    });
}

// Save file as Blob in IndexedDB + Sync to local server for cross-browser availability
async function saveFile(id, file) {
    // 1. Store in local IndexedDB
    try {
        const db = await openDB();
        await new Promise(function (resolve, reject) {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(file, id);

            req.onsuccess = function () { resolve(true); };
            req.onerror = function () { reject(req.error); };
        });
    } catch (err) {
        console.error("IndexedDB saveFile error:", err);
    }

    // 2. Sync file with local server so Edge and Chrome can share it
    try {
        await fetch(`/api/files/${encodeURIComponent(id)}`, {
            method: "POST",
            headers: {
                "X-File-Name": encodeURIComponent(file.name || id),
                "X-File-Type": file.type || "application/octet-stream"
            },
            body: file
        });
    } catch (netErr) {
        console.warn("Server file sync note (offline):", netErr);
    }

    return true;
}

// Retrieve file Blob: checks IndexedDB first, falls back to server if opened in a different browser
async function getFile(id) {
    if (!id) return null;

    // 1. Check local IndexedDB
    try {
        const db = await openDB();
        const localBlob = await new Promise(function (resolve, reject) {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(id);

            req.onsuccess = function () { resolve(req.result || null); };
            req.onerror = function () { reject(req.error); };
        });

        if (localBlob) {
            return localBlob;
        }
    } catch (err) {
        console.warn("IndexedDB getFile read error:", err);
    }

    // 2. If not present in this browser's IndexedDB (e.g. uploaded in Chrome, opened in Edge), fetch from server
    try {
        const resp = await fetch(`/api/files/${encodeURIComponent(id)}`);
        if (resp.ok) {
            const serverBlob = await resp.blob();

            // Cache into this browser's IndexedDB for immediate future access
            try {
                const db = await openDB();
                const tx = db.transaction(STORE_NAME, "readwrite");
                tx.objectStore(STORE_NAME).put(serverBlob, id);
            } catch (cacheErr) {}

            return serverBlob;
        }
    } catch (netErr) {
        console.warn("Server getFile fetch error:", netErr);
    }

    return null;
}

// Delete attachment from IndexedDB and server
async function deleteFile(id) {
    if (!id) return;

    // 1. Delete from local IndexedDB
    try {
        const db = await openDB();
        await new Promise(function (resolve, reject) {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(id);

            req.onsuccess = function () { resolve(true); };
            req.onerror = function () { reject(req.error); };
        });
    } catch (err) {
        console.error("IndexedDB deleteFile error:", err);
    }

    // 2. Delete from server
    try {
        await fetch(`/api/files/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (netErr) {}
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}


// ==================================================
// 4. USERS & SESSION STORAGE (campusUsers, campusSession)
// ==================================================

// Pre-seeded demo student user (USN: 1GE22CS045, Password: student123)
const defaultDemoUsers = [
    {
        usn: "1GE22CS045",
        name: "Aditya Sharma",
        branch: "CSE",
        email: "aditya@gec.edu",
        semester: "5th Semester",
        passwordHash: "703b0a3d6ad75b649a28adde7d83c6251da457549263bc7ff45ec709b0a8448b"
    }
];

function getCampusUsers() {
    try {
        const data = localStorage.getItem("campusUsers");
        if (!data) {
            localStorage.setItem("campusUsers", JSON.stringify(defaultDemoUsers));
            return defaultDemoUsers;
        }
        return JSON.parse(data) || [];
    } catch (e) {
        return defaultDemoUsers;
    }
}

function saveCampusUsers(users) {
    localStorage.setItem("campusUsers", JSON.stringify(users));
    try {
        fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(users)
        }).catch(function () {});
    } catch (e) {}
}

async function syncUsersFromServer() {
    try {
        const resp = await fetch("/api/users");
        if (resp.ok) {
            const serverUsers = await resp.json();
            if (Array.isArray(serverUsers) && serverUsers.length > 0) {
                const currentUsers = getCampusUsers();
                // Merge unique users by USN
                const mergedMap = new Map();
                currentUsers.forEach(function (u) { mergedMap.set(u.usn.toUpperCase(), u); });
                serverUsers.forEach(function (u) { mergedMap.set(u.usn.toUpperCase(), u); });
                const merged = Array.from(mergedMap.values());
                localStorage.setItem("campusUsers", JSON.stringify(merged));
            }
        }
    } catch (e) {}
}

function getSession() {
    try {
        const data = localStorage.getItem("campusSession");
        return data ? JSON.parse(data) : null;
    } catch (e) {
        return null;
    }
}

function saveSession(session) {
    localStorage.setItem("campusSession", JSON.stringify(session));
    if (session) {
        localStorage.setItem("campusRole", session.role);
        localStorage.setItem("campusUserName", session.name || "");
    }
}

function clearSession() {
    localStorage.removeItem("campusSession");
    localStorage.removeItem("campusRole");
    localStorage.removeItem("campusUserName");
}


// ==================================================
// 5. INITIAL NOTICES & HYBRID PERSISTENCE
// ==================================================

const initialNotices = [
    {
        id: 5,
        title: "CAD/CAM & Structural Analysis Hands-on Workshop",
        category: "Exams",
        description: "Hands-on technical workshop for mechanical and civil engineering students on finite element modeling and sustainable design.",
        author: "Department of Mechanical & Civil",
        postedBy: "Dr. Ramesh (CSE Dept)",
        authorRole: "faculty",
        date: "Oct 12, 2026",
        upvotes: 42,
        attachment: null,
        audience: { type: "branches", branches: ["ME", "CV"] }
    },
    {
        id: 4,
        title: "Ahlya Technologies On-Campus Placement Drive",
        category: "Placements",
        description: "Ahlya Technologies is conducting an on-campus evaluation for final year students. Register through the placement portal.",
        author: "GEC Training & Placement Cell",
        postedBy: null,
        authorRole: "faculty",
        date: "Sep 28, 2026",
        upvotes: 64,
        attachment: null,
        audience: { type: "all", branches: [] }
    },
    {
        id: 3,
        title: "CSE & AIML Laboratory Practical Examination Timetable",
        category: "Exams",
        description: "The practical examination timetable and laboratory batch details have been released for Computer Science and AI & ML students.",
        author: "Department of Computer Science & AIML",
        postedBy: null,
        authorRole: "faculty",
        date: "Oct 8, 2026",
        upvotes: 31,
        attachment: null,
        audience: { type: "branches", branches: ["CSE", "AIML"] }
    },
    {
        id: 2,
        title: "Web Innovation Prototype Challenge",
        category: "Hackathons",
        description: "Student squads can register for the 24-hour web prototype innovation challenge. Exciting prizes and mentorship opportunities.",
        author: "Student Innovation Club",
        postedBy: null,
        authorRole: "faculty",
        date: "Sep 26, 2026",
        upvotes: 49,
        attachment: null,
        audience: { type: "all", branches: [] }
    },
    {
        id: 1,
        title: "Annual Cultural Fest 2026",
        category: "Cultural",
        description: "Registrations are officially open for music, dance, theatrical, and fine arts events. Contact student coordinators for slots.",
        author: "Student Welfare Committee",
        postedBy: null,
        authorRole: "faculty",
        date: "Sep 25, 2026",
        upvotes: 18,
        attachment: null,
        audience: { type: "all", branches: [] }
    }
];

const storedNotices = localStorage.getItem("campusNotices");
let notices;
if (storedNotices) {
    try {
        notices = JSON.parse(storedNotices);
    } catch (e) {
        notices = initialNotices;
    }
} else {
    notices = initialNotices;
    localStorage.setItem("campusNotices", JSON.stringify(notices));
}

// Save notices in localStorage AND synchronize with server for cross-browser updates
function saveNotices() {
    localStorage.setItem("campusNotices", JSON.stringify(notices));
    try {
        fetch("/api/notices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(notices)
        }).catch(function () {});
    } catch (e) {}
}

// Background sync function: updates notices across Chrome & Edge in real-time
async function syncNoticesFromServer() {
    try {
        const resp = await fetch("/api/notices");
        if (resp.ok) {
            const serverNotices = await resp.json();
            if (Array.isArray(serverNotices) && serverNotices.length > 0) {
                const serverStr = JSON.stringify(serverNotices);
                const localStr = JSON.stringify(notices);
                if (serverStr !== localStr) {
                    notices = serverNotices;
                    localStorage.setItem("campusNotices", serverStr);

                    // Check for any new categories on incoming notices
                    let updatedCats = false;
                    serverNotices.forEach(function (n) {
                        if (n.category && !campusCategories.includes(n.category)) {
                            campusCategories.push(n.category);
                            updatedCats = true;
                        }
                    });
                    if (updatedCats) {
                        saveCategories(campusCategories);
                        renderCategoryFiltersAndDropdowns();
                    }

                    renderNotices();
                    if (currentRole === "faculty") {
                        updateFacultyDashboard();
                    }
                }
            }
        }
    } catch (e) {}
}

function getUpvotedNoticeIds() {
    try {
        return JSON.parse(localStorage.getItem("campusUpvoted")) || [];
    } catch (e) {
        return [];
    }
}

function saveUpvotedNoticeIds(ids) {
    localStorage.setItem("campusUpvoted", JSON.stringify(ids));
}

function getBookmarkedNoticeIds() {
    try {
        return JSON.parse(localStorage.getItem("campusBookmarks")) || [];
    } catch (e) {
        return [];
    }
}

function saveBookmarkedNoticeIds(ids) {
    localStorage.setItem("campusBookmarks", JSON.stringify(ids));
}


// ==================================================
// 6. APPLICATION STATE
// ==================================================

let currentSession = getSession();
let currentRole = currentSession ? currentSession.role : null;
let campusUserName = currentSession ? currentSession.name : "";

// Feed Filtering State
let studentFeedMode = "my-branch"; // "my-branch" | "all"
let facultyAudienceFilterValue = "all"; // "all" | "campus-wide" | branch code
let currentFilter = "All";
let searchText = "";
let currentSort = "latest";
let editingNoticeId = null;

// Categories State & Storage
const DEFAULT_CATEGORIES = ["Placements", "Exams", "Hackathons", "Cultural"];
let campusCategories = loadStoredCategories();

function loadStoredCategories() {
    let cats = [];
    try {
        cats = JSON.parse(localStorage.getItem("campusCategories")) || [];
    } catch (e) {
        cats = [];
    }
    if (!Array.isArray(cats) || cats.length === 0) {
        cats = [...DEFAULT_CATEGORIES];
    }
    // Also include any categories that existing notices use
    if (typeof notices !== "undefined" && Array.isArray(notices)) {
        notices.forEach(function (n) {
            if (n && n.category && !cats.includes(n.category)) {
                cats.push(n.category);
            }
        });
    }
    return cats;
}

function saveCategories(cats) {
    campusCategories = [...cats];
    localStorage.setItem("campusCategories", JSON.stringify(campusCategories));
    fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campusCategories)
    }).catch(function () {});
}

async function syncCategoriesFromServer() {
    try {
        const res = await fetch("/api/categories");
        if (res.ok) {
            const serverCats = await res.json();
            if (Array.isArray(serverCats) && serverCats.length > 0) {
                let merged = [...campusCategories];
                let changed = false;
                serverCats.forEach(function (c) {
                    if (c && !merged.includes(c)) {
                        merged.push(c);
                        changed = true;
                    }
                });
                if (changed) {
                    campusCategories = merged;
                    localStorage.setItem("campusCategories", JSON.stringify(campusCategories));
                    renderCategoryFiltersAndDropdowns();
                }
            }
        }
    } catch (e) {}
}

// Modal File Picker State
let currentAttachmentFile = null;
let currentAttachmentMeta = null;
let pendingDeletedAttachmentId = null;
let previewObjectUrl = null;

// File Viewer Modal State
let currentViewerBlob = null;
let currentViewerUrl = null;
let currentViewerFileName = "";
let currentViewerFileType = "";
let currentViewerFileSize = 0;

// PDF Rendering State
let currentPdfDoc = null;
let currentPdfZoom = 1.0;
let pdfIntersectionObserver = null;
const renderedPdfPages = new Set();


// ==================================================
// 7. DOM REFERENCES
// ==================================================

// Role / Auth Screen
const roleScreen = document.getElementById("roleScreen");

// Student Auth Tabs
const studentTabLoginBtn = document.getElementById("studentTabLoginBtn");
const studentTabRegisterBtn = document.getElementById("studentTabRegisterBtn");
const studentLoginForm = document.getElementById("studentLoginForm");
const studentRegisterForm = document.getElementById("studentRegisterForm");
const switchToRegisterLink = document.getElementById("switchToRegisterLink");
const switchToLoginLink = document.getElementById("switchToLoginLink");

// Student Login Form Fields
const studentLoginId = document.getElementById("studentLoginId");
const studentLoginPassword = document.getElementById("studentLoginPassword");
const studentLoginError = document.getElementById("studentLoginError");

// Student Register Form Fields
const studentRegName = document.getElementById("studentRegName");
const studentRegUsn = document.getElementById("studentRegUsn");
const studentRegBranch = document.getElementById("studentRegBranch");
const studentRegEmail = document.getElementById("studentRegEmail");
const studentRegSemester = document.getElementById("studentRegSemester");
const studentRegPassword = document.getElementById("studentRegPassword");
const studentRegConfirmPassword = document.getElementById("studentRegConfirmPassword");
const studentRegError = document.getElementById("studentRegError");

// Faculty Auth
const selectFacultyBtn = document.getElementById("selectFacultyBtn");
const facultyPasscode = document.getElementById("facultyPasscode");
const facultyNameInput = document.getElementById("facultyNameInput");
const facultyError = document.getElementById("facultyError");

// Header Navigation
const switchRoleBtn = document.getElementById("switchRoleBtn");
const logoutBtnLabel = document.getElementById("logoutBtnLabel");
const roleBadge = document.getElementById("roleBadge");
const studentProfileBtn = document.getElementById("studentProfileBtn");
const studentHeaderAvatar = document.getElementById("studentHeaderAvatar");
const studentHeaderName = document.getElementById("studentHeaderName");
const openModalBtn = document.getElementById("openModalBtn");

// Hero elements
const heroTitle = document.getElementById("heroTitle");
const heroSubtitle = document.getElementById("heroSubtitle");
const totalCount = document.getElementById("totalCount");
const trendingCount = document.getElementById("trendingCount");

// Faculty Dashboard elements
const facultyDashboard = document.getElementById("facultyDashboard");
const dashFacultyName = document.getElementById("dashFacultyName");
const myNoticesCount = document.getElementById("myNoticesCount");
const myUpvotesCount = document.getElementById("myUpvotesCount");
const myTopNotice = document.getElementById("myTopNotice");

// Student Feed Toggle
const studentFeedToggleContainer = document.getElementById("studentFeedToggleContainer");
const feedMyBranchBtn = document.getElementById("feedMyBranchBtn");
const feedAllBtn = document.getElementById("feedAllBtn");
const feedBranchLabel = document.getElementById("feedBranchLabel");
const feedAudienceHint = document.getElementById("feedAudienceHint");

// Faculty Audience Filter
const facultyAudienceFilter = document.getElementById("facultyAudienceFilter");

// Search & Sort & Categories
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const sortSelect = document.getElementById("sortSelect");
const filterContainer = document.getElementById("filterContainer");
const savedFilterPill = document.getElementById("savedFilterPill");

// Grid & Empty state
const cardsGrid = document.getElementById("cardsGrid");
const emptyState = document.getElementById("emptyState");
const emptyTitle = document.getElementById("emptyTitle");
const emptyDesc = document.getElementById("emptyDesc");

// Student Profile Modal Elements
const studentProfileModal = document.getElementById("studentProfileModal");
const closeProfileBtn = document.getElementById("closeProfileBtn");
const studentProfileForm = document.getElementById("studentProfileForm");
const profileHeaderAvatar = document.getElementById("profileHeaderAvatar");
const profileUsn = document.getElementById("profileUsn");
const profileName = document.getElementById("profileName");
const profileBranch = document.getElementById("profileBranch");
const profileEmail = document.getElementById("profileEmail");
const profileSemester = document.getElementById("profileSemester");
const profileCurrentPassword = document.getElementById("profileCurrentPassword");
const profileNewPassword = document.getElementById("profileNewPassword");
const profileConfirmPassword = document.getElementById("profileConfirmPassword");
const profileError = document.getElementById("profileError");
const profileLogoutBtn = document.getElementById("profileLogoutBtn");
const deleteAccountBtn = document.getElementById("deleteAccountBtn");

// Notice Modal & Form Elements
const noticeModal = document.getElementById("noticeModal");
const modalTitle = document.getElementById("modalTitle");
const modalSubmitBtn = document.getElementById("modalSubmitBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const noticeForm = document.getElementById("noticeForm");
const noticeTitle = document.getElementById("noticeTitle");
const noticeCategory = document.getElementById("noticeCategory");
const noticeAuthor = document.getElementById("noticeAuthor");
const noticeDescription = document.getElementById("noticeDescription");
const characterCount = document.getElementById("characterCount");

// Audience Fields in Notice Modal
const audienceAll = document.getElementById("audienceAll");
const audienceSpecific = document.getElementById("audienceSpecific");
const specificBranchesContainer = document.getElementById("specificBranchesContainer");
const branchCheckboxesList = document.getElementById("branchCheckboxesList");

// Attachment elements in Notice Modal
const noticeAttachment = document.getElementById("noticeAttachment");
const attachmentInputWrapper = document.getElementById("attachmentInputWrapper");
const attachmentPreview = document.getElementById("attachmentPreview");
const previewMediaContainer = document.getElementById("previewMediaContainer");
const previewFileName = document.getElementById("previewFileName");
const previewFileSize = document.getElementById("previewFileSize");
const removeAttachmentBtn = document.getElementById("removeAttachmentBtn");

// File Viewer Modal Elements
const fileViewerModal = document.getElementById("fileViewerModal");
const viewerFileIcon = document.getElementById("viewerFileIcon");
const viewerFileName = document.getElementById("viewerFileName");
const viewerFileSize = document.getElementById("viewerFileSize");
const viewerPdfControls = document.getElementById("viewerPdfControls");
const viewerZoomLevel = document.getElementById("viewerZoomLevel");
const viewerZoomInBtn = document.getElementById("viewerZoomInBtn");
const viewerZoomOutBtn = document.getElementById("viewerZoomOutBtn");
const viewerPageIndicator = document.getElementById("viewerPageIndicator");
const viewerDownloadBtn = document.getElementById("viewerDownloadBtn");
const closeViewerBtn = document.getElementById("closeViewerBtn");
const fileViewerBody = document.getElementById("fileViewerBody");
const viewerLoadingSpinner = document.getElementById("viewerLoadingSpinner");
const viewerErrorState = document.getElementById("viewerErrorState");
const viewerErrorMessage = document.getElementById("viewerErrorMessage");
const viewerErrorDownloadBtn = document.getElementById("viewerErrorDownloadBtn");
const fileViewerContent = document.getElementById("fileViewerContent");

// Category Modal & Creation Elements
const categoryModal = document.getElementById("categoryModal");
const closeCategoryModalBtn = document.getElementById("closeCategoryModalBtn");
const cancelCategoryBtn = document.getElementById("cancelCategoryBtn");
const categoryForm = document.getElementById("categoryForm");
const newCategoryName = document.getElementById("newCategoryName");
const categoryError = document.getElementById("categoryError");
const submitCategoryBtn = document.getElementById("submitCategoryBtn");
const openAddCategoryBtn = document.getElementById("openAddCategoryBtn");
const inlineAddCategoryBtn = document.getElementById("inlineAddCategoryBtn");

// Toast
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
let toastTimeout = null;


// ==================================================
// 8. INITIALIZE BRANCH DROPDOWNS & CONTROLS
// ==================================================

function populateBranchControls() {
    // 1. Student Register Branch Dropdown
    if (studentRegBranch) {
        studentRegBranch.innerHTML = '<option value="">Select Branch *</option>' +
            BRANCHES.map(function (b) {
                return `<option value="${b.code}">${b.name} (${b.code})</option>`;
            }).join("");
    }

    // 2. Student Profile Branch Dropdown
    if (profileBranch) {
        profileBranch.innerHTML = BRANCHES.map(function (b) {
            return `<option value="${b.code}">${b.name} (${b.code})</option>`;
        }).join("");
    }

    // 3. Faculty Audience Filter Dropdown in Toolbar
    if (facultyAudienceFilter) {
        facultyAudienceFilter.innerHTML = `
            <option value="all">All Audiences (Every Notice)</option>
            <option value="campus-wide">Campus-wide (All Branches)</option>
            ${BRANCHES.map(function (b) {
                return `<option value="${b.code}">${b.name} (${b.code})</option>`;
            }).join("")}
        `;
    }

    // 4. Notice Modal Specific Branches Checkboxes
    if (branchCheckboxesList) {
        branchCheckboxesList.innerHTML = BRANCHES.map(function (b) {
            return `
                <label class="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 hover:border-brand-400 cursor-pointer transition select-none">
                    <input
                        type="checkbox"
                        name="noticeBranchCheck"
                        value="${b.code}"
                        class="branch-check-input rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                    >
                    <span class="font-medium text-slate-800 text-[11px] sm:text-xs">
                        ${b.name} <strong class="text-brand-600">(${b.code})</strong>
                    </span>
                </label>
            `;
        }).join("");
    }
}


// ==================================================
// 9. PASSWORD TOGGLE LOGIC
// ==================================================

document.addEventListener("click", function (e) {
    const toggleBtn = e.target.closest(".password-toggle");
    if (!toggleBtn) return;

    const targetId = toggleBtn.dataset.target;
    if (!targetId) return;

    const input = document.getElementById(targetId);
    if (!input) return;

    if (input.type === "password") {
        input.type = "text";
        toggleBtn.textContent = "🙈";
        toggleBtn.title = "Hide password";
    } else {
        input.type = "password";
        toggleBtn.textContent = "👁";
        toggleBtn.title = "Show password";
    }
});


// ==================================================
// 10. ROLE & SESSION APPLICATION (applyRole)
// ==================================================

function applyRole() {
    currentSession = getSession();
    currentRole = currentSession ? currentSession.role : null;
    campusUserName = currentSession ? currentSession.name : "";

    document.body.classList.remove("role-student", "role-faculty");

    if (!currentSession || !currentRole) {
        if (roleScreen) roleScreen.classList.remove("hidden");
        return;
    }

    if (roleScreen) roleScreen.classList.add("hidden");

    if (currentRole === "faculty") {
        document.body.classList.add("role-faculty");

        if (roleBadge) {
            roleBadge.className = "text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/50 flex items-center gap-1.5";
            roleBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Faculty: <span class="text-white normal-case font-bold">${escapeHtml(campusUserName)}</span>`;
        }

        if (logoutBtnLabel) logoutBtnLabel.textContent = "Logout";
        if (heroTitle) heroTitle.textContent = "Manage and publish campus announcements.";
        if (heroSubtitle) heroSubtitle.textContent = "Official faculty portal for college circulars, exams, and event notices.";

        if (openModalBtn) openModalBtn.classList.remove("hidden");
        if (facultyDashboard) facultyDashboard.classList.remove("hidden");
        if (savedFilterPill) savedFilterPill.classList.add("hidden");
        if (studentProfileBtn) studentProfileBtn.classList.add("hidden");
        if (studentFeedToggleContainer) studentFeedToggleContainer.classList.add("hidden");

        if (currentFilter === "Saved") {
            currentFilter = "All";
            resetActiveFilterPill("All");
        }

        updateFacultyDashboard();

    } else if (currentRole === "student") {
        document.body.classList.add("role-student");

        const studentBranch = currentSession.branch || "General";
        const studentUsn = currentSession.usn || "";

        if (roleBadge) {
            roleBadge.className = "text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-indigo-700/70 text-indigo-200 border border-indigo-500/50 flex items-center gap-1.5";
            roleBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Student (<span class="font-bold text-white">${escapeHtml(studentBranch)}</span>) · <span class="font-mono text-indigo-200">${escapeHtml(studentUsn)}</span>`;
        }

        if (studentHeaderAvatar) {
            studentHeaderAvatar.textContent = getInitials(currentSession.name);
        }
        if (studentHeaderName) {
            studentHeaderName.textContent = currentSession.name.split(" ")[0];
        }

        if (feedBranchLabel) {
            feedBranchLabel.textContent = studentBranch;
        }

        updateStudentFeedToggleUI();

        if (logoutBtnLabel) logoutBtnLabel.textContent = "Logout";
        if (heroTitle) heroTitle.textContent = "What's happening on campus?";
        if (heroSubtitle) heroSubtitle.textContent = `Announcements targeted for ${getBranchFullName(studentBranch)} and college-wide circulars.`;

        if (openModalBtn) openModalBtn.classList.add("hidden");
        if (facultyDashboard) facultyDashboard.classList.add("hidden");
        if (savedFilterPill) savedFilterPill.classList.remove("hidden");
        if (studentProfileBtn) studentProfileBtn.classList.remove("hidden");
        if (studentFeedToggleContainer) studentFeedToggleContainer.classList.remove("hidden");
    }

    renderNotices();
}

function updateStudentFeedToggleUI() {
    if (!feedMyBranchBtn || !feedAllBtn) return;
    if (studentFeedMode === "my-branch") {
        feedMyBranchBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs bg-brand-600 text-white";
        feedAllBtn.className = "px-3 py-1.5 rounded-lg text-xs font-semibold transition text-slate-600 hover:text-slate-900";
        if (feedAudienceHint) {
            feedAudienceHint.textContent = `Showing notices for ${currentSession ? currentSession.branch : "your branch"} & college-wide circulars`;
        }
    } else {
        feedAllBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs bg-brand-600 text-white";
        feedMyBranchBtn.className = "px-3 py-1.5 rounded-lg text-xs font-semibold transition text-slate-600 hover:text-slate-900";
        if (feedAudienceHint) {
            feedAudienceHint.textContent = "Showing all campus announcements across every branch";
        }
    }
}

function updateFacultyDashboard() {
    if (currentRole !== "faculty") return;

    const myNotices = notices.filter(function (notice) {
        return !notice.postedBy || notice.postedBy === campusUserName;
    });

    const totalPosted = myNotices.length;
    const totalUpvotes = myNotices.reduce(function (sum, n) {
        return sum + (Number(n.upvotes) || 0);
    }, 0);

    let topNoticeText = "None yet";
    if (myNotices.length > 0) {
        const top = [...myNotices].sort(function (a, b) {
            return (Number(b.upvotes) || 0) - (Number(a.upvotes) || 0);
        })[0];
        if (top) {
            topNoticeText = `${top.title} (${top.upvotes} upvotes)`;
        }
    }

    if (dashFacultyName) dashFacultyName.textContent = campusUserName || "Faculty";
    if (myNoticesCount) myNoticesCount.textContent = totalPosted;
    if (myUpvotesCount) myUpvotesCount.textContent = totalUpvotes;
    if (myTopNotice) {
        myTopNotice.textContent = topNoticeText;
        myTopNotice.title = topNoticeText;
    }
}

function canFacultyEdit(notice) {
    if (currentRole !== "faculty") return false;
    if (!notice.postedBy) return true;
    return notice.postedBy === campusUserName;
}

function resetActiveFilterPill(activeCategory) {
    const pills = filterContainer.querySelectorAll(".filter-pill");
    pills.forEach(function (pill) {
        if (pill.dataset.category === activeCategory) {
            pill.classList.add("active-pill");
        } else {
            pill.classList.remove("active-pill");
        }
    });
}


// ==================================================
// 11. STUDENT AUTHENTICATION (REGISTER & LOGIN)
// ==================================================

// Tab Switcher inside Student Card
studentTabLoginBtn.addEventListener("click", function () {
    studentTabLoginBtn.className = "flex-1 py-1.5 text-xs font-bold rounded-lg transition bg-brand-600 text-white shadow-xs";
    studentTabRegisterBtn.className = "flex-1 py-1.5 text-xs font-semibold rounded-lg transition text-slate-600 hover:text-slate-900";
    studentLoginForm.classList.remove("hidden");
    studentRegisterForm.classList.add("hidden");
    if (studentLoginError) studentLoginError.classList.add("hidden");
});

studentTabRegisterBtn.addEventListener("click", function () {
    studentTabRegisterBtn.className = "flex-1 py-1.5 text-xs font-bold rounded-lg transition bg-brand-600 text-white shadow-xs";
    studentTabLoginBtn.className = "flex-1 py-1.5 text-xs font-semibold rounded-lg transition text-slate-600 hover:text-slate-900";
    studentRegisterForm.classList.remove("hidden");
    studentLoginForm.classList.add("hidden");
    if (studentRegError) studentRegError.classList.add("hidden");
});

if (switchToRegisterLink) {
    switchToRegisterLink.addEventListener("click", function () {
        studentTabRegisterBtn.click();
    });
}

if (switchToLoginLink) {
    switchToLoginLink.addEventListener("click", function () {
        studentTabLoginBtn.click();
    });
}

// Auto-select branch on typing USN
studentRegUsn.addEventListener("input", function (e) {
    const val = e.target.value.toUpperCase();
    e.target.value = val;
    const detected = detectBranchFromUSN(val);
    if (detected && studentRegBranch) {
        studentRegBranch.value = detected;
    }
});

// Student Registration Form Submit
studentRegisterForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (studentRegError) studentRegError.classList.add("hidden");

    const name = studentRegName.value.trim();
    const usn = studentRegUsn.value.trim().toUpperCase();
    const branch = studentRegBranch.value;
    const email = studentRegEmail.value.trim().toLowerCase();
    const semester = studentRegSemester.value;
    const password = studentRegPassword.value;
    const confirmPassword = studentRegConfirmPassword.value;

    // Validations
    if (!name || !usn || !branch || !email || !password || !confirmPassword) {
        showRegError("Please fill in all required fields.");
        return;
    }

    if (!USN_REGEX.test(usn)) {
        showRegError("Please enter a valid USN (e.g. 1GE22CS045).");
        studentRegUsn.focus();
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showRegError("Please enter a valid email address.");
        studentRegEmail.focus();
        return;
    }

    if (password.length < 6) {
        showRegError("Password must be at least 6 characters.");
        studentRegPassword.focus();
        return;
    }

    if (password !== confirmPassword) {
        showRegError("Passwords do not match.");
        studentRegConfirmPassword.focus();
        return;
    }

    const users = getCampusUsers();

    if (users.some(function (u) { return u.usn.toUpperCase() === usn; })) {
        showRegError("A student with this USN is already registered. Please log in.");
        return;
    }

    if (users.some(function (u) { return u.email.toLowerCase() === email; })) {
        showRegError("A student with this Email is already registered. Please log in.");
        return;
    }

    // Hash password with SHA-256 before storing
    const passwordHash = await hashPassword(password);

    const newUser = {
        usn: usn,
        name: name,
        branch: branch,
        email: email,
        semester: semester || "",
        passwordHash: passwordHash
    };

    users.push(newUser);
    saveCampusUsers(users);

    // Save session
    const session = {
        role: "student",
        usn: newUser.usn,
        name: newUser.name,
        branch: newUser.branch,
        email: newUser.email,
        semester: newUser.semester
    };
    saveSession(session);

    studentRegisterForm.reset();
    applyRole();
    showToast(`Account created! Welcome to Campus Voice, ${newUser.name}.`);
});

function showRegError(msg) {
    if (studentRegError) {
        studentRegError.textContent = msg;
        studentRegError.classList.remove("hidden");
    }
}

// Student Login Form Submit
studentLoginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (studentLoginError) studentLoginError.classList.add("hidden");

    const identifier = studentLoginId.value.trim();
    const password = studentLoginPassword.value;

    if (!identifier || !password) {
        showLoginError("Please enter your USN or Email and Password.");
        return;
    }

    const users = getCampusUsers();
    const enteredHash = await hashPassword(password);

    const user = users.find(function (u) {
        const matchUsn = u.usn.toUpperCase() === identifier.toUpperCase();
        const matchEmail = u.email.toLowerCase() === identifier.toLowerCase();
        return (matchUsn || matchEmail) && u.passwordHash === enteredHash;
    });

    if (!user) {
        showLoginError("Invalid credentials. Please verify your USN/Email and password.");
        return;
    }

    const session = {
        role: "student",
        usn: user.usn,
        name: user.name,
        branch: user.branch,
        email: user.email,
        semester: user.semester || ""
    };
    saveSession(session);

    studentLoginForm.reset();
    applyRole();
    showToast(`Welcome back, ${user.name}!`);
});

function showLoginError(msg) {
    if (studentLoginError) {
        studentLoginError.textContent = msg;
        studentLoginError.classList.remove("hidden");
    }
}


// ==================================================
// 12. FACULTY AUTHENTICATION
// ==================================================

selectFacultyBtn.addEventListener("click", function () {
    const enteredPasscode = facultyPasscode.value.trim();
    const enteredName = facultyNameInput.value.trim();

    if (enteredPasscode !== FACULTY_PASSCODE) {
        facultyError.textContent = "Invalid passcode. (Demo passcode: faculty123)";
        facultyError.classList.remove("hidden");
        facultyPasscode.focus();
        return;
    }

    facultyError.classList.add("hidden");
    const resolvedName = enteredName || "Faculty Member";

    const session = {
        role: "faculty",
        name: resolvedName,
        department: "Faculty / Administration"
    };
    saveSession(session);

    facultyPasscode.value = "";
    facultyNameInput.value = "";

    applyRole();
    showToast(`Welcome, ${resolvedName}! Faculty privileges enabled.`);
});

facultyPasscode.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        selectFacultyBtn.click();
    }
});


// ==================================================
// 13. SESSION LOGOUT & SWITCH ROLE
// ==================================================

switchRoleBtn.addEventListener("click", function () {
    clearSession();
    editingNoticeId = null;

    closeModal();
    closeFileViewer();
    closeProfileModal();

    if (facultyError) facultyError.classList.add("hidden");
    if (facultyPasscode) facultyPasscode.value = "";
    if (facultyNameInput) facultyNameInput.value = "";

    applyRole();
    showToast("Session ended. Please select your role.");
});


// ==================================================
// 14. STUDENT PROFILE MODAL & EDITING
// ==================================================

function openProfileModal() {
    const session = getSession();
    if (!session || session.role !== "student") {
        showToast("Access denied: You must be logged in as a student.");
        return;
    }

    if (profileError) profileError.classList.add("hidden");

    profileUsn.value = session.usn || "";
    profileName.value = session.name || "";
    profileBranch.value = session.branch || "CSE";
    profileEmail.value = session.email || "";
    profileSemester.value = session.semester || "";

    profileCurrentPassword.value = "";
    profileNewPassword.value = "";
    profileConfirmPassword.value = "";

    if (profileHeaderAvatar) {
        profileHeaderAvatar.textContent = getInitials(session.name);
    }

    studentProfileModal.classList.remove("hidden");
    studentProfileModal.classList.add("flex");
}

function closeProfileModal() {
    studentProfileModal.classList.add("hidden");
    studentProfileModal.classList.remove("flex");
    if (profileError) profileError.classList.add("hidden");
}

studentProfileBtn.addEventListener("click", openProfileModal);
closeProfileBtn.addEventListener("click", closeProfileModal);

studentProfileModal.addEventListener("click", function (e) {
    if (e.target === studentProfileModal) {
        closeProfileModal();
    }
});

// Profile Form Submit (Edit Profile & Password)
studentProfileForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (profileError) profileError.classList.add("hidden");

    const session = getSession();
    if (!session || session.role !== "student") {
        showToast("Access denied: Invalid session.");
        return;
    }

    const newName = profileName.value.trim();
    const newBranch = profileBranch.value;
    const newEmail = profileEmail.value.trim().toLowerCase();
    const newSemester = profileSemester.value;

    const currentPwd = profileCurrentPassword.value;
    const newPwd = profileNewPassword.value;
    const confirmPwd = profileConfirmPassword.value;

    if (!newName || !newBranch || !newEmail) {
        showProfileError("Please complete all required profile fields.");
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
        showProfileError("Please enter a valid email address.");
        return;
    }

    const users = getCampusUsers();
    const userIndex = users.findIndex(function (u) {
        return u.usn.toUpperCase() === session.usn.toUpperCase();
    });

    if (userIndex === -1) {
        showProfileError("User record not found in system.");
        return;
    }

    // Check email uniqueness if email changed
    const emailConflict = users.some(function (u, i) {
        return i !== userIndex && u.email.toLowerCase() === newEmail;
    });
    if (emailConflict) {
        showProfileError("Another account is already using this email address.");
        return;
    }

    // If student is changing password
    let updatedPasswordHash = users[userIndex].passwordHash;
    if (newPwd || currentPwd || confirmPwd) {
        if (!currentPwd) {
            showProfileError("Please enter your current password to set a new password.");
            profileCurrentPassword.focus();
            return;
        }

        const enteredCurrentHash = await hashPassword(currentPwd);
        if (enteredCurrentHash !== users[userIndex].passwordHash) {
            showProfileError("Current password is incorrect.");
            profileCurrentPassword.focus();
            return;
        }

        if (newPwd.length < 6) {
            showProfileError("New password must be at least 6 characters.");
            profileNewPassword.focus();
            return;
        }

        if (newPwd !== confirmPwd) {
            showProfileError("New password confirmation does not match.");
            profileConfirmPassword.focus();
            return;
        }

        updatedPasswordHash = await hashPassword(newPwd);
    }

    // Update user record in localStorage
    users[userIndex].name = newName;
    users[userIndex].branch = newBranch;
    users[userIndex].email = newEmail;
    users[userIndex].semester = newSemester;
    users[userIndex].passwordHash = updatedPasswordHash;
    saveCampusUsers(users);

    // Update session
    session.name = newName;
    session.branch = newBranch;
    session.email = newEmail;
    session.semester = newSemester;
    saveSession(session);

    applyRole();
    closeProfileModal();
    showToast("Profile details updated successfully!");
});

function showProfileError(msg) {
    if (profileError) {
        profileError.textContent = msg;
        profileError.classList.remove("hidden");
    }
}

// Profile Modal Logout Button
profileLogoutBtn.addEventListener("click", function () {
    closeProfileModal();
    switchRoleBtn.click();
});

// Delete My Account with Confirmation
deleteAccountBtn.addEventListener("click", function () {
    const session = getSession();
    if (!session || session.role !== "student") return;

    const confirmed = window.confirm(
        `Are you sure you want to permanently delete your student account (${session.usn})?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    const users = getCampusUsers();
    const updatedUsers = users.filter(function (u) {
        return u.usn.toUpperCase() !== session.usn.toUpperCase();
    });
    saveCampusUsers(updatedUsers);

    clearSession();
    closeProfileModal();
    applyRole();
    showToast("Your student account has been deleted.");
});


// ==================================================
// 15. STUDENT FEED MODE TOGGLE & FACULTY AUDIENCE FILTER
// ==================================================

feedMyBranchBtn.addEventListener("click", function () {
    studentFeedMode = "my-branch";
    updateStudentFeedToggleUI();
    renderNotices();
});

feedAllBtn.addEventListener("click", function () {
    studentFeedMode = "all";
    updateStudentFeedToggleUI();
    renderNotices();
});

facultyAudienceFilter.addEventListener("change", function (e) {
    facultyAudienceFilterValue = e.target.value;
    renderNotices();
});


// ==================================================
// 16. ATTACHMENT MODAL HELPERS & PREVIEW
// ==================================================

function isPreviewable(fileType, fileName) {
    const isImg = (fileType && fileType.startsWith("image/")) || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(fileName || "");
    const isPdf = fileType === "application/pdf" || /\.pdf$/i.test(fileName || "");
    return isImg || isPdf;
}

function getFileIcon(fileName, fileType) {
    const name = (fileName || "").toLowerCase();
    const type = (fileType || "").toLowerCase();

    if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name)) return "🖼️";
    if (type === "application/pdf" || name.endsWith(".pdf")) return "📕";
    if (name.match(/\.(doc|docx)$/i)) return "📘";
    if (name.match(/\.(ppt|pptx)$/i)) return "📙";
    if (name.match(/\.(xls|xlsx)$/i)) return "📗";
    if (name.match(/\.zip$/i)) return "🗜️";
    return "📄";
}

function renderAttachmentPreview(fileOrBlob, meta) {
    if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = null;
    }

    attachmentPreview.classList.remove("hidden");
    attachmentInputWrapper.classList.add("hidden");

    previewFileName.textContent = meta.name;
    previewFileSize.textContent = formatFileSize(meta.size);
    previewMediaContainer.innerHTML = "";

    const isImage = meta.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(meta.name);
    if (isImage) {
        if (fileOrBlob instanceof Blob || fileOrBlob instanceof File) {
            previewObjectUrl = URL.createObjectURL(fileOrBlob);
            const img = document.createElement("img");
            img.src = previewObjectUrl;
            img.alt = meta.name;
            img.className = "w-full h-full object-cover";
            previewMediaContainer.appendChild(img);
        } else {
            previewMediaContainer.innerHTML = '<span class="text-base">🖼️</span>';
            getFile(meta.id).then(function (blob) {
                if (blob && !attachmentPreview.classList.contains("hidden")) {
                    previewObjectUrl = URL.createObjectURL(blob);
                    previewMediaContainer.innerHTML = "";
                    const img = document.createElement("img");
                    img.src = previewObjectUrl;
                    img.alt = meta.name;
                    img.className = "w-full h-full object-cover";
                    previewMediaContainer.appendChild(img);
                }
            });
        }
    } else {
        const icon = getFileIcon(meta.name, meta.type);
        previewMediaContainer.innerHTML = `<span class="text-xl">${icon}</span>`;
    }
}

function resetAttachmentInput() {
    if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = null;
    }
    currentAttachmentFile = null;
    currentAttachmentMeta = null;
    if (noticeAttachment) noticeAttachment.value = "";
    if (attachmentPreview) attachmentPreview.classList.add("hidden");
    if (attachmentInputWrapper) attachmentInputWrapper.classList.remove("hidden");
    if (previewMediaContainer) previewMediaContainer.innerHTML = "";
}

noticeAttachment.addEventListener("change", function (e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB limit
    if (file.size > MAX_SIZE) {
        showToast("File must be 10 MB or less");
        noticeAttachment.value = "";
        return;
    }

    if (currentAttachmentMeta && !currentAttachmentFile && currentAttachmentMeta.id) {
        pendingDeletedAttachmentId = currentAttachmentMeta.id;
    }

    currentAttachmentFile = file;
    currentAttachmentMeta = {
        id: "file_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size
    };

    renderAttachmentPreview(currentAttachmentFile, currentAttachmentMeta);
});

removeAttachmentBtn.addEventListener("click", function () {
    if (currentAttachmentMeta && !currentAttachmentFile && currentAttachmentMeta.id) {
        pendingDeletedAttachmentId = currentAttachmentMeta.id;
    }
    resetAttachmentInput();
});


// ==================================================
// 17. CATEGORY STYLE & HTML / JS ESCAPING
// ==================================================

const defaultCategoryColors = {
    "Placements": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "Exams": "bg-rose-50 text-rose-700 border-rose-200",
    "Hackathons": "bg-indigo-50 text-indigo-700 border-indigo-200",
    "Cultural": "bg-amber-50 text-amber-700 border-amber-200"
};

const customCategoryPalette = [
    "bg-sky-50 text-sky-700 border-sky-200",
    "bg-violet-50 text-violet-700 border-violet-200",
    "bg-teal-50 text-teal-700 border-teal-200",
    "bg-pink-50 text-pink-700 border-pink-200",
    "bg-cyan-50 text-cyan-700 border-cyan-200",
    "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    "bg-orange-50 text-orange-700 border-orange-200",
    "bg-lime-50 text-lime-700 border-lime-200"
];

function getCategoryStyle(category) {
    if (defaultCategoryColors[category]) {
        return defaultCategoryColors[category];
    }
    if (!category) return "bg-slate-100 text-slate-700 border-slate-200";
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
        hash = (hash << 5) - hash + category.charCodeAt(i);
        hash |= 0;
    }
    const idx = Math.abs(hash) % customCategoryPalette.length;
    return customCategoryPalette[idx];
}

function renderCategoryFiltersAndDropdowns() {
    // 1. Render Filter Pills in filterContainer
    if (filterContainer) {
        filterContainer.innerHTML = "";

        // All Categories pill
        const allBtn = document.createElement("button");
        allBtn.className = `filter-pill ${currentFilter === "All" ? "active-pill" : ""}`;
        allBtn.dataset.category = "All";
        allBtn.textContent = "All Categories";
        filterContainer.appendChild(allBtn);

        // Individual category pills
        campusCategories.forEach(function (cat) {
            const pill = document.createElement("button");
            pill.className = `filter-pill ${currentFilter === cat ? "active-pill" : ""}`;
            pill.dataset.category = cat;
            pill.textContent = cat;
            filterContainer.appendChild(pill);
        });

        // Student-Only "★ Saved" pill
        const savedBtn = document.createElement("button");
        savedBtn.id = "savedFilterPill";
        savedBtn.className = `filter-pill student-only ${currentFilter === "Saved" ? "active-pill" : ""}`;
        savedBtn.dataset.category = "Saved";
        savedBtn.textContent = "★ Saved";
        filterContainer.appendChild(savedBtn);

        // Faculty-Only "➕ New Category" button
        const addCatBtn = document.createElement("button");
        addCatBtn.id = "openAddCategoryBtn";
        addCatBtn.type = "button";
        addCatBtn.className = "filter-pill faculty-only border-dashed border-indigo-400 text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100 hover:border-indigo-600 font-semibold cursor-pointer";
        addCatBtn.title = "Create a new announcement category";
        addCatBtn.innerHTML = `<span>➕</span><span>New Category</span>`;
        addCatBtn.addEventListener("click", openCategoryModal);
        filterContainer.appendChild(addCatBtn);
    }

    // 2. Render Options in noticeCategory Select Dropdown
    if (noticeCategory) {
        const previousValue = noticeCategory.value;
        noticeCategory.innerHTML = "";

        campusCategories.forEach(function (cat) {
            const opt = document.createElement("option");
            opt.value = cat;
            opt.textContent = cat;
            noticeCategory.appendChild(opt);
        });

        const newOpt = document.createElement("option");
        newOpt.value = "__NEW_CATEGORY__";
        newOpt.textContent = "➕ Add New Category...";
        noticeCategory.appendChild(newOpt);

        if (previousValue && campusCategories.includes(previousValue)) {
            noticeCategory.value = previousValue;
        } else if (campusCategories.length > 0) {
            noticeCategory.value = campusCategories[0];
        }
    }
}

function openCategoryModal() {
    if (categoryModal) {
        newCategoryName.value = "";
        categoryError.textContent = "";
        categoryError.classList.add("hidden");
        categoryModal.classList.remove("hidden");
        categoryModal.classList.add("flex");
        setTimeout(function () {
            newCategoryName.focus();
        }, 60);
    }
}

function closeCategoryModal() {
    if (categoryModal) {
        categoryModal.classList.add("hidden");
        categoryModal.classList.remove("flex");
        newCategoryName.value = "";
        categoryError.textContent = "";
        categoryError.classList.add("hidden");
    }
}

function escapeHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeJs(text) {
    if (!text) return "";
    return String(text)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r");
}


// ==================================================
// 18. MAIN RENDER FUNCTION WITH AUDIENCE FILTERING
// ==================================================

function renderNotices() {
    let audienceFilteredNotices = [...notices];
    const upvotedIds = getUpvotedNoticeIds();
    const bookmarkedIds = getBookmarkedNoticeIds();

    // 1. Audience / Branch Filtering
    if (currentRole === "student" && currentSession && currentSession.branch) {
        const studentBranch = currentSession.branch;

        if (studentFeedMode === "my-branch") {
            audienceFilteredNotices = audienceFilteredNotices.filter(function (notice) {
                if (!notice.audience || notice.audience.type === "all") {
                    return true;
                }
                return Array.isArray(notice.audience.branches) && notice.audience.branches.includes(studentBranch);
            });
        }
        // When studentFeedMode === "all", student sees all campus notices

    } else if (currentRole === "faculty") {
        if (facultyAudienceFilterValue === "campus-wide") {
            audienceFilteredNotices = audienceFilteredNotices.filter(function (notice) {
                return !notice.audience || notice.audience.type === "all";
            });
        } else if (facultyAudienceFilterValue !== "all") {
            // Specific branch selected by faculty
            audienceFilteredNotices = audienceFilteredNotices.filter(function (notice) {
                if (!notice.audience || notice.audience.type === "all") return true;
                return Array.isArray(notice.audience.branches) && notice.audience.branches.includes(facultyAudienceFilterValue);
            });
        }
    }

    // Update Global Counters based on active branch / audience view
    if (totalCount) totalCount.textContent = audienceFilteredNotices.length;

    const trendingNotices = audienceFilteredNotices.filter(function (notice) {
        return (notice.upvotes || 0) >= 30;
    });
    if (trendingCount) trendingCount.textContent = trendingNotices.length;

    // 2. Category Filter
    let filteredNotices = [...audienceFilteredNotices];
    if (currentFilter === "Saved") {
        filteredNotices = filteredNotices.filter(function (notice) {
            return bookmarkedIds.includes(notice.id);
        });
    } else if (currentFilter !== "All") {
        filteredNotices = filteredNotices.filter(function (notice) {
            return notice.category === currentFilter;
        });
    }

    // 3. Search Filter
    if (searchText !== "") {
        const query = searchText.toLowerCase();
        filteredNotices = filteredNotices.filter(function (notice) {
            const titleMatch = notice.title.toLowerCase().includes(query);
            const descriptionMatch = notice.description.toLowerCase().includes(query);
            const authorMatch = notice.author.toLowerCase().includes(query);
            return titleMatch || descriptionMatch || authorMatch;
        });
    }

    // 4. Sorting
    if (currentSort === "upvotes") {
        filteredNotices.sort(function (a, b) {
            return (b.upvotes || 0) - (a.upvotes || 0);
        });
    } else {
        filteredNotices.sort(function (a, b) {
            return b.id - a.id;
        });
    }

    // 5. Empty State
    if (filteredNotices.length === 0) {
        cardsGrid.innerHTML = "";
        emptyState.classList.remove("hidden");

        if (currentFilter === "Saved") {
            if (emptyTitle) emptyTitle.textContent = "No saved announcements";
            if (emptyDesc) emptyDesc.textContent = "Click the '☆ Save' button on any notice card to bookmark it here for quick access.";
        } else {
            if (emptyTitle) emptyTitle.textContent = "No announcements found";
            if (emptyDesc) emptyDesc.textContent = "Try switching feed view or choosing another category filter.";
        }
        return;
    }

    emptyState.classList.add("hidden");

    // 6. Generate Notice Cards
    const cards = filteredNotices.map(function (notice) {
        const categoryStyle = getCategoryStyle(notice.category);

        let trendingBadge = "";
        if ((notice.upvotes || 0) >= 30) {
            trendingBadge = `
                <span class="text-[10px] font-bold bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                    🔥 TRENDING
                </span>
            `;
        }

        // Audience Badge (Short codes on cards e.g. "CSE · AIML" or "All Branches")
        let audienceBadge = "";
        const audienceObj = notice.audience || { type: "all", branches: [] };
        if (audienceObj.type === "branches" && Array.isArray(audienceObj.branches) && audienceObj.branches.length > 0) {
            audienceBadge = `
                <span class="text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs" title="Targeted to: ${escapeHtml(audienceObj.branches.map(getBranchFullName).join(', '))}">
                    🎯 ${escapeHtml(audienceObj.branches.join(" · "))}
                </span>
            `;
        } else {
            audienceBadge = `
                <span class="text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                    👥 All Branches
                </span>
            `;
        }

        let facultyBadge = "";
        if (notice.postedBy) {
            facultyBadge = `
                <span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200 font-medium">
                    Faculty Post
                </span>
            `;
        }

        // Attachment Slot with "👁 View" and "⬇ Download" buttons (No auto-download on click)
        let attachmentSlotHtml = "";
        if (notice.attachment && notice.attachment.id) {
            const canPreview = isPreviewable(notice.attachment.type, notice.attachment.name);
            const icon = getFileIcon(notice.attachment.name, notice.attachment.type);

            let actionButtonsHtml = "";

            if (canPreview) {
                actionButtonsHtml = `
                    <div class="flex items-center gap-2 pt-2 border-t border-slate-200/70">
                        <button
                            onclick="openFileViewer('${escapeHtml(notice.attachment.id)}', '${escapeJs(notice.attachment.name)}', '${escapeJs(notice.attachment.type)}', ${notice.attachment.size})"
                            type="button"
                            class="flex-1 bg-white hover:bg-indigo-50 text-brand-700 hover:text-brand-800 border border-slate-200 hover:border-indigo-300 font-semibold text-xs py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1 shadow-2xs"
                            title="Preview file inside website"
                        >
                            <span>👁</span>
                            <span>View</span>
                        </button>

                        <button
                            onclick="downloadAttachment('${escapeHtml(notice.attachment.id)}', '${escapeJs(notice.attachment.name)}')"
                            type="button"
                            class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1 shadow-2xs"
                            title="Download original file"
                        >
                            <span>⬇</span>
                            <span>Download</span>
                        </button>
                    </div>
                `;
            } else {
                actionButtonsHtml = `
                    <div class="pt-2 border-t border-slate-200/70">
                        <p class="text-[10px] text-slate-400 italic mb-1.5">
                            Preview not available for this file type
                        </p>
                        <button
                            onclick="downloadAttachment('${escapeHtml(notice.attachment.id)}', '${escapeJs(notice.attachment.name)}')"
                            type="button"
                            class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1 shadow-2xs"
                            title="Download original file"
                        >
                            <span>⬇</span>
                            <span>Download (${formatFileSize(notice.attachment.size)})</span>
                        </button>
                    </div>
                `;
            }

            attachmentSlotHtml = `
                <div class="notice-attachment-slot mt-3 border border-slate-200 bg-slate-50/80 rounded-xl p-2.5">
                    <div class="flex items-center gap-2 overflow-hidden mb-2">
                        <span class="text-xl flex-shrink-0">${icon}</span>
                        <div class="overflow-hidden">
                            <span class="text-xs font-semibold text-slate-800 truncate block">
                                ${escapeHtml(notice.attachment.name)}
                            </span>
                            <span class="text-[10px] text-slate-400">
                                ${formatFileSize(notice.attachment.size)}
                            </span>
                        </div>
                    </div>
                    ${actionButtonsHtml}
                </div>
            `;
        }

        // Role-Aware Card Actions
        let cardActionsHtml = "";

        if (currentRole === "student") {
            const isUpvoted = upvotedIds.includes(notice.id);
            const isBookmarked = bookmarkedIds.includes(notice.id);

            const upvoteBtnClass = isUpvoted
                ? "bg-indigo-600 text-white font-semibold text-xs sm:text-sm px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm cursor-default"
                : "bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-brand-600 font-semibold text-xs sm:text-sm px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer";

            const upvoteBtnText = isUpvoted
                ? `↑ Upvoted <span class="ml-1 font-bold bg-indigo-700/60 text-white px-1.5 py-0.2 rounded">${notice.upvotes}</span>`
                : `↑ Upvote <span class="ml-1 font-bold">${notice.upvotes}</span>`;

            const bookmarkBtnClass = isBookmarked
                ? "bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold text-xs sm:text-sm px-3 py-1.5 rounded-xl transition flex items-center gap-1"
                : "bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 font-semibold text-xs sm:text-sm px-3 py-1.5 rounded-xl transition flex items-center gap-1";

            const bookmarkBtnText = isBookmarked ? "★ Saved" : "☆ Save";

            cardActionsHtml = `
                <div class="flex items-center gap-2">
                    <button
                        onclick="upvoteNotice(${notice.id})"
                        class="${upvoteBtnClass}"
                        title="${isUpvoted ? 'You have upvoted this notice' : 'Upvote notice'}"
                    >
                        ${upvoteBtnText}
                    </button>

                    <button
                        onclick="toggleBookmark(${notice.id})"
                        class="${bookmarkBtnClass}"
                        title="${isBookmarked ? 'Remove from saved' : 'Bookmark notice'}"
                    >
                        ${bookmarkBtnText}
                    </button>
                </div>
            `;
        } else if (currentRole === "faculty") {
            const isEditable = canFacultyEdit(notice);

            let editDeleteButtons = "";
            if (isEditable) {
                editDeleteButtons = `
                    <div class="flex items-center gap-1.5">
                        <button
                            onclick="editNotice(${notice.id})"
                            class="bg-slate-100 hover:bg-indigo-50 text-indigo-700 font-semibold text-xs px-2.5 py-1.5 rounded-xl border border-indigo-200 transition flex items-center gap-1"
                            title="Edit this announcement"
                        >
                            ✏️ Edit
                        </button>
                        <button
                            onclick="deleteNotice(${notice.id})"
                            class="bg-slate-100 hover:bg-rose-50 text-rose-700 font-semibold text-xs px-2.5 py-1.5 rounded-xl border border-rose-200 transition flex items-center gap-1"
                            title="Delete this announcement"
                        >
                            🗑️ Delete
                        </button>
                    </div>
                `;
            } else {
                editDeleteButtons = `
                    <span class="text-[11px] text-slate-400 italic">
                        Posted by ${escapeHtml(notice.postedBy)}
                    </span>
                `;
            }

            cardActionsHtml = `
                <div class="flex items-center justify-between w-full gap-2">
                    <button
                        onclick="upvoteNotice(${notice.id})"
                        class="bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-brand-600 font-semibold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1"
                        title="Upvote announcement"
                    >
                        ↑ Upvotes <span class="ml-1 font-bold text-brand-600">${notice.upvotes}</span>
                    </button>

                    ${editDeleteButtons}
                </div>
            `;
        }

        return `
            <article class="notice-card bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
                <div>
                    <!-- Category, Audience & Trending Header -->
                    <div class="flex items-center justify-between gap-2 mb-3">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="text-xs font-bold px-2.5 py-1 rounded-lg border ${categoryStyle}">
                                ${escapeHtml(notice.category)}
                            </span>
                            ${audienceBadge}
                            ${trendingBadge}
                        </div>
                        <span class="text-xs text-slate-400 font-medium">
                            ${escapeHtml(notice.date)}
                        </span>
                    </div>

                    <!-- Notice Title -->
                    <h3 class="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                        ${escapeHtml(notice.title)}
                    </h3>

                    <!-- Notice Description -->
                    <p class="text-sm text-slate-600 mt-2.5 leading-relaxed">
                        ${escapeHtml(notice.description)}
                    </p>

                    <!-- Attachment Slot -->
                    ${attachmentSlotHtml}
                </div>

                <div>
                    <!-- Author & Origin -->
                    <div class="flex items-center justify-between text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
                        <span class="font-medium text-slate-500 truncate max-w-[200px]" title="${escapeHtml(notice.author)}">
                            👤 ${escapeHtml(notice.author)}
                        </span>
                        ${facultyBadge}
                    </div>

                    <!-- Card Action Footer -->
                    <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                        ${cardActionsHtml}
                        <span class="text-[11px] text-slate-400 font-mono">
                            #${notice.id}
                        </span>
                    </div>
                </div>
            </article>
        `;
    });

    cardsGrid.innerHTML = cards.join("");
}


// ==================================================
// 19. UPVOTE & BOOKMARK INTERACTIONS
// ==================================================

function upvoteNotice(id) {
    const session = getSession();
    if (!session) {
        showToast("Please log in to upvote notices.");
        return;
    }

    const upvotedIds = getUpvotedNoticeIds();

    if (currentRole === "student") {
        if (upvotedIds.includes(id)) {
            showToast("You have already upvoted this announcement.");
            return;
        }
        upvotedIds.push(id);
        saveUpvotedNoticeIds(upvotedIds);
    }

    const notice = notices.find(function (n) {
        return n.id === id;
    });

    if (notice) {
        notice.upvotes = (Number(notice.upvotes) || 0) + 1;
        saveNotices();
        updateFacultyDashboard();
        renderNotices();
        showToast("Upvote recorded!");
    }
}

function toggleBookmark(id) {
    const session = getSession();
    if (!session || session.role !== "student") {
        showToast("Only students can bookmark announcements.");
        return;
    }

    let bookmarkedIds = getBookmarkedNoticeIds();

    if (bookmarkedIds.includes(id)) {
        bookmarkedIds = bookmarkedIds.filter(function (noticeId) {
            return noticeId !== id;
        });
        saveBookmarkedNoticeIds(bookmarkedIds);
        showToast("Announcement removed from saved.");
    } else {
        bookmarkedIds.push(id);
        saveBookmarkedNoticeIds(bookmarkedIds);
        showToast("Announcement bookmarked to '★ Saved'!");
    }

    renderNotices();
}


// ==================================================
// 20. IN-WEBSITE FILE VIEWER (PDF.JS + IMAGE VIEWER)
// ==================================================

async function openFileViewer(fileId, fileName, fileType, fileSize) {
    currentViewerFileName = fileName;
    currentViewerFileType = fileType;
    currentViewerFileSize = fileSize;

    viewerFileName.textContent = fileName;
    viewerFileSize.textContent = formatFileSize(fileSize);
    viewerFileIcon.textContent = getFileIcon(fileName, fileType);

    fileViewerBody.scrollTop = 0;
    fileViewerContent.innerHTML = "";
    fileViewerContent.classList.add("hidden");
    viewerErrorState.classList.add("hidden");
    viewerPdfControls.classList.add("hidden");
    viewerPdfControls.classList.remove("flex");
    viewerLoadingSpinner.classList.remove("hidden");

    fileViewerModal.classList.remove("hidden");
    fileViewerModal.classList.add("flex");

    try {
        const blob = await getFile(fileId);

        if (!blob) {
            showViewerError("File not found in local browser storage or server.");
            return;
        }

        currentViewerBlob = blob;
        currentViewerUrl = URL.createObjectURL(blob);

        const isImage = (fileType && fileType.startsWith("image/")) || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(fileName);
        const isPdf = fileType === "application/pdf" || /\.pdf$/i.test(fileName);

        if (isImage) {
            renderImageViewer(blob, fileName);
        } else if (isPdf) {
            await renderPdfViewer(blob);
        } else {
            showViewerError("Preview not available for this file type. Please download the file to view.");
        }

    } catch (err) {
        console.error("Error opening file viewer:", err);
        showViewerError("An unexpected error occurred while loading this attachment.");
    }
}

function renderImageViewer(blob, fileName) {
    fileViewerContent.innerHTML = "";
    fileViewerContent.className = "w-full min-h-full flex flex-col items-center justify-center p-2 relative my-auto";

    const img = document.createElement("img");
    img.src = currentViewerUrl;
    img.alt = fileName;
    img.className = "max-h-[80vh] max-w-full object-contain rounded-xl cursor-zoom-in transition-all duration-200 select-none shadow-xl";
    img.title = "Click to zoom in / fit screen";

    let isZoomed = false;
    img.addEventListener("click", function (e) {
        e.stopPropagation();
        isZoomed = !isZoomed;
        if (isZoomed) {
            img.className = "max-w-none w-auto cursor-zoom-out transition-all duration-200 select-none shadow-2xl my-auto";
            showToast("Zoomed in. Click again to fit screen.");
        } else {
            img.className = "max-h-[80vh] max-w-full object-contain rounded-xl cursor-zoom-in transition-all duration-200 select-none shadow-xl";
        }
    });

    const hint = document.createElement("p");
    hint.className = "text-[11px] text-slate-400 mt-2 text-center pointer-events-none";
    hint.textContent = "💡 Click image to zoom in / fit screen";

    fileViewerContent.appendChild(img);
    fileViewerContent.appendChild(hint);

    viewerLoadingSpinner.classList.add("hidden");
    fileViewerContent.classList.remove("hidden");
}

async function renderPdfViewer(blob) {
    viewerPdfControls.classList.remove("hidden");
    viewerPdfControls.classList.add("flex");
    fileViewerContent.innerHTML = "";
    fileViewerContent.className = "w-full max-w-3xl flex flex-col items-center justify-start py-4";
    fileViewerBody.scrollTop = 0;

    renderedPdfPages.clear();
    currentPdfZoom = 1.0;
    updateZoomDisplay();

    try {
        const arrayBuffer = await blob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        currentPdfDoc = await loadingTask.promise;

        const totalPages = currentPdfDoc.numPages;
        viewerPageIndicator.textContent = `Page 1 / ${totalPages}`;

        // Create canvas placeholder containers for all pages
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const pageContainer = document.createElement("div");
            pageContainer.id = `pdf-page-container-${pageNum}`;
            pageContainer.className = "pdf-page-container mb-6 bg-white rounded-lg overflow-hidden border border-slate-700/60 shadow-lg relative flex items-center justify-center min-h-[350px] w-full";
            pageContainer.dataset.pageNum = pageNum;

            pageContainer.innerHTML = `
                <div class="pdf-page-loading text-xs text-slate-400 flex items-center gap-2 py-16">
                    <div class="w-4 h-4 border-2 border-slate-400 border-t-brand-500 rounded-full animate-spin"></div>
                    <span>Rendering page ${pageNum}...</span>
                </div>
                <canvas id="pdf-canvas-${pageNum}" class="hidden"></canvas>
            `;

            fileViewerContent.appendChild(pageContainer);
        }

        viewerLoadingSpinner.classList.add("hidden");
        fileViewerContent.classList.remove("hidden");
        fileViewerBody.scrollTop = 0;

        setupPdfLazyRendering();

    } catch (pdfErr) {
        console.error("PDF.js document parsing error:", pdfErr);
        showViewerError("Could not render PDF document. The file may be damaged or password protected.");
    }
}

function updatePdfPageIndicator() {
    if (!currentPdfDoc || !viewerPageIndicator) return;
    const containers = fileViewerContent.querySelectorAll(".pdf-page-container");
    if (!containers || containers.length === 0) return;

    const bodyRect = fileViewerBody.getBoundingClientRect();
    const thresholdY = bodyRect.top + 100;

    let activePage = 1;
    for (let i = 0; i < containers.length; i++) {
        const rect = containers[i].getBoundingClientRect();
        const pageNum = parseInt(containers[i].dataset.pageNum, 10);
        if (rect.top <= thresholdY && rect.bottom > bodyRect.top) {
            activePage = pageNum;
        } else if (rect.top > thresholdY && i === 0) {
            activePage = 1;
            break;
        }
    }
    viewerPageIndicator.textContent = `Page ${activePage} / ${currentPdfDoc.numPages}`;
}

function setupPdfLazyRendering() {
    if (pdfIntersectionObserver) {
        pdfIntersectionObserver.disconnect();
    }

    fileViewerBody.removeEventListener("scroll", updatePdfPageIndicator);
    fileViewerBody.addEventListener("scroll", updatePdfPageIndicator, { passive: true });

    pdfIntersectionObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            const pageNum = parseInt(entry.target.dataset.pageNum, 10);

            if (entry.isIntersecting) {
                if (!renderedPdfPages.has(pageNum)) {
                    renderPdfPage(pageNum);
                }
            }
        });
        updatePdfPageIndicator();
    }, {
        root: fileViewerBody,
        rootMargin: "300px 0px 300px 0px",
        threshold: 0.1
    });

    const pageContainers = fileViewerContent.querySelectorAll(".pdf-page-container");
    pageContainers.forEach(function (container) {
        pdfIntersectionObserver.observe(container);
    });

    // Reset scroll to top and render page 1 immediately
    fileViewerBody.scrollTop = 0;
    viewerPageIndicator.textContent = `Page 1 / ${currentPdfDoc.numPages}`;
    renderPdfPage(1);

    requestAnimationFrame(() => {
        fileViewerBody.scrollTop = 0;
        updatePdfPageIndicator();
    });
}

async function renderPdfPage(pageNum) {
    if (!currentPdfDoc || renderedPdfPages.has(pageNum)) return;
    renderedPdfPages.add(pageNum);

    const container = document.getElementById(`pdf-page-container-${pageNum}`);
    const canvas = document.getElementById(`pdf-canvas-${pageNum}`);
    if (!container || !canvas) return;

    try {
        const page = await currentPdfDoc.getPage(pageNum);

        // Fit width of fileViewerBody
        const containerWidth = Math.min(fileViewerBody.clientWidth - 48, 800) * currentPdfZoom;
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale: scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const ctx = canvas.getContext("2d");
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        await page.render(renderContext).promise;

        const loader = container.querySelector(".pdf-page-loading");
        if (loader) loader.classList.add("hidden");
        canvas.classList.remove("hidden");

    } catch (err) {
        console.error(`Error rendering PDF page ${pageNum}:`, err);
        renderedPdfPages.delete(pageNum);
    }
}

function updateZoomDisplay() {
    if (viewerZoomLevel) {
        viewerZoomLevel.textContent = `${Math.round(currentPdfZoom * 100)}%`;
    }
}

viewerZoomInBtn.addEventListener("click", function () {
    if (currentPdfZoom < 2.5) {
        currentPdfZoom = Math.min(2.5, currentPdfZoom + 0.25);
        updateZoomDisplay();
        rerenderAllPdfPages();
    }
});

viewerZoomOutBtn.addEventListener("click", function () {
    if (currentPdfZoom > 0.5) {
        currentPdfZoom = Math.max(0.5, currentPdfZoom - 0.25);
        updateZoomDisplay();
        rerenderAllPdfPages();
    }
});

function rerenderAllPdfPages() {
    renderedPdfPages.clear();
    const containers = fileViewerContent.querySelectorAll(".pdf-page-container");
    containers.forEach(function (container) {
        const loader = container.querySelector(".pdf-page-loading");
        const canvas = container.querySelector("canvas");
        if (loader) loader.classList.remove("hidden");
        if (canvas) canvas.classList.add("hidden");
    });
    if (pdfIntersectionObserver) {
        containers.forEach(container => {
            pdfIntersectionObserver.unobserve(container);
            pdfIntersectionObserver.observe(container);
        });
    }
    renderPdfPage(1);
    updatePdfPageIndicator();
}

function showViewerError(message) {
    viewerLoadingSpinner.classList.add("hidden");
    fileViewerContent.classList.add("hidden");
    viewerPdfControls.classList.add("hidden");
    viewerErrorMessage.textContent = message;
    viewerErrorState.classList.remove("hidden");
}

function closeFileViewer() {
    fileViewerModal.classList.add("hidden");
    fileViewerModal.classList.remove("flex");

    if (pdfIntersectionObserver) {
        pdfIntersectionObserver.disconnect();
        pdfIntersectionObserver = null;
    }

    fileViewerBody.removeEventListener("scroll", updatePdfPageIndicator);
    fileViewerBody.scrollTop = 0;

    if (currentViewerUrl) {
        URL.revokeObjectURL(currentViewerUrl);
        currentViewerUrl = null;
    }

    currentViewerBlob = null;
    currentPdfDoc = null;
    renderedPdfPages.clear();
    fileViewerContent.innerHTML = "";
}

closeViewerBtn.addEventListener("click", closeFileViewer);

fileViewerModal.addEventListener("click", function (e) {
    if (e.target === fileViewerModal || e.target === fileViewerBody) {
        closeFileViewer();
    }
});

document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
        if (categoryModal && !categoryModal.classList.contains("hidden")) {
            closeCategoryModal();
        } else if (!fileViewerModal.classList.contains("hidden")) {
            closeFileViewer();
        } else if (!studentProfileModal.classList.contains("hidden")) {
            closeProfileModal();
        } else if (!noticeModal.classList.contains("hidden")) {
            closeModal();
        }
    }
});

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

async function downloadAttachment(fileId, filename) {
    try {
        const blob = await getFile(fileId);
        if (!blob) {
            showToast("Attachment not found.");
            return;
        }
        downloadBlob(blob, filename);
        showToast(`Downloading ${filename}`);
    } catch (e) {
        console.error("Error downloading file:", e);
        showToast("Error downloading file.");
    }
}

viewerDownloadBtn.addEventListener("click", function () {
    if (currentViewerBlob && currentViewerFileName) {
        downloadBlob(currentViewerBlob, currentViewerFileName);
    }
});

viewerErrorDownloadBtn.addEventListener("click", function () {
    if (currentViewerBlob && currentViewerFileName) {
        downloadBlob(currentViewerBlob, currentViewerFileName);
    }
});


// ==================================================
// 21. POST / EDIT NOTICE MODAL LOGIC
// ==================================================

// Audience Radio Switching
audienceAll.addEventListener("change", function () {
    if (audienceAll.checked) {
        specificBranchesContainer.classList.add("hidden");
    }
});

audienceSpecific.addEventListener("change", function () {
    if (audienceSpecific.checked) {
        specificBranchesContainer.classList.remove("hidden");
    }
});

function openModal() {
    const session = getSession();
    if (!session || session.role !== "faculty") {
        showToast("Access denied: Only faculty can publish notices.");
        return;
    }

    editingNoticeId = null;
    modalTitle.textContent = "Post New Notice";
    modalSubmitBtn.textContent = "Publish Notice";
    noticeForm.reset();
    characterCount.textContent = "0 / 250";

    // Auto-fill author name from session
    if (campusUserName) {
        noticeAuthor.value = campusUserName;
    }

    // Default Audience: All branches
    audienceAll.checked = true;
    specificBranchesContainer.classList.add("hidden");
    const checkboxes = branchCheckboxesList.querySelectorAll("input[type='checkbox']");
    checkboxes.forEach(function (cb) { cb.checked = false; });

    resetAttachmentInput();
    pendingDeletedAttachmentId = null;

    noticeModal.classList.remove("hidden");
    noticeModal.classList.add("flex");
    noticeTitle.focus();
}

function closeModal() {
    noticeModal.classList.add("hidden");
    noticeModal.classList.remove("flex");

    editingNoticeId = null;
    noticeForm.reset();
    characterCount.textContent = "0 / 250";
    modalTitle.textContent = "Post New Notice";
    modalSubmitBtn.textContent = "Publish Notice";

    resetAttachmentInput();
    pendingDeletedAttachmentId = null;
}

function editNotice(id) {
    const session = getSession();
    if (!session || session.role !== "faculty") {
        showToast("Access denied: Only faculty can edit notices.");
        return;
    }

    const notice = notices.find(function (n) {
        return n.id === id;
    });

    if (!notice) return;

    if (!canFacultyEdit(notice)) {
        showToast("You can only edit announcements posted by you.");
        return;
    }

    editingNoticeId = notice.id;
    modalTitle.textContent = "Edit Notice";
    modalSubmitBtn.textContent = "Save Changes";

    noticeTitle.value = notice.title;
    if (notice.category && !campusCategories.includes(notice.category)) {
        campusCategories.push(notice.category);
        saveCategories(campusCategories);
        renderCategoryFiltersAndDropdowns();
    }
    noticeCategory.value = notice.category;
    noticeAuthor.value = notice.author;
    noticeDescription.value = notice.description;
    characterCount.textContent = `${notice.description.length} / 250`;

    // Pre-fill audience
    const audience = notice.audience || { type: "all", branches: [] };
    const checkboxes = branchCheckboxesList.querySelectorAll("input[type='checkbox']");

    if (audience.type === "branches" && Array.isArray(audience.branches) && audience.branches.length > 0) {
        audienceSpecific.checked = true;
        specificBranchesContainer.classList.remove("hidden");
        checkboxes.forEach(function (cb) {
            cb.checked = audience.branches.includes(cb.value);
        });
    } else {
        audienceAll.checked = true;
        specificBranchesContainer.classList.add("hidden");
        checkboxes.forEach(function (cb) {
            cb.checked = false;
        });
    }

    // Handle existing attachment in edit mode
    pendingDeletedAttachmentId = null;
    if (notice.attachment && notice.attachment.id) {
        currentAttachmentMeta = { ...notice.attachment };
        currentAttachmentFile = null;
        renderAttachmentPreview(null, currentAttachmentMeta);
    } else {
        resetAttachmentInput();
    }

    noticeModal.classList.remove("hidden");
    noticeModal.classList.add("flex");
    noticeTitle.focus();
}

async function deleteNotice(id) {
    const session = getSession();
    if (!session || session.role !== "faculty") {
        showToast("Access denied: Only faculty can delete notices.");
        return;
    }

    const notice = notices.find(function (n) {
        return n.id === id;
    });

    if (!notice) return;

    if (!canFacultyEdit(notice)) {
        showToast("You can only delete announcements posted by you.");
        return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete the notice "${notice.title}"?`);
    if (!confirmed) return;

    if (notice.attachment && notice.attachment.id) {
        try {
            await deleteFile(notice.attachment.id);
        } catch (e) {
            console.error("Error deleting attachment:", e);
        }
    }

    notices = notices.filter(function (n) {
        return n.id !== id;
    });

    saveNotices();
    updateFacultyDashboard();
    renderNotices();
    showToast("Announcement deleted successfully.");
}

// Notice Form Submit (Create or Edit Notice)
noticeForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const session = getSession();
    if (!session || session.role !== "faculty") {
        showToast("Access denied: Only faculty can publish or edit notices.");
        return;
    }

    const title = noticeTitle.value.trim();
    const category = noticeCategory.value;
    const author = noticeAuthor.value.trim();
    const description = noticeDescription.value.trim();

    if (!title || !author || !description) {
        showToast("Please complete all required fields.");
        return;
    }

    // Determine Audience Selection
    let audienceData = { type: "all", branches: [] };
    if (audienceSpecific.checked) {
        const checkedBoxes = Array.from(branchCheckboxesList.querySelectorAll("input[type='checkbox']:checked"));
        const selectedBranches = checkedBoxes.map(function (cb) { return cb.value; });

        if (selectedBranches.length === 0) {
            showToast("Please select at least one branch for specific audience.");
            return;
        }

        audienceData = {
            type: "branches",
            branches: selectedBranches
        };
    }

    try {
        if (pendingDeletedAttachmentId) {
            await deleteFile(pendingDeletedAttachmentId);
            pendingDeletedAttachmentId = null;
        }

        if (currentAttachmentFile && currentAttachmentMeta) {
            await saveFile(currentAttachmentMeta.id, currentAttachmentFile);
        }
    } catch (storageErr) {
        console.error("Attachment storage error:", storageErr);
        showToast("Storage error: Failed to save attachment.");
    }

    let finalAttachmentMeta = null;
    if (currentAttachmentMeta) {
        finalAttachmentMeta = {
            id: currentAttachmentMeta.id,
            name: currentAttachmentMeta.name,
            type: currentAttachmentMeta.type,
            size: currentAttachmentMeta.size
        };
    }

    if (editingNoticeId) {
        // EDIT EXISTING NOTICE
        const existingNotice = notices.find(function (n) {
            return n.id === editingNoticeId;
        });

        if (existingNotice) {
            if (!canFacultyEdit(existingNotice)) {
                showToast("Permission denied: You do not own this notice.");
                closeModal();
                return;
            }

            existingNotice.title = title;
            existingNotice.category = category;
            existingNotice.author = author;
            existingNotice.description = description;
            existingNotice.audience = audienceData;
            existingNotice.attachment = finalAttachmentMeta;

            saveNotices();
            updateFacultyDashboard();
            renderNotices();
            closeModal();
            showToast("Announcement updated successfully!");
        }
    } else {
        // CREATE NEW NOTICE
        const newNotice = {
            id: Date.now(),
            title: title,
            category: category,
            description: description,
            author: author,
            postedBy: campusUserName,
            authorRole: "faculty",
            date: new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
            }),
            upvotes: 0,
            audience: audienceData,
            attachment: finalAttachmentMeta
        };

        notices.unshift(newNotice);
        saveNotices();
        updateFacultyDashboard();
        renderNotices();
        closeModal();
        showToast("Announcement published successfully!");
    }
});


// ==================================================
// 22. SEARCH, SORT & CATEGORY EVENTS
// ==================================================

filterContainer.addEventListener("click", function (event) {
    const pill = event.target.closest(".filter-pill");
    if (!pill || pill.id === "openAddCategoryBtn") return;
    if (!pill.dataset.category) return;

    const allPills = filterContainer.querySelectorAll(".filter-pill");
    allPills.forEach(function (btn) {
        btn.classList.remove("active-pill");
    });
    pill.classList.add("active-pill");

    currentFilter = pill.dataset.category;
    renderNotices();
});

let previousNoticeCategory = noticeCategory.value;
noticeCategory.addEventListener("focus", function () {
    if (this.value !== "__NEW_CATEGORY__") {
        previousNoticeCategory = this.value;
    }
});

noticeCategory.addEventListener("change", function () {
    if (this.value === "__NEW_CATEGORY__") {
        this.value = previousNoticeCategory;
        openCategoryModal();
    } else {
        previousNoticeCategory = this.value;
    }
});

if (inlineAddCategoryBtn) {
    inlineAddCategoryBtn.addEventListener("click", function (e) {
        e.preventDefault();
        openCategoryModal();
    });
}

if (closeCategoryModalBtn) closeCategoryModalBtn.addEventListener("click", closeCategoryModal);
if (cancelCategoryBtn) cancelCategoryBtn.addEventListener("click", closeCategoryModal);
if (categoryModal) {
    categoryModal.addEventListener("click", function (e) {
        if (e.target === categoryModal) {
            closeCategoryModal();
        }
    });
}

if (categoryForm) {
    categoryForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const raw = newCategoryName.value.trim();
        if (!raw) {
            categoryError.textContent = "Please enter a category name.";
            categoryError.classList.remove("hidden");
            return;
        }

        if (raw.length > 30) {
            categoryError.textContent = "Category name must be 30 characters or less.";
            categoryError.classList.remove("hidden");
            return;
        }

        if (raw.toLowerCase() === "all" || raw.toLowerCase() === "saved") {
            categoryError.textContent = `"${raw}" is a reserved system name.`;
            categoryError.classList.remove("hidden");
            return;
        }

        // Title Case format
        const formatted = raw.replace(/\w\S*/g, function (txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1);
        });

        const exists = campusCategories.some(function (c) {
            return c.toLowerCase() === formatted.toLowerCase();
        });

        if (exists) {
            categoryError.textContent = `Category "${formatted}" already exists.`;
            categoryError.classList.remove("hidden");
            return;
        }

        campusCategories.push(formatted);
        saveCategories(campusCategories);
        renderCategoryFiltersAndDropdowns();

        // If notice modal is open, select the newly created category immediately
        if (!noticeModal.classList.contains("hidden")) {
            noticeCategory.value = formatted;
            previousNoticeCategory = formatted;
        }

        closeCategoryModal();
        showToast(`Category "${formatted}" created successfully!`);
    });
}

searchInput.addEventListener("input", function (event) {
    searchText = event.target.value.trim();
    renderNotices();
});

clearSearchBtn.addEventListener("click", function () {
    searchInput.value = "";
    searchText = "";
    renderNotices();
    searchInput.focus();
});

sortSelect.addEventListener("change", function (event) {
    currentSort = event.target.value;
    renderNotices();
});

openModalBtn.addEventListener("click", openModal);
closeModalBtn.addEventListener("click", closeModal);
cancelModalBtn.addEventListener("click", closeModal);

noticeDescription.addEventListener("input", function (event) {
    const len = event.target.value.length;
    characterCount.textContent = `${len} / 250`;
});

noticeModal.addEventListener("click", function (event) {
    if (event.target === noticeModal) {
        closeModal();
    }
});


// ==================================================
// 23. TOAST NOTIFICATION
// ==================================================

function showToast(message) {
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    toastMessage.textContent = message;
    toast.classList.remove("hidden");

    toastTimeout = setTimeout(function () {
        toast.classList.add("hidden");
    }, 2800);
}


// ==================================================
// 24. INITIAL APPLICATION BOOTSTRAP & SYNC
// ==================================================

console.log("Campus Voice Portal Loaded with Hybrid Cross-Browser Storage.");
populateBranchControls();
renderCategoryFiltersAndDropdowns();
applyRole();

// Initial sync with server
syncNoticesFromServer();
syncUsersFromServer();
syncCategoriesFromServer();

// Periodic live sync every 3 seconds (syncs Edge & Chrome in real-time)
setInterval(function () {
    syncNoticesFromServer();
    syncCategoriesFromServer();
}, 3000);

// Sync immediately when browser window regains focus
window.addEventListener("focus", function () {
    syncNoticesFromServer();
    syncUsersFromServer();
    syncCategoriesFromServer();
});
