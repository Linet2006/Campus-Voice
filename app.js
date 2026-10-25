// ==================================================
// CAMPUS VOICE
// Role-Based Announcement Portal (Student & Faculty)
// ==================================================

/* ==================================================
   SECURITY ARCHITECTURE NOTE:
   This is a front-end demonstration of role-based access
   control (RBAC). In a production environment, role 
   security, authentication, permissions, and database operations 
   MUST be validated and enforced on a secure backend server 
   (e.g., Firebase Auth / Firestore Rules or a Node.js + Express 
   API using verified JWT tokens) to prevent client-side inspection 
   or manipulation via developer tools.
================================================== */

// Demo Faculty Passcode Constant
const FACULTY_PASSCODE = "faculty123";


// ==================================================
// 1. INITIAL DEMO DATA
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
        upvotes: 64
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
        upvotes: 31
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
        upvotes: 49
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
        upvotes: 18
    }
];


// ==================================================
// 2. DATA PERSISTENCE & LOCALSTORAGE HELPERS
// ==================================================

// Load notices from localStorage or use initial demo notices
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
// 3. APPLICATION STATE
// ==================================================

// Single role tracking variable: "student", "faculty", or null
let currentRole = localStorage.getItem("campusRole") || null;
let campusUserName = localStorage.getItem("campusUserName") || "";

let currentFilter = "All";
let searchText = "";
let currentSort = "latest";
let editingNoticeId = null; // Holds notice ID when faculty is editing


// ==================================================
// 4. DOM REFERENCES
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

// Toast
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
let toastTimeout = null;


// ==================================================
// 5. ROLE MANAGEMENT & APPLYROLE()
// ==================================================

function applyRole() {
    // Synchronize CSS body classes for declarative styling
    document.body.classList.remove("role-student", "role-faculty");

    if (!currentRole) {
        // If no role is selected, show role selection overlay
        if (roleScreen) roleScreen.classList.remove("hidden");
        return;
    }

    // Role is chosen; hide the role overlay
    if (roleScreen) roleScreen.classList.add("hidden");

    if (currentRole === "faculty") {
        document.body.classList.add("role-faculty");

        // Update role badge in header
        if (roleBadge) {
            roleBadge.className = "text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/50 flex items-center gap-1.5";
            roleBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Faculty${campusUserName ? ': <span class="text-white normal-case font-bold">' + escapeHtml(campusUserName) + '</span>' : ''}`;
        }

        // Hero texts for faculty
        if (heroTitle) heroTitle.textContent = "Manage and publish campus announcements.";
        if (heroSubtitle) heroSubtitle.textContent = "Official faculty portal for college circulars, exams, and event notices.";

        // Explicitly update interface visibility
        if (openModalBtn) openModalBtn.classList.remove("hidden");
        if (facultyDashboard) facultyDashboard.classList.remove("hidden");
        if (savedFilterPill) savedFilterPill.classList.add("hidden");

        // If faculty was previously on the student "Saved" filter, reset to "All"
        if (currentFilter === "Saved") {
            currentFilter = "All";
            resetActiveFilterPill("All");
        }

        // Refresh faculty dashboard metrics
        updateFacultyDashboard();

    } else if (currentRole === "student") {
        document.body.classList.add("role-student");

        // Update role badge in header
        if (roleBadge) {
            roleBadge.className = "text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-indigo-700/70 text-indigo-200 border border-indigo-500/50 flex items-center gap-1.5";
            roleBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Student`;
        }

        // Hero texts for student
        if (heroTitle) heroTitle.textContent = "What's happening on campus?";
        if (heroSubtitle) heroSubtitle.textContent = "Search, explore and share important campus updates.";

        // Hide faculty controls from student
        if (openModalBtn) openModalBtn.classList.add("hidden");
        if (facultyDashboard) facultyDashboard.classList.add("hidden");
        if (savedFilterPill) savedFilterPill.classList.remove("hidden");
    }

    // Re-render notices with role-appropriate card buttons
    renderNotices();
}

