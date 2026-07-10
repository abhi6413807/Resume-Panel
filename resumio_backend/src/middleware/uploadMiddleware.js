const fs = require("fs");
const path = require("path");
const multer = require("multer");

const MIME_TYPES = {
  PDF: "application/pdf",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const ALLOWED_RESUME_MIME_TYPES = [MIME_TYPES.PDF, MIME_TYPES.DOCX];

function createStorage(subFolder) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, "..", "..", "uploads", subFolder);
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || ".pdf";
      const baseName = path
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .toLowerCase();
      cb(null, `${Date.now()}-${baseName}${ext.toLowerCase()}`);
    },
  });
}

function createUpload({ subFolder, allowedMimeTypes, maxFileSizeMb }) {
  return multer({
    storage: createStorage(subFolder),
    fileFilter: (req, file, cb) => {
      const isAllowedMime = allowedMimeTypes.includes(file.mimetype);
      const isAllowedExt = allowedMimeTypes.some((mime) => {
        if (mime === MIME_TYPES.PDF) {
          return path.extname(file.originalname).toLowerCase() === ".pdf";
        }
        if (mime === MIME_TYPES.DOCX) {
          return path.extname(file.originalname).toLowerCase() === ".docx";
        }
        return false;
      });

      if (isAllowedMime || isAllowedExt) {
        cb(null, true);
      } else {
        cb(new Error("Only PDF and DOCX files are allowed"));
      }
    },
    limits: {
      fileSize: maxFileSizeMb * 1024 * 1024,
    },
  });
}

const resumeUpload = createUpload({
  subFolder: "resumes",
  allowedMimeTypes: ALLOWED_RESUME_MIME_TYPES,
  maxFileSizeMb: 10,
});

const documentUpload = createUpload({
  subFolder: "documents",
  allowedMimeTypes: ALLOWED_RESUME_MIME_TYPES,
  maxFileSizeMb: 10,
});

module.exports = {
  upload: resumeUpload,
  resumeUpload,
  documentUpload,
  MIME_TYPES,
  ALLOWED_RESUME_MIME_TYPES,
};
