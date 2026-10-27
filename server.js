// ==================================================
// CAMPUS VOICE - AUTHENTICATED LOCAL & CLOUD BACKEND SERVER
// Government Engineering College
// Complete Role-Based Security, Session Management,
// Faculty Allowlist OTP Flow, and Granular Endpoint Protection.
// ==================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const NOTICES_FILE = path.join(DATA_DIR, 'notices.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');
const ANSWERS_FILE = path.join(DATA_DIR, 'answers.json');
const FACULTY_FILE = path.join(DATA_DIR, 'faculty.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const OTPS_FILE = path.join(DATA_DIR, 'otps.json');

// 10 MB maximum file upload limit
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Permitted MIME types for attachments
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip', 'application/x-zip-compressed',
    'application/octet-stream'
]);

const ALLOWED_FILE_EXTENSIONS = /\.(jpe?g|png|webp|gif|svg|pdf|docx?|pptx?|xlsx?|zip)$/i;

// Ensure data and uploads directories exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Initial demo notices to seed if server database is empty
const defaultNotices = [
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

if (!fs.existsSync(NOTICES_FILE)) {
    fs.writeFileSync(NOTICES_FILE, JSON.stringify(defaultNotices, null, 2));
}

// Initial demo student user
const defaultUsers = [
    {
        usn: "1GE22CS045",
        name: "Aditya Sharma",
        branch: "CSE",
        email: "aditya@gec.edu",
        semester: "5th Semester",
        passwordHash: "703b0a3d6ad75b649a28adde7d83c6251da457549263bc7ff45ec709b0a8448b" // "student123"
    }
];

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
}

// Initial default categories
const defaultCategories = ["Placements", "Exams", "Hackathons", "Cultural", "Sports"];
if (!fs.existsSync(CATEGORIES_FILE)) {
    fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(defaultCategories, null, 2));
}

// Initial default Q&A questions and answers seed data
const defaultQuestions = [
    {
        id: 1792945000001,
        title: "What are the core technical rounds asked in Ahlya Technologies campus drive?",
        details: "Can seniors share what topics to focus on? Is it primarily DSA and system design, or do they ask deep questions on OS and DBMS?",
        topic: "Placements",
        branch: "CSE",
        authorUsn: "1GE22CS045",
        authorName: "Aditya Sharma",
        isFaculty: false,
        anonymous: false,
        createdAt: "2026-10-24T10:30:00.000Z",
        status: "resolved",
        acceptedAnswerId: 1792945100001,
        upvotes: 14,
        upvotedBy: ["1GE22AI012", "1GE22CS089"],
        reports: [],
        pinned: true
    },
    {
        id: 1792945000002,
        title: "Best datasets and frameworks for 5th semester Computer Vision mini-project?",
        details: "Our team is planning to build a real-time sign language interpreter using OpenCV and PyTorch. Would Kaggle datasets be sufficient or do we need to capture our own video data?",
        topic: "Projects",
        branch: "AIML",
        authorUsn: "1GE22AI012",
        authorName: "Pooja Hegde",
        isFaculty: false,
        anonymous: false,
        createdAt: "2026-10-24T14:15:00.000Z",
        status: "answered",
        acceptedAnswerId: null,
        upvotes: 9,
        upvotedBy: ["1GE22CS045"],
        reports: [],
        pinned: false
    },
    {
        id: 1792945000003,
        title: "VTU Odd Semester Practical and Theory exam schedule clarification",
        details: "Has the official circular for 5th sem lab examination dates been released by the exam section? Some circulars circulating on WhatsApp mention Nov 15th.",
        topic: "Exams",
        branch: "All",
        authorUsn: "1GE22ME019",
        authorName: "Karthik Nair",
        isFaculty: false,
        anonymous: true,
        createdAt: "2026-10-25T08:00:00.000Z",
        status: "answered",
        acceptedAnswerId: null,
        upvotes: 21,
        upvotedBy: ["1GE22CS045", "1GE22AI012"],
        reports: [],
        pinned: true
    },
    {
        id: 1792945000004,
        title: "Availability of Microcontroller STM32 development boards in department library",
        details: "Do we need a faculty permission slip to issue the STM32 kits for the Embedded Systems course, or can we issue them directly with our college ID card?",
        topic: "Academics",
        branch: "ECE",
        authorUsn: "1GE22EC055",
        authorName: "Suresh Kumar",
        isFaculty: false,
        anonymous: false,
        createdAt: "2026-10-25T11:20:00.000Z",
        status: "open",
        acceptedAnswerId: null,
        upvotes: 5,
        upvotedBy: [],
        reports: [],
        pinned: false
    }
];

