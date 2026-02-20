const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const patientDir = path.join(uploadDir, req.params.patientId || 'general');
    if (!fs.existsSync(patientDir)) fs.mkdirSync(patientDir, { recursive: true });
    cb(null, patientDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xlsx', '.csv'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('File type not allowed. Accepted: PDF, JPG, PNG, DOC, DOCX, XLSX, CSV'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

module.exports = upload;
