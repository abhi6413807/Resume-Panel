const express = require("express");
const { authMiddleware } = require("../middleware/authMiddleware");
const { documentUpload } = require("../middleware/uploadMiddleware");
const {
  parseAndCreateCandidate,
  createCandidateFromParsed,
} = require("../controllers/documentController");

const router = express.Router();

// Parse document and extract candidate data
router.post("/parse", authMiddleware, documentUpload.single("document"), parseAndCreateCandidate);

// Create candidate from parsed data
router.post("/create-from-parsed", authMiddleware, createCandidateFromParsed);

module.exports = router;
