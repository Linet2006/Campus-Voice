// ==================================================
// CAMPUS VOICE
// Role-Based Announcement Portal (Student & Faculty)
// With In-Website File Viewer (PDF.js + Click-to-Zoom Images)
// ==================================================

/* ==================================================
   SECURITY & STORAGE ARCHITECTURE NOTES:
   1. ROLE-BASED ACCESS CONTROL (RBAC):
      This is a front-end demonstration of role-based access.
      In a production system, role security, credentials, and 
      permissions MUST be validated on a secure backend server 
      (e.g., Firebase Auth or Node.js + JWT) to prevent client-side
      tampering via browser developer tools.

   2. INDEXEDDB FILE ATTACHMENTS:
      IndexedDB stores files and images as Blobs locally inside
      the user's browser sandbox on this device. Files are NOT 
      synchronized across the internet or visible on other devices.
      A real production deployment requires a cloud object store
      (such as Firebase Storage, AWS S3, or Node.js + Multer).
================================================== */

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
// 1. INDEXEDDB HELPERS (saveFile, getFile, deleteFile)
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

async function saveFile(id, file) {
    try {
        const db = await openDB();
        return new Promise(function (resolve, reject) {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(file, id);

            req.onsuccess = function () {
                resolve(true);
            };

            req.onerror = function () {
                reject(req.error);
            };
        });
    } catch (err) {
        console.error("IndexedDB saveFile error:", err);
        showToast("Storage error: Browser blocked file attachment.");
        throw err;
    }
}

async function getFile(id) {
    if (!id) return null;
    try {
        const db = await openDB();
        return new Promise(function (resolve, reject) {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(id);

            req.onsuccess = function () {
                resolve(req.result || null);
            };

            req.onerror = function () {
                reject(req.error);
            };
        });
    } catch (err) {
        console.error("IndexedDB getFile error:", err);
        showToast("Storage error: Unable to load attachment.");
        return null;
    }
}

async function deleteFile(id) {
    if (!id) return;
    try {
        const db = await openDB();
        return new Promise(function (resolve, reject) {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(id);

            req.onsuccess = function () {
                resolve(true);
            };

            req.onerror = function () {
                reject(req.error);
            };
        });
    } catch (err) {
        console.error("IndexedDB deleteFile error:", err);
    }
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}


// ==================================================
// 2. INITIAL DEMO DATA
// ==================================================

const initialNotices = [
    {
        id: 4,
        title: "Ahlya Technologies On-Campus Placement Drive",
        category: "Placements",
        description: "Ahlya Technologies is conducting an on-campus evaluation for final year students. Register through the placement portal.",
        author: "GEC Training & Placement Cell",
        postedBy: null, // Demo notice: editable by all faculty
        authorRole: "faculty",
        date: "Sep 28, 2026",
        upvotes: 64,
        attachment: null
    },
    {
        id: 3,
        title: "College University Lab Exam Timetable",
        category: "Exams",
        description: "The practical examination timetable and laboratory batch details have been released on department bulletin boards.",
        author: "Department of Computer Applications",
        postedBy: null, // Demo notice: editable by all faculty
        authorRole: "faculty",
        date: "Oct 8, 2026",
        upvotes: 31,
        attachment: null
    },
    {
        id: 2,
        title: "Web Innovation Prototype Challenge",
        category: "Hackathons",
        description: "Student squads can register for the 24-hour web prototype innovation challenge. Exciting prizes and mentorship opportunities.",
        author: "Student Innovation Club",
        postedBy: null, // Demo notice: editable by all faculty
        authorRole: "faculty",
        date: "Sep 26, 2026",
        upvotes: 49,
        attachment: null
    },
    {
        id: 1,
        title: "Annual Cultural Fest 2026",
        category: "Cultural",
        description: "Registrations are officially open for music, dance, theatrical, and fine arts events. Contact student coordinators for slots.",
        author: "Student Welfare Committee",
        postedBy: null, // Demo notice: editable by all faculty
        authorRole: "faculty",
        date: "Sep 25, 2026",
        upvotes: 18,
        attachment: null
    }
];


