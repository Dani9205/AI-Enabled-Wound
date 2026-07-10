const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', 'uploads', 'profile-photos');

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const safeBaseName = path
      .basename(file.originalname || 'profile-photo', extension)
      .replace(/[^a-z0-9_-]/gi, '-')
      .slice(0, 50);

    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeBaseName}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const allowedExtensions = new Set([
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.heic',
    '.heif',
    '.gif',
  ]);
  const isImageMime = file.mimetype && file.mimetype.startsWith('image/');
  const hasImageExtension = allowedExtensions.has(extension);

  if (!isImageMime && !hasImageExtension) {
    return cb(new Error('Only image files are allowed'));
  }

  return cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

const uploadProfilePhoto = (req, res, next) => {
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
    { name: 'profile_photo', maxCount: 1 },
    { name: 'profilePhoto', maxCount: 1 },
  ])(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          message: 'Profile photo must be 15 MB or smaller',
        });
      }

      return res.status(400).json({ message: error.message });
    }

    return res.status(400).json({ message: error.message || 'Profile photo upload failed' });
  });
};

module.exports = uploadProfilePhoto;