function updateFacultyDashboard() {
    if (currentRole !== "faculty") return;

    // A notice is considered "posted by me" if postedBy matches the faculty name,
    // or if it is a pre-existing demo notice without a specific faculty owner.
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
    // Rule: treat existing demo notices (without postedBy) as editable by any faculty member
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
// 6. ROLE SELECTION EVENT LISTENERS
// ==================================================

// Student role selection
selectStudentBtn.addEventListener("click", function () {
    currentRole = "student";
    campusUserName = "";
    localStorage.setItem("campusRole", "student");
    localStorage.removeItem("campusUserName");
    applyRole();
    showToast("Welcome, Student! Accessing notice board.");
});

// Faculty role selection with passcode verification
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

    // Clear login inputs for cleanliness
    facultyPasscode.value = "";
    facultyNameInput.value = "";

    applyRole();
    showToast(`Welcome, ${resolvedName}! Faculty privileges enabled.`);
});

// Allow Enter key to submit faculty passcode
facultyPasscode.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        selectFacultyBtn.click();
    }
});

// Logout / Switch role
switchRoleBtn.addEventListener("click", function () {
    currentRole = null;
    campusUserName = "";
    localStorage.removeItem("campusRole");
    localStorage.removeItem("campusUserName");
    
    // Clear any active editing session
    editingNoticeId = null;
    closeModal();

    // Reset error state
    if (facultyError) facultyError.classList.add("hidden");
    if (facultyPasscode) facultyPasscode.value = "";
    if (facultyNameInput) facultyNameInput.value = "";

    applyRole();
    showToast("Session reset. Please select your role.");
});


// ==================================================
// 7. CATEGORY STYLE HELPER
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


// ==================================================
// 8. MAIN RENDER FUNCTION
// ==================================================