// ==================================================
// 3. DATA PERSISTENCE & LOCALSTORAGE HELPERS
// ==================================================

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

function saveNotices() {
    localStorage.setItem("campusNotices", JSON.stringify(notices));
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
// 4. APPLICATION STATE
// ==================================================

let currentRole = localStorage.getItem("campusRole") || null;
let campusUserName = localStorage.getItem("campusUserName") || "";

let currentFilter = "All";
let searchText = "";
let currentSort = "latest";
let editingNoticeId = null;

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
// 5. DOM REFERENCES
// ==================================================

// Role Selection Screen
const roleScreen = document.getElementById("roleScreen");
const selectStudentBtn = document.getElementById("selectStudentBtn");
const selectFacultyBtn = document.getElementById("selectFacultyBtn");
const facultyPasscode = document.getElementById("facultyPasscode");
const facultyNameInput = document.getElementById("facultyNameInput");
const facultyError = document.getElementById("facultyError");
const switchRoleBtn = document.getElementById("switchRoleBtn");
const roleBadge = document.getElementById("roleBadge");

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

// Search & Filters
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

// Notice Modal & Form
const noticeModal = document.getElementById("noticeModal");
const modalTitle = document.getElementById("modalTitle");
const modalSubmitBtn = document.getElementById("modalSubmitBtn");
const openModalBtn = document.getElementById("openModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const noticeForm = document.getElementById("noticeForm");
const noticeTitle = document.getElementById("noticeTitle");
const noticeCategory = document.getElementById("noticeCategory");
const noticeAuthor = document.getElementById("noticeAuthor");
const noticeDescription = document.getElementById("noticeDescription");
const characterCount = document.getElementById("characterCount");

// Attachment elements in create/edit modal
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

// Toast
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
let toastTimeout = null;


// ==================================================
// 6. ROLE MANAGEMENT & APPLYROLE()
// ==================================================

function applyRole() {
    document.body.classList.remove("role-student", "role-faculty");

    if (!currentRole) {
        if (roleScreen) roleScreen.classList.remove("hidden");
        return;
    }

    if (roleScreen) roleScreen.classList.add("hidden");

    if (currentRole === "faculty") {
        document.body.classList.add("role-faculty");

        if (roleBadge) {
            roleBadge.className = "text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/50 flex items-center gap-1.5";
            roleBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Faculty${campusUserName ? ': <span class="text-white normal-case font-bold">' + escapeHtml(campusUserName) + '</span>' : ''}`;
        }

        if (heroTitle) heroTitle.textContent = "Manage and publish campus announcements.";
        if (heroSubtitle) heroSubtitle.textContent = "Official faculty portal for college circulars, exams, and event notices.";

        if (openModalBtn) openModalBtn.classList.remove("hidden");
        if (facultyDashboard) facultyDashboard.classList.remove("hidden");
        if (savedFilterPill) savedFilterPill.classList.add("hidden");

        if (currentFilter === "Saved") {
            currentFilter = "All";
            resetActiveFilterPill("All");
        }

        updateFacultyDashboard();

    } else if (currentRole === "student") {
        document.body.classList.add("role-student");

        if (roleBadge) {
            roleBadge.className = "text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-indigo-700/70 text-indigo-200 border border-indigo-500/50 flex items-center gap-1.5";
            roleBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Student`;
        }

        if (heroTitle) heroTitle.textContent = "What's happening on campus?";
        if (heroSubtitle) heroSubtitle.textContent = "Search, explore and share important campus updates.";

        if (openModalBtn) openModalBtn.classList.add("hidden");
        if (facultyDashboard) facultyDashboard.classList.add("hidden");
        if (savedFilterPill) savedFilterPill.classList.remove("hidden");
    }

    renderNotices();
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
// 7. ROLE SELECTION EVENT LISTENERS
// ==================================================

selectStudentBtn.addEventListener("click", function () {
    currentRole = "student";
    campusUserName = "";
    localStorage.setItem("campusRole", "student");
    localStorage.removeItem("campusUserName");
    applyRole();
    showToast("Welcome, Student! Accessing notice board.");
});

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

    currentRole = "faculty";
    campusUserName = resolvedName;
    localStorage.setItem("campusRole", "faculty");
    localStorage.setItem("campusUserName", resolvedName);

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

switchRoleBtn.addEventListener("click", function () {
    currentRole = null;
    campusUserName = "";
    localStorage.removeItem("campusRole");
    localStorage.removeItem("campusUserName");

    editingNoticeId = null;
    closeModal();
    closeFileViewer();

    if (facultyError) facultyError.classList.add("hidden");
    if (facultyPasscode) facultyPasscode.value = "";
    if (facultyNameInput) facultyNameInput.value = "";

    applyRole();
    showToast("Session reset. Please select your role.");
});


// ==================================================
// 8. ATTACHMENT MODAL HELPERS & PREVIEW
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
            // Existing attachment in edit mode: fetch from IndexedDB to show preview
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

// File picker event handler
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

// Remove attachment button
removeAttachmentBtn.addEventListener("click", function () {
    if (currentAttachmentMeta && !currentAttachmentFile && currentAttachmentMeta.id) {
        pendingDeletedAttachmentId = currentAttachmentMeta.id;
    }
    resetAttachmentInput();
});


// ==================================================
// 9. CATEGORY STYLE & HTML / JS ESCAPING
// ==================================================

function getCategoryStyle(category) {
    if (category === "Placements") {
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    if (category === "Exams") {
        return "bg-rose-50 text-rose-700 border-rose-200";
    }
    if (category === "Hackathons") {
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
    }
    if (category === "Cultural") {
        return "bg-amber-50 text-amber-700 border-amber-200";
    }
    return "bg-slate-100 text-slate-700 border-slate-200";
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
// 10. MAIN RENDER FUNCTION
// ==================================================

function renderNotices() {
    let filteredNotices = [...notices];
    const upvotedIds = getUpvotedNoticeIds();
    const bookmarkedIds = getBookmarkedNoticeIds();

    // Category Filter
    if (currentFilter === "Saved") {
        filteredNotices = filteredNotices.filter(function (notice) {
            return bookmarkedIds.includes(notice.id);
        });
    } else if (currentFilter !== "All") {
        filteredNotices = filteredNotices.filter(function (notice) {
            return notice.category === currentFilter;
        });
    }

    // Search Filter
    if (searchText !== "") {
        const query = searchText.toLowerCase();
        filteredNotices = filteredNotices.filter(function (notice) {
            const titleMatch = notice.title.toLowerCase().includes(query);
            const descriptionMatch = notice.description.toLowerCase().includes(query);
            const authorMatch = notice.author.toLowerCase().includes(query);
            return titleMatch || descriptionMatch || authorMatch;
        });
    }

    // Sorting
    if (currentSort === "upvotes") {
        filteredNotices.sort(function (a, b) {
            return (b.upvotes || 0) - (a.upvotes || 0);
        });
    } else {
        filteredNotices.sort(function (a, b) {
            return b.id - a.id;
        });
    }

    // Stats
    if (totalCount) totalCount.textContent = notices.length;

    const trendingNotices = notices.filter(function (notice) {
        return (notice.upvotes || 0) >= 30;
    });
    if (trendingCount) trendingCount.textContent = trendingNotices.length;

    // Empty State
    if (filteredNotices.length === 0) {
        cardsGrid.innerHTML = "";
        emptyState.classList.remove("hidden");

        if (currentFilter === "Saved") {
            if (emptyTitle) emptyTitle.textContent = "No saved announcements";
            if (emptyDesc) emptyDesc.textContent = "Click the '☆ Save' button on any notice card to bookmark it here for quick access.";
        } else {
            if (emptyTitle) emptyTitle.textContent = "No announcements found";
            if (emptyDesc) emptyDesc.textContent = "Try another search query or category filter.";
        }
        return;
    }

    emptyState.classList.add("hidden");

    // Generate Notice Cards
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
                // Non-previewable (Word, PPT, Excel, ZIP): View is hidden, Download is shown with note
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
                    <!-- Category & Trending Header -->
                    <div class="flex items-center justify-between gap-2 mb-3">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="text-xs font-bold px-2.5 py-1 rounded-lg border ${categoryStyle}">
                                ${escapeHtml(notice.category)}
                            </span>
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
                        <span class="font-medium text-slate-500">
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
// 11. IN-WEBSITE FILE VIEWER (PDF.JS + IMAGE VIEWER)
// ==================================================

async function openFileViewer(fileId, fileName, fileType, fileSize) {
    currentViewerFileName = fileName;
    currentViewerFileType = fileType;
    currentViewerFileSize = fileSize;

    // Set header information
    viewerFileName.textContent = fileName;
    viewerFileSize.textContent = formatFileSize(fileSize);
    viewerFileIcon.textContent = getFileIcon(fileName, fileType);

    // Reset Viewer states
    fileViewerContent.innerHTML = "";
    fileViewerContent.classList.add("hidden");
    viewerErrorState.classList.add("hidden");
    viewerPdfControls.classList.add("hidden");
    viewerPdfControls.classList.remove("flex");
    viewerLoadingSpinner.classList.remove("hidden");

    // Open Modal
    fileViewerModal.classList.remove("hidden");
    fileViewerModal.classList.add("flex");

    try {
        const blob = await getFile(fileId);

        if (!blob) {
            showViewerError("File not found in local browser storage on this device.");
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
    fileViewerContent.className = "w-full h-full flex flex-col items-center justify-center p-2 relative";

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

    renderedPdfPages.clear();
    currentPdfZoom = 1.0;
    updateZoomDisplay();

    try {
        const arrayBuffer = await blob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        currentPdfDoc = await loadingTask.promise;

        const totalPages = currentPdfDoc.numPages;
        viewerPageIndicator.textContent = `Page 1 / ${totalPages}`;

        // Create lazy skeleton containers for each page
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const pageContainer = document.createElement("div");
            pageContainer.className = "pdf-page-container mb-6 bg-white rounded-lg shadow-md overflow-hidden relative w-full flex items-center justify-center";
            pageContainer.dataset.pageNumber = pageNum;
            pageContainer.style.minHeight = "450px";

            pageContainer.innerHTML = `
                <div class="pdf-skeleton text-xs text-slate-400 py-20 flex flex-col items-center gap-2">
                    <span class="inline-block w-5 h-5 border-2 border-slate-300 border-t-brand-500 rounded-full animate-spin"></span>
                    <span>Loading Page ${pageNum}...</span>
                </div>
            `;

            fileViewerContent.appendChild(pageContainer);
        }

        viewerLoadingSpinner.classList.add("hidden");
        fileViewerContent.classList.remove("hidden");

        // Initialize IntersectionObserver for lazy PDF rendering
        setupPdfIntersectionObserver();

    } catch (pdfErr) {
        console.error("PDF.js render error:", pdfErr);
        showViewerError("Could not render PDF document. The file might be corrupted or format unsupported.");
    }
}

function setupPdfIntersectionObserver() {
    if (pdfIntersectionObserver) {
        pdfIntersectionObserver.disconnect();
    }

    pdfIntersectionObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            const pageNum = Number(entry.target.dataset.pageNumber);
            if (entry.isIntersecting) {
                if (currentPdfDoc) {
                    viewerPageIndicator.textContent = `Page ${pageNum} / ${currentPdfDoc.numPages}`;
                }

                if (!renderedPdfPages.has(pageNum)) {
                    renderPdfPage(pageNum, entry.target);
                }
            }
        });
    }, {
        root: fileViewerBody,
        rootMargin: "250px 0px 250px 0px",
        threshold: 0.1
    });

    const containers = fileViewerContent.querySelectorAll(".pdf-page-container");
    containers.forEach(function (el) {
        pdfIntersectionObserver.observe(el);
    });
}

async function renderPdfPage(pageNum, container) {
    if (!currentPdfDoc) return;
    renderedPdfPages.add(pageNum);

    try {
        const page = await currentPdfDoc.getPage(pageNum);
        const unscaledViewport = page.getViewport({ scale: 1 });

        // Scaled to fit container width, mobile friendly
        const availableWidth = Math.min(fileViewerBody.clientWidth - 48, 850);
        const fitScale = (availableWidth / unscaledViewport.width) * currentPdfZoom;
        const viewport = page.getViewport({ scale: fitScale });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };

        container.innerHTML = "";
        container.style.minHeight = "auto";
        container.appendChild(canvas);

        await page.render(renderContext).promise;
    } catch (err) {
        console.error(`Error rendering page ${pageNum}:`, err);
        container.innerHTML = `<div class="p-8 text-xs text-rose-500">Error loading page ${pageNum}</div>`;
    }
}

function rerenderAllVisiblePdfPages() {
    if (!currentPdfDoc) return;
    renderedPdfPages.clear();
    const containers = fileViewerContent.querySelectorAll(".pdf-page-container");
    containers.forEach(function (container) {
        const pageNum = Number(container.dataset.pageNumber);
        renderPdfPage(pageNum, container);
    });
}

function updateZoomDisplay() {
    viewerZoomLevel.textContent = `${Math.round(currentPdfZoom * 100)}%`;
}

function showViewerError(msg) {
    viewerLoadingSpinner.classList.add("hidden");
    fileViewerContent.classList.add("hidden");
    viewerPdfControls.classList.add("hidden");
    viewerPdfControls.classList.remove("flex");

    viewerErrorMessage.textContent = msg;
    viewerErrorState.classList.remove("hidden");
}

function closeFileViewer() {
    fileViewerModal.classList.add("hidden");
    fileViewerModal.classList.remove("flex");
    fileViewerContent.innerHTML = "";
    fileViewerContent.classList.add("hidden");
    viewerPdfControls.classList.add("hidden");
    viewerPdfControls.classList.remove("flex");
    viewerErrorState.classList.add("hidden");

    if (pdfIntersectionObserver) {
        pdfIntersectionObserver.disconnect();
        pdfIntersectionObserver = null;
    }

    renderedPdfPages.clear();
    currentPdfDoc = null;

    if (currentViewerUrl) {
        URL.revokeObjectURL(currentViewerUrl);
        currentViewerUrl = null;
    }

    currentViewerBlob = null;
    currentViewerFileName = "";
    currentViewerFileType = "";
    currentViewerFileSize = 0;
}

// Download Helper using standard <a download> element
function triggerBlobDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 5000);
    showToast("Download started!");
}

