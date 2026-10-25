// ==================================================
// CAMPUS VOICE - LOCAL BACKEND SERVER
// Provides cross-browser file and notice synchronization
// Allows Chrome (Faculty) and Edge (Student) to seamlessly
// share announcements, accounts, and PDF/image attachments.
// ==================================================

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const NOTICES_FILE = path.join(DATA_DIR, 'notices.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');

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
const defaultCategories = ["Placements", "Exams", "Hackathons", "Cultural"];
if (!fs.existsSync(CATEGORIES_FILE)) {
    fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(defaultCategories, null, 2));
}

// Helper to set standard CORS headers
function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-File-Name, X-File-Type');
}

const server = http.createServer((req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
    const pathname = parsedUrl.pathname;

    // =====================================
    // 1. API: NOTICES (/api/notices)
    // =====================================
    if (pathname === '/api/notices') {
        if (req.method === 'GET') {
            fs.readFile(NOTICES_FILE, 'utf8', (err, data) => {
                if (err) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(defaultNotices));
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(data);
                }
            });
            return;
        }

        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    fs.writeFile(NOTICES_FILE, JSON.stringify(parsed, null, 2), err => {
                        if (err) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Failed to save notices' }));
                        } else {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true }));
                        }
                    });
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
            return;
        }
    }

    // =====================================
    // 1.5 API: CATEGORIES (/api/categories)
    // =====================================
    if (pathname === '/api/categories') {
        if (req.method === 'GET') {
            fs.readFile(CATEGORIES_FILE, 'utf8', (err, data) => {
                if (err) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(defaultCategories));
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(data);
                }
            });
            return;
        }

        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (!Array.isArray(parsed)) throw new Error("Categories must be an array");
                    fs.writeFile(CATEGORIES_FILE, JSON.stringify(parsed, null, 2), err => {
                        if (err) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Failed to save categories' }));
                        } else {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true }));
                        }
                    });
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
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
                if (err) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(defaultUsers));
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(data);
                }
            });
            return;
        }

        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    fs.writeFile(USERS_FILE, JSON.stringify(parsed, null, 2), err => {
                        if (err) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Failed to save users' }));
                        } else {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true }));
                        }
                    });
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
            return;
        }
    }

    // =====================================
    // 3. API: FILE ATTACHMENTS (/api/files/:id)
    // =====================================
    if (pathname.startsWith('/api/files/')) {
        const fileId = pathname.replace('/api/files/', '').trim();
        const filePath = path.join(UPLOADS_DIR, fileId);
        const metaPath = path.join(UPLOADS_DIR, `${fileId}.meta.json`);

        if (req.method === 'GET') {
            if (!fs.existsSync(filePath)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'File not found' }));
                return;
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
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Error reading file' }));
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

        if (req.method === 'POST') {
            const fileName = decodeURIComponent(req.headers['x-file-name'] || fileId);
            const fileType = req.headers['x-file-type'] || 'application/octet-stream';

            const chunks = [];
            req.on('data', chunk => { chunks.push(chunk); });
            req.on('end', () => {
                const buffer = Buffer.concat(chunks);
                fs.writeFile(filePath, buffer, err => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to write file' }));
                    } else {
                        const meta = { name: fileName, type: fileType, size: buffer.length };
                        fs.writeFileSync(metaPath, JSON.stringify(meta));
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, id: fileId }));
                    }
                });
            });
            return;
        }

        if (req.method === 'DELETE') {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            return;
        }
    }

    // =====================================
    // 4. STATIC FILE SERVING
    // =====================================
    let reqPath = decodeURI(pathname);
    let filePath = path.join(__dirname, reqPath === '/' ? 'index.html' : reqPath);

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

server.listen(PORT, () => {
    console.log(`Campus Voice Full Server running on http://localhost:${PORT}`);
});