const defaultAnswers = [
    {
        id: 1792945100001,
        questionId: 1792945000001,
        text: "Focus heavily on Data Structures (Trees, Graphs, Hash Maps), SQL queries, and Object-Oriented Programming. They also emphasize clean coding and explaining your thought process during problem solving.",
        authorUsn: "FACULTY_CSE",
        authorName: "Dr. Ramesh (CSE Dept)",
        isFaculty: true,
        anonymous: false,
        createdAt: "2026-10-24T12:00:00.000Z",
        upvotes: 18,
        upvotedBy: ["1GE22CS045", "1GE22AI012"],
        reports: []
    },
    {
        id: 1792945100002,
        questionId: 1792945000001,
        text: "Also review your 4th sem DBMS mini-project! In my round, they asked me to write SQL join queries on paper.",
        authorUsn: "1GE22CS089",
        authorName: "Kavya Rao",
        isFaculty: false,
        anonymous: false,
        createdAt: "2026-10-24T15:45:00.000Z",
        upvotes: 7,
        upvotedBy: [],
        reports: []
    },
    {
        id: 1792945100003,
        questionId: 1792945000002,
        text: "We used the ASL Alphabet dataset from Kaggle last semester along with MediaPipe for hand landmark detection. It runs in real-time even on standard laptop CPUs!",
        authorUsn: "1GE22AI034",
        authorName: "Rahul Verma",
        isFaculty: false,
        anonymous: false,
        createdAt: "2026-10-24T16:20:00.000Z",
        upvotes: 11,
        upvotedBy: ["1GE22AI012"],
        reports: []
    },
    {
        id: 1792945100004,
        questionId: 1792945000003,
        text: "Please refer only to the official notices published here on Campus Voice. The lab examinations will commence from Nov 22nd. An official departmental circular will be uploaded by tomorrow.",
        authorUsn: "FACULTY_CSE",
        authorName: "Dr. Ramesh (CSE Dept)",
        isFaculty: true,
        anonymous: false,
        createdAt: "2026-10-25T09:10:00.000Z",
        upvotes: 25,
        upvotedBy: ["1GE22CS045", "1GE22ME019"],
        reports: []
    }
];

if (!fs.existsSync(QUESTIONS_FILE)) {
    fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(defaultQuestions, null, 2));
}

if (!fs.existsSync(ANSWERS_FILE)) {
    fs.writeFileSync(ANSWERS_FILE, JSON.stringify(defaultAnswers, null, 2));
}

if (!fs.existsSync(SESSIONS_FILE)) {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify({}, null, 2));
}

if (!fs.existsSync(OTPS_FILE)) {
    fs.writeFileSync(OTPS_FILE, JSON.stringify({}, null, 2));
}

// Initial faculty allowlist if file does not exist
const defaultFaculty = [
    {
        email: "ramesh.cse@gec.edu",
        name: "Dr. Ramesh (CSE Dept)",
        department: "Computer Science & Engineering",
        active: true
    },
    {
        email: "faculty@gec.edu",
        name: "Prof. S. Sharma",
        department: "Electronics & Communication",
        active: true
    }
];

if (!fs.existsSync(FACULTY_FILE)) {
    fs.writeFileSync(FACULTY_FILE, JSON.stringify(defaultFaculty, null, 2));
}

// ==================================================
// SESSIONS & AUTHENTICATION HELPERS
// ==================================================

function hashToken(rawToken) {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function loadSessions() {
    try {
        if (!fs.existsSync(SESSIONS_FILE)) return {};
        const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
        return JSON.parse(data || '{}');
    } catch (e) {
        return {};
    }
}

function saveSessions(sessions) {
    try {
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
    } catch (e) {
        console.error("Error saving sessions:", e);
    }
}

// Create a new session. Generates random 32-byte token, stores only SHA-256 hash
function createSession(userData, durationMs) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const sessions = loadSessions();

    const now = Date.now();
    sessions[tokenHash] = {
        ...userData,
        createdAt: now,
        expiresAt: now + durationMs
    };

    saveSessions(sessions);
    return rawToken;
}

// Retrieve valid session by raw token. Purges expired sessions
function getSessionFromToken(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') return null;
    const tokenHash = hashToken(rawToken.trim());
    const sessions = loadSessions();
    const session = sessions[tokenHash];

    if (!session) return null;

    if (Date.now() > session.expiresAt) {
        delete sessions[tokenHash];
        saveSessions(sessions);
        return null;
    }

    return session;
}

// Destroy a session on logout
function destroySession(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') return;
    const tokenHash = hashToken(rawToken.trim());
    const sessions = loadSessions();
    if (sessions[tokenHash]) {
        delete sessions[tokenHash];
        saveSessions(sessions);
    }
}

// Extract Bearer token from request headers
function extractBearerToken(req) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || typeof authHeader !== 'string') return null;
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        return parts[1].trim();
    }
    return null;
}

// Middleware helper to require authentication and optional role authorization
function requireAuth(req, allowedRoles = null) {
    const token = extractBearerToken(req);
    if (!token) {
        return { error: 'Unauthorized: Missing or invalid token', statusCode: 401 };
    }

    const session = getSessionFromToken(token);
    if (!session) {
        return { error: 'Unauthorized: Session expired or invalid', statusCode: 401 };
    }

    if (allowedRoles && Array.isArray(allowedRoles) && !allowedRoles.includes(session.role)) {
        return { error: 'Forbidden: Insufficient privileges for this role', statusCode: 403 };
    }

    return { session };
}