async function downloadAttachment(fileId, fileName) {
    try {
        const blob = await getFile(fileId);
        if (!blob) {
            showToast("Attachment not found on this device.");
            return;
        }
        triggerBlobDownload(blob, fileName);
    } catch (err) {
        console.error("Error downloading attachment:", err);
        showToast("Failed to download file.");
    }
}

// Viewer Header Controls Event Listeners
closeViewerBtn.addEventListener("click", closeFileViewer);

viewerDownloadBtn.addEventListener("click", function () {
    if (currentViewerBlob && currentViewerFileName) {
        triggerBlobDownload(currentViewerBlob, currentViewerFileName);
    }
});

viewerErrorDownloadBtn.addEventListener("click", function () {
    if (currentViewerBlob && currentViewerFileName) {
        triggerBlobDownload(currentViewerBlob, currentViewerFileName);
    }
});

viewerZoomInBtn.addEventListener("click", function () {
    if (currentPdfZoom >= 2.5) return;
    currentPdfZoom = Math.min(2.5, currentPdfZoom + 0.25);
    updateZoomDisplay();
    rerenderAllVisiblePdfPages();
});

viewerZoomOutBtn.addEventListener("click", function () {
    if (currentPdfZoom <= 0.5) return;
    currentPdfZoom = Math.max(0.5, currentPdfZoom - 0.25);
    updateZoomDisplay();
    rerenderAllVisiblePdfPages();
});