function renderNotices() {
    let filteredNotices = [...notices];
    const upvotedIds = getUpvotedNoticeIds();
    const bookmarkedIds = getBookmarkedNoticeIds();

    // ----------------------------------------------
    // CATEGORY FILTER
    // ----------------------------------------------
    if (currentFilter === "Saved") {
        filteredNotices = filteredNotices.filter(function (notice) {
            return bookmarkedIds.includes(notice.id);
        });
    } else if (currentFilter !== "All") {
        filteredNotices = filteredNotices.filter(function (notice) {
            return notice.category === currentFilter;
        });
    }

    // ----------------------------------------------
    // SEARCH FILTER
    // ----------------------------------------------
    if (searchText !== "") {
        const query = searchText.toLowerCase();
        filteredNotices = filteredNotices.filter(function (notice) {
            const titleMatch = notice.title.toLowerCase().includes(query);
            const descriptionMatch = notice.description.toLowerCase().includes(query);
            const authorMatch = notice.author.toLowerCase().includes(query);
            return titleMatch || descriptionMatch || authorMatch;
        });
    }

    // ----------------------------------------------
    // SORTING
    // ----------------------------------------------
    if (currentSort === "upvotes") {
        filteredNotices.sort(function (a, b) {
            return (b.upvotes || 0) - (a.upvotes || 0);
        });
    } else {
        // Latest first by ID
        filteredNotices.sort(function (a, b) {
            return b.id - a.id;
        });
    }

    // ----------------------------------------------
    // STATS UPDATE
    // ----------------------------------------------
    if (totalCount) totalCount.textContent = notices.length;

    const trendingNotices = notices.filter(function (notice) {
        return (notice.upvotes || 0) >= 30;
    });
    if (trendingCount) trendingCount.textContent = trendingNotices.length;

    // ----------------------------------------------
    // EMPTY STATE HANDLING
    // ----------------------------------------------
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

    // ----------------------------------------------
    // GENERATE ROLE-AWARE NOTICE CARDS
    // ----------------------------------------------
    const cards = filteredNotices.map(function (notice) {
        const categoryStyle = getCategoryStyle(notice.category);

        // Trending Badge (30+ upvotes)
        let trendingBadge = "";
        if ((notice.upvotes || 0) >= 30) {
            trendingBadge = `
                <span class="text-[10px] font-bold bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                    🔥 TRENDING
                </span>
            `;
        }

        // Author & Origin Label
        let facultyBadge = "";
        if (notice.postedBy) {
            facultyBadge = `
                <span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200 font-medium">
                    Faculty Post
                </span>
            `;
        }

        // ROLE-AWARE CARD ACTIONS:
        let cardActionsHtml = "";

        if (currentRole === "student") {
            // Student: Single Upvote + Bookmark
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
            // Faculty: Upvote Count + Edit & Delete (if owned or demo notice)
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
            <article class="notice-card bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
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
// 9. STUDENT FEATURES (UPVOTE & BOOKMARKS)
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

        // Increase upvote count
        selectedNotice.upvotes = (Number(selectedNotice.upvotes) || 0) + 1;
        upvotedIds.push(id);
        saveUpvotedNoticeIds(upvotedIds);

    } else if (currentRole === "faculty") {
        // Faculty can upvote notices freely
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
    // Security check: Only students can manage bookmarks
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
// 10. FACULTY NOTICE MANAGEMENT (CREATE, EDIT, DELETE)
// ==================================================

function openModal() {
    // Security check
    if (currentRole !== "faculty") {
        showToast("Access denied: Only faculty members can post announcements.");
        return;
    }

    if (!editingNoticeId) {
        // Create Mode
        noticeForm.reset();
        modalTitle.textContent = "Post New Notice";
        modalSubmitBtn.textContent = "Publish Notice";
        // Auto-fill faculty author/department
        noticeAuthor.value = campusUserName || "";
        characterCount.textContent = "0 / 250";
    }

    noticeModal.classList.remove("hidden");
    noticeModal.classList.add("flex");
    noticeTitle.focus();
}

function closeModal() {
    noticeModal.classList.add("hidden");
    noticeModal.classList.remove("flex");

    // Reset editing state and form
    editingNoticeId = null;
    noticeForm.reset();
    characterCount.textContent = "0 / 250";
    modalTitle.textContent = "Post New Notice";
    modalSubmitBtn.textContent = "Publish Notice";
}

function editNotice(id) {
    // Security check
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

    noticeModal.classList.remove("hidden");
    noticeModal.classList.add("flex");
    noticeTitle.focus();
}

function deleteNotice(id) {
    // Security check
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

    // Remove from notices array
    notices = notices.filter(function (n) {
        return n.id !== id;
    });

    saveNotices();
    updateFacultyDashboard();
    renderNotices();
    showToast("Announcement deleted successfully.");
}

// Notice Form Submit (handles both Publish and Edit)
noticeForm.addEventListener("submit", function (event) {
    event.preventDefault();

    // Security check
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
            upvotes: 0
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
// 11. SEARCH, SORT & FILTER EVENTS
// ==================================================

// Category filter container click
filterContainer.addEventListener("click", function (event) {
    const pill = event.target.closest(".filter-pill");
    if (!pill) return;

    // Update active pill styling
    const allPills = filterContainer.querySelectorAll(".filter-pill");
    allPills.forEach(function (btn) {
        btn.classList.remove("active-pill");
    });
    pill.classList.add("active-pill");

    currentFilter = pill.dataset.category;
    renderNotices();
});

// Search input
searchInput.addEventListener("input", function (event) {
    searchText = event.target.value.trim();
    renderNotices();
});

// Clear search
clearSearchBtn.addEventListener("click", function () {
    searchInput.value = "";
    searchText = "";
    renderNotices();
    searchInput.focus();
});

// Sort select
sortSelect.addEventListener("change", function (event) {
    currentSort = event.target.value;
    renderNotices();
});

// Modal toggle button events
openModalBtn.addEventListener("click", openModal);
closeModalBtn.addEventListener("click", closeModal);
cancelModalBtn.addEventListener("click", closeModal);

// Character counter on description textarea
noticeDescription.addEventListener("input", function (event) {
    const len = event.target.value.length;
    characterCount.textContent = `${len} / 250`;
});

// Close modal when clicking on the dark backdrop
noticeModal.addEventListener("click", function (event) {
    if (event.target === noticeModal) {
        closeModal();
    }
});

// Close modal on Escape key
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !noticeModal.classList.contains("hidden")) {
        closeModal();
    }
});


// ==================================================
// 12. TOAST NOTIFICATION
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
// 13. INITIAL APPLICATION BOOTSTRAP
// ==================================================

console.log("Campus Voice Portal Loaded with RBAC");

// Apply current role from localStorage, or prompt for role selection
applyRole();