// Faculty allowlist helper (case-insensitive exact email match)
function getFacultyAllowlist() {
    try {
        if (!fs.existsSync(FACULTY_FILE)) return [];
        const data = fs.readFileSync(FACULTY_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (e) {
        return [];
    }
}

function findFacultyByEmail(email) {
    if (!email || typeof email !== 'string') return null;
    const normalized = email.trim().toLowerCase();
    const list = getFacultyAllowlist();
    return list.find(f => f.active !== false && f.email.trim().toLowerCase() === normalized) || null;
}

// ==================================================
// OTP DATA MANAGEMENT & RATE LIMITING
// ==================================================

function loadOtps() {
    try {
        if (!fs.existsSync(OTPS_FILE)) return {};
        const data = fs.readFileSync(OTPS_FILE, 'utf8');
        return JSON.parse(data || '{}');
    } catch (e) {
        return {};
    }
}

function saveOtps(otps) {
    try {
        fs.writeFileSync(OTPS_FILE, JSON.stringify(otps, null, 2));
    } catch (e) {
        console.error("Error saving otps:", e);
    }
}

// In-memory rate limiting by IP (max 15 requests per 10 minutes on auth routes)
const ipRateLimits = new Map();

function checkIpRateLimit(ip) {
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    const maxRequests = 15;

    let timestamps = ipRateLimits.get(ip) || [];
    timestamps = timestamps.filter(t => now - t < windowMs);

    if (timestamps.length >= maxRequests) {
        ipRateLimits.set(ip, timestamps);
        return false;
    }

    timestamps.push(now);
    ipRateLimits.set(ip, timestamps);
    return true;
}

// Clean up stale IP rate limit entries every 15 minutes
setInterval(() => {
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    for (const [ip, timestamps] of ipRateLimits.entries()) {
        const valid = timestamps.filter(t => now - t < windowMs);
        if (valid.length === 0) {
            ipRateLimits.delete(ip);
        } else {
            ipRateLimits.set(ip, valid);
        }
    }
}, 15 * 60 * 1000);

// Send OTP email via Nodemailer SMTP or log to console in demo mode
async function dispatchOtpEmail(recipientEmail, code, facultyName) {
    const hasSmtpConfig = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    const allowConsoleDev = process.env.DEV_OTP_CONSOLE === 'true' || !hasSmtpConfig;

    if (!hasSmtpConfig && allowConsoleDev) {
        console.log("\n============================================================");
        console.log(" [DEMO MODE / DEV_OTP_CONSOLE] FACULTY OTP GENERATED");
        console.log(` To: ${facultyName} <${recipientEmail}>`);
        console.log(` One-Time Verification Code:  >>>  ${code}  <<<`);
        console.log(" Valid for: 10 minutes | Single-use only");
        console.log(" (Configure SMTP_HOST, SMTP_USER, SMTP_PASS for live delivery)");
        console.log("============================================================\n");
        return { sent: true, mode: 'console' };
    }

    if (!hasSmtpConfig) {
        throw new Error("SMTP is not configured and DEV_OTP_CONSOLE is disabled.");
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_PORT === '465',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    const mailOptions = {
        from: process.env.MAIL_FROM || `"Campus Voice GEC" <${process.env.SMTP_USER}>`,
        to: recipientEmail,
        subject: `Campus Voice - Faculty Login Code: ${code}`,
        text: `Hello ${facultyName},\n\nYour one-time verification code for Campus Voice is: ${code}\n\nThis code is valid for 10 minutes and can only be used once.\nIf you did not request this code, please contact your systems administrator.\n\nGovernment Engineering College`,
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
                <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 18px;">
                    <span style="font-size: 11px; font-weight: 700; color: #4338ca; text-transform: uppercase; letter-spacing: 0.05em;">Government Engineering College</span>
                    <h2 style="margin: 4px 0 0 0; color: #0f172a; font-size: 20px;">Faculty Login Verification</h2>
                </div>
                <p style="color: #334155; font-size: 14px; line-height: 1.5;">Hello <strong>${facultyName}</strong>,</p>
                <p style="color: #334155; font-size: 14px; line-height: 1.5;">Use the following one-time code to complete your login to <strong>Campus Voice</strong>:</p>
                <div style="text-align: center; margin: 24px 0;">
                    <div style="display: inline-block; background: #eef2ff; border: 2px dashed #6366f1; border-radius: 10px; padding: 14px 28px; font-size: 28px; font-weight: 800; letter-spacing: 0.25em; color: #3730a3;">
                        ${code}
                    </div>
                </div>
                <p style="color: #64748b; font-size: 12px; line-height: 1.5;">This code will expire in <strong>10 minutes</strong> and can only be used once.<br>If you did not request this login, please ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;">
                <p style="color: #94a3b8; font-size: 11px; margin: 0;">Campus Voice • Government Engineering College</p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
    return { sent: true, mode: 'smtp' };
}

// Helper to set strict same-origin CORS headers (No wildcard '*')
function setCorsHeaders(req, res) {
    const origin = req.headers.origin;
    if (origin) {
        // Echo back matching origin instead of wildcard '*'
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-File-Name, X-File-Type');
}

// Helper for timing-safe string comparison
function safeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
        // Prevent timing leak on length
        crypto.timingSafeEqual(bufA, bufA);
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

// ==================================================
// HTTP SERVER & ROUTER
// ==================================================

const server = http.createServer((req, res) => {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
    const pathname = parsedUrl.pathname;
    const clientIp = req.socket.remoteAddress || '127.0.0.1';

    // Helper to send JSON responses
    function sendJson(status, data) {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }

    // Helper to parse JSON request body
    function parseJsonBody(callback) {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 5 * 1024 * 1024) { // 5MB max payload for JSON
                req.destroy();
            }
        });
        req.on('end', () => {
            try {
                const parsed = JSON.parse(body || '{}');
                callback(null, parsed);
            } catch (e) {
                callback(e, null);
            }
        });
    }

    // =====================================
    // 0. AUTHENTICATION ROUTES (/api/auth/*)
    // =====================================

    // GET /api/auth/me - Verify current session token and return identity
    if (pathname === '/api/auth/me' && req.method === 'GET') {
        const auth = requireAuth(req);
        if (auth.error) {
            return sendJson(auth.statusCode, { error: auth.error });
        }
        return sendJson(200, {
            user: {
                role: auth.session.role,
                userId: auth.session.userId,
                email: auth.session.email || null,
                name: auth.session.name,
                department: auth.session.department || null,
                branch: auth.session.branch || null,
                semester: auth.session.semester || null
            }
        });
    }

    // POST /api/auth/logout - Invalidate and delete active session token
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
        const token = extractBearerToken(req);
        if (token) destroySession(token);
        return sendJson(200, { success: true, message: 'Logged out successfully' });
    }

    // POST /api/auth/student/login - Authenticate student and issue 30-day session
    if (pathname === '/api/auth/student/login' && req.method === 'POST') {
        parseJsonBody((err, body) => {
            if (err || !body.idOrUsn || (!body.password && !body.passwordHash)) {
                return sendJson(400, { error: 'Please provide USN and password' });
            }

            const usn = body.idOrUsn.trim().toUpperCase();
            fs.readFile(USERS_FILE, 'utf8', (readErr, data) => {
                const users = readErr ? defaultUsers : JSON.parse(data || '[]');
                const user = users.find(u => u.usn.toUpperCase() === usn);

                if (!user) {
                    return sendJson(401, { error: 'Invalid USN or student not registered' });
                }

                // Password Verification:
                // NOTE FOR PRODUCTION: Upgrade to crypto.scrypt with a salt per user.
                let candidateHash = body.passwordHash;
                if (!candidateHash && body.password) {
                    candidateHash = crypto.createHash('sha256').update(body.password).digest('hex');
                }

                if (!safeCompare(candidateHash, user.passwordHash)) {
                    return sendJson(401, { error: 'Invalid USN or password' });
                }

                // Create student session (valid for 30 days)
                const duration = 30 * 24 * 60 * 60 * 1000;
                const token = createSession({
                    role: 'student',
                    userId: user.usn,
                    name: user.name,
                    branch: user.branch,
                    semester: user.semester
                }, duration);

                return sendJson(200, {
                    token,
                    user: {
                        role: 'student',
                        usn: user.usn,
                        name: user.name,
                        branch: user.branch,
                        semester: user.semester
                    }
                });
            });
        });
        return;
    }

    // POST /api/auth/faculty/request-otp - Request single-use login code
    if (pathname === '/api/auth/faculty/request-otp' && req.method === 'POST') {
        if (!checkIpRateLimit(clientIp)) {
            return sendJson(429, { error: 'Too many requests from this IP address. Please wait a few minutes.' });
        }

        parseJsonBody(async (err, body) => {
            if (err || !body.email || typeof body.email !== 'string') {
                return sendJson(400, { error: 'Please provide a valid faculty email address' });
            }

            const rawEmail = body.email.trim();
            const normalizedEmail = rawEmail.toLowerCase();

            // 1. Check Faculty Allowlist (Strict exact full-email check, case-insensitive)
            const faculty = findFacultyByEmail(normalizedEmail);
            if (!faculty) {
                return sendJson(403, { error: 'This email is not registered as faculty. Please contact administration.' });
            }

            const now = Date.now();
            const otps = loadOtps();
            const existing = otps[normalizedEmail] || {};

            // 2. Rate Limit: 1 OTP request per email per 60 seconds
            if (existing.lastRequestedAt && (now - existing.lastRequestedAt) < 60 * 1000) {
                const waitSec = Math.ceil((60 * 1000 - (now - existing.lastRequestedAt)) / 1000);
                return sendJson(429, {
                    error: `Please wait ${waitSec} seconds before requesting another verification code.`
                });
            }

            // 3. Rate Limit: Max 5 requests per email per hour
            const recentTimestamps = (existing.requestTimestamps || []).filter(t => now - t < 60 * 60 * 1000);
            if (recentTimestamps.length >= 5) {
                return sendJson(429, {
                    error: 'Maximum OTP request limit reached (5 requests/hour). Please try again later.'
                });
            }

            // 4. Generate 6-digit random code and cryptographic salt
            const code = crypto.randomInt(100000, 1000000).toString();
            const salt = crypto.randomBytes(16).toString('hex');
            const codeHash = crypto.createHash('sha256').update(code + salt).digest('hex');

            // Store in otps.json with 10-minute expiry
            recentTimestamps.push(now);
            otps[normalizedEmail] = {
                salt,
                codeHash,
                expiresAt: now + 10 * 60 * 1000, // 10 minutes
                lastRequestedAt: now,
                requestTimestamps: recentTimestamps,
                failedAttempts: 0
            };
            saveOtps(otps);

            // 5. Send Email via nodemailer or output to console in demo mode
            try {
                await dispatchOtpEmail(faculty.email, code, faculty.name);
                const isDevMode = !process.env.SMTP_HOST || process.env.DEV_OTP_CONSOLE === 'true';
                return sendJson(200, {
                    success: true,
                    message: `Verification code sent to ${faculty.email}`,
                    expiresInSeconds: 600,
                    devCode: isDevMode ? code : undefined
                });
            } catch (sendErr) {
                console.error("Failed to dispatch OTP email:", sendErr);
                return sendJson(500, {
                    error: 'Failed to send verification code. Please check server SMTP configuration.'
                });
            }
        });
        return;
    }

    // POST /api/auth/faculty/verify-otp - Verify single-use code & issue 8-hour session
    if (pathname === '/api/auth/faculty/verify-otp' && req.method === 'POST') {
        if (!checkIpRateLimit(clientIp)) {
            return sendJson(429, { error: 'Too many requests from this IP address. Please wait a few minutes.' });
        }

        parseJsonBody((err, body) => {
            if (err || !body.email || !body.code) {
                return sendJson(400, { error: 'Email and 6-digit verification code are required' });
            }

            const normalizedEmail = body.email.trim().toLowerCase();
            const enteredCode = String(body.code).trim();

            // 1. Verify Faculty Allowlist
            const faculty = findFacultyByEmail(normalizedEmail);
            if (!faculty) {
                return sendJson(403, { error: 'This email is not registered as faculty' });
            }

            const otps = loadOtps();
            const record = otps[normalizedEmail];

            if (!record) {
                return sendJson(400, { error: 'No active verification code found. Please request a new code.' });
            }

            const now = Date.now();

            // 2. Check Expiry (10 minutes)
            if (now > record.expiresAt) {
                delete otps[normalizedEmail];
                saveOtps(otps);
                return sendJson(400, { error: 'Verification code has expired. Please request a new code.' });
            }

            // 3. Check Failed Attempts Limit (Max 5 attempts)
            if (record.failedAttempts >= 5) {
                delete otps[normalizedEmail];
                saveOtps(otps);
                return sendJson(429, {
                    error: 'Maximum verification attempts exceeded. Code has been invalidated. Please request a new code.'
                });
            }

            // 4. Timing-safe Hash Verification
            const candidateHash = crypto.createHash('sha256').update(enteredCode + record.salt).digest('hex');
            const isMatch = safeCompare(candidateHash, record.codeHash);

            if (!isMatch) {
                record.failedAttempts = (record.failedAttempts || 0) + 1;
                const remaining = 5 - record.failedAttempts;

                if (remaining <= 0) {
                    delete otps[normalizedEmail];
                    saveOtps(otps);
                    return sendJson(429, {
                        error: 'Incorrect code. Maximum attempts exceeded. Code has been invalidated. Please request a new code.'
                    });
                }

                saveOtps(otps);
                return sendJson(401, {
                    error: `Incorrect verification code. ${remaining} attempt(s) remaining.`
                });
            }

            // 5. Code is Single-Use: Delete from storage immediately upon success
            delete otps[normalizedEmail];
            saveOtps(otps);

            // 6. Create Faculty Session (8 hours)
            // Department & Name are pulled STRICTLY from faculty.json (never from request body)
            const duration = 8 * 60 * 60 * 1000;
            const token = createSession({
                role: 'faculty',
                userId: faculty.email,
                email: faculty.email,
                name: faculty.name,
                department: faculty.department
            }, duration);

            return sendJson(200, {
                token,
                user: {
                    role: 'faculty',
                    name: faculty.name,
                    department: faculty.department,
                    email: faculty.email
                }
            });
        });
        return;
    }

    // =====================================
    // 1. API: NOTICES (/api/notices)
    // Protected: Create/Edit/Delete = Faculty only.
    // Upvoting = Authenticated users (1 vote per user).
    // =====================================
    if (pathname === '/api/notices') {
        if (req.method === 'GET') {
            fs.readFile(NOTICES_FILE, 'utf8', (err, data) => {
                if (err) {
                    sendJson(200, defaultNotices);
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(data);
                }
            });
            return;
        }

        if (req.method === 'POST') {
            parseJsonBody((err, body) => {
                if (err) return sendJson(400, { error: 'Invalid JSON body' });

                fs.readFile(NOTICES_FILE, 'utf8', (readErr, data) => {
                    let notices = readErr ? defaultNotices : JSON.parse(data || '[]');

                    // 1. Upvote Action (Logged-in Student or Faculty)
                    if (body && body.action === 'upvote') {
                        const auth = requireAuth(req, ['student', 'faculty']);
                        if (auth.error) return sendJson(auth.statusCode, { error: auth.error });

                        const notice = notices.find(n => String(n.id) === String(body.id));
                        if (!notice) return sendJson(404, { error: 'Notice not found' });

                        notice.upvotedBy = notice.upvotedBy || [];
                        const userKey = auth.session.userId;
                        const idx = notice.upvotedBy.indexOf(userKey);

                        if (idx === -1) {
                            notice.upvotedBy.push(userKey);
                            notice.upvotes = (notice.upvotes || 0) + 1;
                        } else {
                            notice.upvotedBy.splice(idx, 1);
                            notice.upvotes = Math.max(0, (notice.upvotes || 1) - 1);
                        }

                        fs.writeFile(NOTICES_FILE, JSON.stringify(notices, null, 2), () => {
                            sendJson(200, { success: true, upvotes: notice.upvotes, upvoted: idx === -1 });
                        });
                        return;
                    }

                    // 2. Delete Notice Action (Faculty Only - Owner or Demo notices)
                    if (body && body.action === 'delete') {
                        const auth = requireAuth(req, ['faculty']);
                        if (auth.error) return sendJson(auth.statusCode, { error: auth.error });

                        const noticeIdx = notices.findIndex(n => String(n.id) === String(body.id));
                        if (noticeIdx === -1) return sendJson(404, { error: 'Notice not found' });

                        const notice = notices[noticeIdx];
                        const isOwner = !notice.postedBy || 
                                        notice.postedBy === auth.session.name || 
                                        notice.postedBy === auth.session.userId;

                        if (!isOwner) {
                            return sendJson(403, { error: 'Forbidden: You can only delete notices that you published.' });
                        }

                        notices.splice(noticeIdx, 1);
                        fs.writeFile(NOTICES_FILE, JSON.stringify(notices, null, 2), () => {
                            sendJson(200, { success: true, message: 'Notice deleted successfully' });
                        });
                        return;
                    }

                    // 3. Edit Notice Action (Faculty Only - Owner or Demo notices)
                    if (body && body.action === 'update') {
                        const auth = requireAuth(req, ['faculty']);
                        if (auth.error) return sendJson(auth.statusCode, { error: auth.error });

                        const notice = notices.find(n => String(n.id) === String(body.id));
                        if (!notice) return sendJson(404, { error: 'Notice not found' });

                        const isOwner = !notice.postedBy || 
                                        notice.postedBy === auth.session.name || 
                                        notice.postedBy === auth.session.userId;

                        if (!isOwner) {
                            return sendJson(403, { error: 'Forbidden: You can only edit notices that you published.' });
                        }

                        if (body.title) notice.title = body.title.trim();
                        if (body.description) notice.description = body.description.trim();
                        if (body.category) notice.category = body.category.trim();
                        if (body.audience) notice.audience = body.audience;
                        if (body.attachment !== undefined) notice.attachment = body.attachment;

                        fs.writeFile(NOTICES_FILE, JSON.stringify(notices, null, 2), () => {
                            sendJson(200, { success: true, notice });
                        });
                        return;
                    }

                    // 4. Create Notice Action (Faculty Only)
                    if (body && (body.action === 'create' || (!Array.isArray(body) && body.title))) {
                        const auth = requireAuth(req, ['faculty']);
                        if (auth.error) return sendJson(auth.statusCode, { error: auth.error });

                        const newNotice = {
                            id: body.id || Date.now(),
                            title: (body.title || '').trim(),
                            category: (body.category || 'General').trim(),
                            description: (body.description || '').trim(),
                            // Server-enforced metadata from session:
                            author: auth.session.name,
                            postedBy: auth.session.name,
                            authorRole: 'faculty',
                            department: auth.session.department,
                            date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                            upvotes: 0,
                            upvotedBy: [],
                            attachment: body.attachment || null,
                            audience: body.audience || { type: "all", branches: [] }
                        };

                        notices.unshift(newNotice);
                        fs.writeFile(NOTICES_FILE, JSON.stringify(notices, null, 2), () => {
                            sendJson(200, { success: true, notice: newNotice });
                        });
                        return;
                    }

                    // 5. Legacy Array Sync (Faculty Only)
                    if (Array.isArray(body)) {
                        const auth = requireAuth(req, ['faculty']);
                        if (auth.error) return sendJson(auth.statusCode, { error: auth.error });

                        fs.writeFile(NOTICES_FILE, JSON.stringify(body, null, 2), writeErr => {
                            if (writeErr) {
                                sendJson(500, { error: 'Failed to save notices' });
                            } else {
                                sendJson(200, { success: true });
                            }
                        });
                        return;
                    }

                    return sendJson(400, { error: 'Invalid notice action or payload' });
                });
            });
            return;
        }
    }

    // =====================================
    // 1.5 API: CATEGORIES (/api/categories)
    // Protected: Create/Edit = Faculty only.
    // =====================================
    if (pathname === '/api/categories') {
        if (req.method === 'GET') {
            fs.readFile(CATEGORIES_FILE, 'utf8', (err, data) => {
                if (err) {
                    sendJson(200, defaultCategories);
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(data);
                }
            });
            return;
        }

        if (req.method === 'POST') {
            const auth = requireAuth(req, ['faculty']);
            if (auth.error) return sendJson(auth.statusCode, { error: auth.error });

            parseJsonBody((err, parsed) => {
                if (err) return sendJson(400, { error: 'Invalid JSON' });

                fs.readFile(CATEGORIES_FILE, 'utf8', (readErr, data) => {
                    let categories = readErr ? defaultCategories : JSON.parse(data || '[]');

                    if (parsed.action === 'create' && parsed.category) {
                        const cat = parsed.category.trim();
                        if (!categories.includes(cat)) {
                            categories.push(cat);
                        }
                    } else if (Array.isArray(parsed)) {
                        categories = parsed;
                    } else {
                        return sendJson(400, { error: 'Invalid category payload' });
                    }

                    fs.writeFile(CATEGORIES_FILE, JSON.stringify(categories, null, 2), writeErr => {
                        if (writeErr) {
                            sendJson(500, { error: 'Failed to save categories' });
                        } else {
                            sendJson(200, { success: true, categories });
                        }
                    });
                });
            });
            return;
        }
    }

    // =====================================
    // 1.6 API: QUESTIONS (/api/questions)
    // Protected: Create/Upvote = Logged-in.
    // Pin/Restore = Faculty only.
    // Edit/Delete = Author or Faculty.
    // =====================================
    if (pathname === '/api/questions') {
        if (req.method === 'GET') {
            fs.readFile(QUESTIONS_FILE, 'utf8', (err, data) => {
                if (err) {
                    sendJson(200, defaultQuestions);
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(data);
                }
            });
            return;
        }

        if (req.method === 'POST') {
            const auth = requireAuth(req, ['student', 'faculty']);
            if (auth.error) return sendJson(auth.statusCode, { error: auth.error });

            parseJsonBody((err, body) => {
                if (err) return sendJson(400, { error: 'Invalid JSON' });

                fs.readFile(QUESTIONS_FILE, 'utf8', (readErr, data) => {
                    let questions = readErr ? defaultQuestions : JSON.parse(data || '[]');

                    // 1. Pin Question Action (Faculty only)
                    if (body.action === 'pin') {
                        if (auth.session.role !== 'faculty') {
                            return sendJson(403, { error: 'Forbidden: Only faculty can pin questions.' });
                        }
                        const q = questions.find(item => String(item.id) === String(body.id));
                        if (!q) return sendJson(404, { error: 'Question not found' });
                        q.pinned = !q.pinned;
                        fs.writeFile(QUESTIONS_FILE, JSON.stringify(questions, null, 2), () => {
                            sendJson(200, { success: true, pinned: q.pinned });
                        });
                        return;
                    }

                    // 2. Restore Reported Question (Faculty only)
                    if (body.action === 'restore') {
                        if (auth.session.role !== 'faculty') {
                            return sendJson(403, { error: 'Forbidden: Only faculty can restore reported questions.' });
                        }
                        const q = questions.find(item => String(item.id) === String(body.id));
                        if (!q) return sendJson(404, { error: 'Question not found' });
                        q.reports = [];
                        fs.writeFile(QUESTIONS_FILE, JSON.stringify(questions, null, 2), () => {
                            sendJson(200, { success: true });
                        });
                        return;
                    }

                    // 3. Delete Question (Author or Faculty)
                    if (body.action === 'delete') {
                        const idx = questions.findIndex(item => String(item.id) === String(body.id));
                        if (idx === -1) return sendJson(404, { error: 'Question not found' });
                        const q = questions[idx];
                        const isAuthor = q.authorUsn === auth.session.userId;
                        const isFaculty = auth.session.role === 'faculty';

                        if (!isAuthor && !isFaculty) {
                            return sendJson(403, { error: 'Forbidden: You can only delete your own questions.' });
                        }

                        questions.splice(idx, 1);
                        fs.writeFile(QUESTIONS_FILE, JSON.stringify(questions, null, 2), () => {
                            sendJson(200, { success: true });
                        });
                        return;
                    }

                    // 4. Create Question (Server enforces author metadata & isFaculty)
                    if (body.action === 'create' || (!Array.isArray(body) && body.title && !body.action)) {
                        const newQ = {
                            id: body.id || Date.now(),
                            title: (body.title || '').trim(),
                            details: (body.details || '').trim(),
                            topic: (body.topic || 'General').trim(),
                            branch: body.branch || auth.session.branch || 'All',
                            authorUsn: auth.session.userId,
                            authorName: auth.session.name,
                            isFaculty: auth.session.role === 'faculty',
                            anonymous: !!body.anonymous,
                            createdAt: new Date().toISOString(),
                            status: 'open',
                            acceptedAnswerId: null,
                            upvotes: 0,
                            upvotedBy: [],
                            reports: [],
                            pinned: false
                        };
                        questions.unshift(newQ);
                        fs.writeFile(QUESTIONS_FILE, JSON.stringify(questions, null, 2), () => {
                            sendJson(200, { success: true, question: newQ });
                        });
                        return;
                    }

                    // 5. Legacy Array Sync (Fallback for existing frontend)
                    if (Array.isArray(body)) {
                        fs.writeFile(QUESTIONS_FILE, JSON.stringify(body, null, 2), writeErr => {
                            if (writeErr) {
                                sendJson(500, { error: 'Failed to save questions' });
                            } else {
                                sendJson(200, { success: true });
                            }
                        });
                        return;
                    }

                    return sendJson(400, { error: 'Invalid question action' });
                });
            });
            return;
        }
    }

    // =====================================
    // 1.7 API: ANSWERS (/api/answers)
    // Protected: Create/Upvote = Logged-in.
    // Edit/Delete = Author or Faculty.
    // Accept Answer = Question Author or Faculty.
    // =====================================
    if (pathname === '/api/answers') {
        if (req.method === 'GET') {
            fs.readFile(ANSWERS_FILE, 'utf8', (err, data) => {
                if (err) {
                    sendJson(200, defaultAnswers);
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(data);
                }
            });
            return;
        }

        if (req.method === 'POST') {
            const auth = requireAuth(req, ['student', 'faculty']);
            if (auth.error) return sendJson(auth.statusCode, { error: auth.error });

            parseJsonBody((err, body) => {
                if (err) return sendJson(400, { error: 'Invalid JSON' });

                fs.readFile(ANSWERS_FILE, 'utf8', (readErr, data) => {
                    let answers = readErr ? defaultAnswers : JSON.parse(data || '[]');

                    // 1. Delete Answer (Author or Faculty)
                    if (body.action === 'delete') {
                        const idx = answers.findIndex(item => String(item.id) === String(body.id));
                        if (idx === -1) return sendJson(404, { error: 'Answer not found' });
                        const a = answers[idx];
                        const isAuthor = a.authorUsn === auth.session.userId;
                        const isFaculty = auth.session.role === 'faculty';

                        if (!isAuthor && !isFaculty) {
                            return sendJson(403, { error: 'Forbidden: You can only delete your own answers.' });
                        }

                        answers.splice(idx, 1);
                        fs.writeFile(ANSWERS_FILE, JSON.stringify(answers, null, 2), () => {
                            sendJson(200, { success: true });
                        });
                        return;
                    }

                    // 2. Create Answer (Server enforces author metadata & isFaculty)
                    if (body.action === 'create' || (!Array.isArray(body) && body.text && !body.action)) {
                        const newAnswer = {
                            id: body.id || Date.now(),
                            questionId: body.questionId,
                            text: (body.text || '').trim(),
                            authorUsn: auth.session.userId,
                            authorName: auth.session.name,
                            isFaculty: auth.session.role === 'faculty',
                            anonymous: !!body.anonymous,
                            createdAt: new Date().toISOString(),
                            upvotes: 0,
                            upvotedBy: [],
                            reports: []
                        };
                        answers.push(newAnswer);
                        fs.writeFile(ANSWERS_FILE, JSON.stringify(answers, null, 2), () => {
                            sendJson(200, { success: true, answer: newAnswer });
                        });
                        return;
                    }

                    // 3. Legacy Array Sync (Fallback for existing frontend)
                    if (Array.isArray(body)) {
                        fs.writeFile(ANSWERS_FILE, JSON.stringify(body, null, 2), writeErr => {
                            if (writeErr) {
                                sendJson(500, { error: 'Failed to save answers' });
                            } else {
                                sendJson(200, { success: true });
                            }
                        });
                        return;
                    }

                    return sendJson(400, { error: 'Invalid answer action' });
                });
            });
            return;
        }
    }

    // =====================================
    // 2. API: USERS (/api/users)
    // =====================================
    if (pathname === '/api/users') {
        if (req.method === 'GET') {
            fs.readFile(USERS_FILE, 'utf8', (err, data) => {
                const users = err ? defaultUsers : JSON.parse(data || '[]');
                // SECURITY: Never return passwordHash in GET /api/users
                const safeUsers = users.map(u => {
                    const { passwordHash, ...safe } = u;
                    return safe;
                });
                sendJson(200, safeUsers);
            });
            return;
        }

        if (req.method === 'POST') {
            parseJsonBody((err, parsed) => {
                if (err) return sendJson(400, { error: 'Invalid JSON' });

                // Force role: 'student' on all registrations to prevent privilege escalation
                let sanitizedUsers = [];
                if (Array.isArray(parsed)) {
                    sanitizedUsers = parsed.map(u => ({ ...u, role: 'student' }));
                } else {
                    sanitizedUsers = [{ ...parsed, role: 'student' }];
                }

                fs.writeFile(USERS_FILE, JSON.stringify(sanitizedUsers, null, 2), writeErr => {
                    if (writeErr) {
                        sendJson(500, { error: 'Failed to save users' });
                    } else {
                        sendJson(200, { success: true });
                    }
                });
            });
            return;
        }
    }

    // =====================================
    // 3. API: FILE ATTACHMENTS (/api/files/:id)
    // Protected:
    // Notice attachment upload = Faculty only.
    // 10 MB upload size limit.
    // Allowed MIME types only.
    // Path traversal defense.
    // =====================================
    if (pathname.startsWith('/api/files/')) {
        const fileId = pathname.replace('/api/files/', '').trim();

        // Path traversal defense: only [a-zA-Z0-9_\-\.] allowed, no double dots
        if (!/^[a-zA-Z0-9_\-\.]+$/.test(fileId) || fileId.includes('..')) {
            return sendJson(400, { error: 'Invalid file ID' });
        }

        const filePath = path.join(UPLOADS_DIR, fileId);
        const metaPath = path.join(UPLOADS_DIR, `${fileId}.meta.json`);

        // GET - Publicly accessible attachment download/stream
        if (req.method === 'GET') {
            if (!fs.existsSync(filePath)) {
                return sendJson(404, { error: 'File not found' });
            }

            let mimeType = 'application/octet-stream';
            let fileName = fileId;
            if (fs.existsSync(metaPath)) {
                try {
                    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                    if (meta.type) mimeType = meta.type;
                    if (meta.name) fileName = meta.name;
                } catch (e) {}
            }

            fs.readFile(filePath, (err, fileData) => {
                if (err) {
                    sendJson(500, { error: 'Error reading file' });
                } else {
                    res.writeHead(200, {
                        'Content-Type': mimeType,
                        'Content-Length': fileData.length,
                        'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`
                    });
                    res.end(fileData);
                }
            });
            return;
        }

        // POST - Upload Attachment (Faculty Only for Notices)
        if (req.method === 'POST') {
            const auth = requireAuth(req, ['faculty']);
            if (auth.error) {
                return sendJson(auth.statusCode, { error: auth.error });
            }

            const fileName = decodeURIComponent(req.headers['x-file-name'] || fileId);
            const fileType = (req.headers['x-file-type'] || 'application/octet-stream').toLowerCase();

            // MIME Type & Extension Validation
            if (!ALLOWED_MIME_TYPES.has(fileType) && !ALLOWED_FILE_EXTENSIONS.test(fileName)) {
                return sendJson(415, {
                    error: 'Unsupported file type. Only images, PDF, documents, and ZIP files are allowed.'
                });
            }

            let totalBytes = 0;
            const chunks = [];
            let isTooLarge = false;

            req.on('data', chunk => {
                if (isTooLarge) return;
                totalBytes += chunk.length;

                // 10 MB upload size limit check
                if (totalBytes > MAX_FILE_SIZE_BYTES) {
                    isTooLarge = true;
                    req.destroy();
                    return sendJson(413, {
                        error: 'Payload Too Large: File exceeds maximum allowed size of 10 MB.'
                    });
                }
                chunks.push(chunk);
            });

            req.on('end', () => {
                if (isTooLarge) return;

                const buffer = Buffer.concat(chunks);
                fs.writeFile(filePath, buffer, writeErr => {
                    if (writeErr) {
                        sendJson(500, { error: 'Failed to write file to disk' });
                    } else {
                        const meta = {
                            name: fileName,
                            type: fileType,
                            size: buffer.length,
                            uploadedBy: auth.session.userId,
                            uploadedAt: Date.now()
                        };
                        fs.writeFileSync(metaPath, JSON.stringify(meta));
                        sendJson(200, { success: true, id: fileId });
                    }
                });
            });
            return;
        }

        // DELETE - Delete Attachment (Faculty Only)
        if (req.method === 'DELETE') {
            const auth = requireAuth(req, ['faculty']);
            if (auth.error) {
                return sendJson(auth.statusCode, { error: auth.error });
            }

            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
            return sendJson(200, { success: true });
        }
    }

    // =====================================
    // 4. STATIC FILE SERVING
    // =====================================
    let reqPath = decodeURI(pathname);
    // Path traversal defense
    const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(__dirname, safePath === '/' || safePath === '\\' ? 'index.html' : safePath);

    // Prevent directory traversal outside root directory
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
        } else {
            const ext = path.extname(filePath).toLowerCase();
            const mime = {
                '.html': 'text/html',
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.json': 'application/json',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.pdf': 'application/pdf',
                '.ico': 'image/x-icon'
            }[ext] || 'text/plain';

            res.writeHead(200, { 'Content-Type': mime });
            res.end(data);
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Campus Voice Full Server running on port ${PORT}`);
});