// Close viewer on Escape or clicking backdrop
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        if (!fileViewerModal.classList.contains("hidden")) {
            closeFileViewer();
        } else if (!noticeModal.classList.contains("hidden")) {
            closeModal();
        }
    }
});

fileViewerModal.addEventListener("click", function (event) {
    if (event.target === fileViewerModal || event.target === fileViewerBody) {
        closeFileViewer();
    }
});


// ==================================================
// 12. STUDENT FEATURES (UPVOTE & BOOKMARKS)
// ==================================================

function upvoteNotice(id) {
    const selectedNotice = notices.find(function (n) {
        return n.id === id;
    });

    if (!selectedNotice) return;

    if (currentRole === "student") {
        const upvotedIds = getUpvotedNoticeIds();
        if (upvotedIds.includes(id)) {
            showToast("You have already upvoted this notice.");
            return;
        }

        selectedNotice.upvotes = (Number(selectedNotice.upvotes) || 0) + 1;
        upvotedIds.push(id);
        saveUpvotedNoticeIds(upvotedIds);

    } else if (currentRole === "faculty") {
        selectedNotice.upvotes = (Number(selectedNotice.upvotes) || 0) + 1;
        updateFacultyDashboard();
    } else {
        showToast("Please choose a role to upvote.");
        return;
    }

    saveNotices();
    renderNotices();
    showToast("Upvote recorded!");
}

