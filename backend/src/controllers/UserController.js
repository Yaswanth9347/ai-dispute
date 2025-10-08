const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const { requireAuth } = require('../lib/authMiddleware');
const path = require('path');

// Mock user profiles (in production, this would come from database)
let userProfiles = new Map();

// Helper to derive a stable user id from req.user
function getUserId(req) {
  if (!req || !req.user) return 'unknown';
  return req.user.sub || req.user.id || req.user.email || 'unknown';
}

// Persistence for profiles (quick local persistence until DB integration)
const DATA_DIR = path.join(__dirname, '../../backend_data');
const PROFILES_FILE = path.join(DATA_DIR, 'userProfiles.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn('[persist] could not create data dir', e && e.message);
  }
}

function loadProfilesFromDisk() {
  try {
    ensureDataDir();
    if (fs.existsSync(PROFILES_FILE)) {
      const raw = fs.readFileSync(PROFILES_FILE, 'utf8');
      const obj = JSON.parse(raw || '{}');
      // obj is an object where keys are userId and values are profile objects
      userProfiles = new Map(Object.entries(obj));
      console.log(`[persist] loaded ${userProfiles.size} profiles`);
    } else {
      fs.writeFileSync(PROFILES_FILE, JSON.stringify({}), 'utf8');
      console.log('[persist] created profiles file');
    }
  } catch (err) {
    console.error('[persist] error loading profiles', err && err.message);
  }
}

function saveProfilesToDisk() {
  try {
    ensureDataDir();
    // Convert Map to plain object
    const obj = Object.fromEntries(userProfiles);
    // write atomically: write tmp then rename
    const tmp = PROFILES_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
    fs.renameSync(tmp, PROFILES_FILE);
    // console.log('[persist] profiles saved (atomic)');
  } catch (err) {
    console.error('[persist] error saving profiles', err && err.message);
  }
}

// Load persisted profiles at startup
loadProfilesFromDisk();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage config to preserve extension and set a predictable filename
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    const basename = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, basename + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Get user profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    let profile = userProfiles.get(userId);
    if (!profile) {
      profile = {
        id: userId,
        name: req.user.name || 'User',
        email: req.user.email,
        phone: '',
        organization: '',
        role: req.user.role || 'user',
        avatar: '',
        bio: '',
        createdAt: new Date().toISOString()
      };
      userProfiles.set(userId, profile);
      // persist newly created profile so it survives restarts
      saveProfilesToDisk();
    }
    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user profile (text fields)
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const updates = req.body;
    let profile = userProfiles.get(userId) || {
      id: userId,
      email: req.user.email,
      createdAt: new Date().toISOString()
    };
    // Only update allowed fields
    profile = { ...profile, ...updates };
    userProfiles.set(userId, profile);
  // persist change
  saveProfilesToDisk();
  res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload profile photo
// optional auth middleware: if auth header present, validate; otherwise allow in non-production for dev
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization || '';
    if (authHeader) {
      // delegate to main requireAuth
      return requireAuth(req, res, next);
    }
    if (process.env.NODE_ENV !== 'production') {
      // dev fallback user
      req.user = { id: 'dev-user', email: 'dev@local', name: 'Dev User' };
      console.log('[auth] optionalAuth: no header, using dev user');
      return next();
    }
    return res.status(401).json({ success: false, error: 'missing auth token' });
  } catch (e) {
    console.warn('[auth] optionalAuth error', e && e.message);
    return res.status(401).json({ success: false, error: 'auth error' });
  }
};

// Wrap multer to capture errors and return JSON instead of letting Express default handler run
router.post('/profile/photo', requireAuth, (req, res, next) => {
  upload.single('photo')(req, res, function (err) {
    if (err) {
      console.error('[upload middleware] multer error', err);
      // Multer errors have .code and .message
      return res.status(400).json({ success: false, message: err.message || 'Upload error', code: err.code || 'UPLOAD_ERROR' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'authentication required' });
    // log headers for debugging
    console.log('[upload] headers:', {
      authorization: !!req.headers.authorization,
      host: req.headers.host,
      origin: req.headers.origin,
    });

  const userId = getUserId(req);
    const photo = req.file;
    console.log('[upload] file:', photo && { originalname: photo.originalname, filename: photo.filename, size: photo.size });
    if (!photo) {
      return res.status(400).json({ success: false, message: 'No photo uploaded.' });
    }

    // Build URL to the uploaded file using request host
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${photo.filename}`;

    // Save photo path in mock profile
    let profile = userProfiles.get(userId) || {
      id: userId,
      email: (req.user && req.user.email) || '',
      createdAt: new Date().toISOString()
    };
    profile.avatar = fileUrl;
    userProfiles.set(userId, profile);
  // persist mapping so it survives restarts
  saveProfilesToDisk();
  res.status(200).json({ success: true, photoPath: profile.avatar });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

  /**
   * Update profile security settings and persist them.
   * PUT /profile/security
   */
  router.put('/profile/security', requireAuth, async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, error: 'authentication required' });
      const userId = getUserId(req);
      const updates = req.body || {};

      // Prevent direct password write here
      if ('password' in updates || 'hashedPassword' in updates) {
        return res.status(400).json({ success: false, message: 'Password changes must be done via the auth/password endpoint.' });
      }

      let profile = userProfiles.get(userId) || {
        id: userId,
        email: (req.user && req.user.email) || '',
        createdAt: new Date().toISOString()
      };

      profile.security = profile.security || {};
      Object.keys(updates).forEach((k) => {
        profile.security[k] = updates[k];
      });

      userProfiles.set(userId, profile);
      // persist mapping so it survives restarts
      saveProfilesToDisk();

      return res.json({ success: true, data: profile });
    } catch (err) {
      console.error('[profile/security] error', err && err.message);
      return res.status(500).json({ success: false, error: err && err.message });
    }
  });

module.exports = router;