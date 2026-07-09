const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', 'uploads', 'voice-dictations');

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const safeBaseName = path
      .basename(file.originalname || 'voice-dictation', extension)
      .replace(/[^a-z0-9_-]/gi, '-')
      .slice(0, 50);

    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeBaseName}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  const isAudio = file.mimetype && file.mimetype.startsWith('audio/');
  const isOctetStream = file.mimetype === 'application/octet-stream';

  if (!isAudio && !isOctetStream) {
    return cb(new Error('Only audio files are allowed'));
  }

  return cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

const uploadVoiceDictation = (req, res, next) => {
  upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'voice', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'voice_file', maxCount: 1 },
    { name: 'voiceFile', maxCount: 1 },
    { name: 'audio_file', maxCount: 1 },
    { name: 'audioFile', maxCount: 1 },
  ])(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(400).json({ message: error.message || 'Voice dictation upload failed' });
  });
};

module.exports = uploadVoiceDictation;