function toggleBookmark(id) {
    if (currentRole !== "student") {
        showToast("Bookmarks are available in Student mode.");
        return;
    }

    let bookmarkedIds = getBookmarkedNoticeIds();
    const isBookmarked = bookmarkedIds.includes(id);

    if (isBookmarked) {
        bookmarkedIds = bookmarkedIds.filter(function (bId) {
            return bId !== id;
        });
        saveBookmarkedNoticeIds(bookmarkedIds);
        showToast("Notice removed from bookmarks.");
    } else {
        bookmarkedIds.push(id);
        saveBookmarkedNoticeIds(bookmarkedIds);
        showToast("Notice saved to bookmarks!");
    }

    renderNotices();
}


// ==================================================
// 13. FACULTY NOTICE MANAGEMENT (CREATE, EDIT, DELETE)
// ==================================================

function openModal() {
    if (currentRole !== "faculty") {
        showToast("Access denied: Only faculty members can post announcements.");
        return;
    }

    if (!editingNoticeId) {
        noticeForm.reset();
        modalTitle.textContent = "Post New Notice";
        modalSubmitBtn.textContent = "Publish Notice";
        noticeAuthor.value = campusUserName || "";
        characterCount.textContent = "0 / 250";
        resetAttachmentInput();
        pendingDeletedAttachmentId = null;
    }

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
    if (currentRole !== "faculty") {
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
    noticeCategory.value = notice.category;
    noticeAuthor.value = notice.author;
    noticeDescription.value = notice.description;
    characterCount.textContent = `${notice.description.length} / 250`;

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
    if (currentRole !== "faculty") {
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
            console.error("Error deleting attachment from IndexedDB:", e);
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

// Notice Form Submit (handles both Publish and Edit)
noticeForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (currentRole !== "faculty") {
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
        showToast("Storage error: Failed to save attachment to IndexedDB.");
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
// 14. SEARCH, SORT & FILTER EVENTS
// ==================================================

filterContainer.addEventListener("click", function (event) {
    const pill = event.target.closest(".filter-pill");
    if (!pill) return;

    const allPills = filterContainer.querySelectorAll(".filter-pill");
    allPills.forEach(function (btn) {
        btn.classList.remove("active-pill");
    });
    pill.classList.add("active-pill");

    currentFilter = pill.dataset.category;
    renderNotices();
});

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
// 15. TOAST NOTIFICATION
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
// 16. INITIAL APPLICATION BOOTSTRAP
// ==================================================

console.log("Campus Voice Portal Loaded with RBAC & In-Website File Viewer");
applyRole();
