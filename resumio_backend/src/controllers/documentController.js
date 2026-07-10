const Candidate = require("../models/Candidate");
const { extractTextWithFallback, parseCandidateData } = require("../utils/documentParser");
const { ALLOWED_RESUME_MIME_TYPES } = require("../middleware/uploadMiddleware");
const fs = require("fs");

async function parseAndCreateCandidate(req, res) {
  const uploadedFile = req.file;

  try {
    if (!uploadedFile) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = uploadedFile.path;
    const fileType = uploadedFile.mimetype;

    // Validate file type
    if (!ALLOWED_RESUME_MIME_TYPES.includes(fileType)) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        message: "Only PDF and DOCX files are supported",
      });
    }

    // Extract text from document
    const { text: extractedText, extractionMeta } = await extractTextWithFallback(filePath, fileType);

    // Parse candidate data
    const parsedResult = parseCandidateData(extractedText);

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    // Return parsed data for user confirmation
    return res.json({
      extractedData: parsedResult.candidate,
      confidence: parsedResult.confidence,
      extractionMeta,
      extractedText: extractedText.substring(0, 500), // First 500 chars for preview
    });
  } catch (error) {
    // Clean up file if it exists
    if (uploadedFile && uploadedFile.path && fs.existsSync(uploadedFile.path)) {
      fs.unlinkSync(uploadedFile.path);
    }

    return res.status(400).json({
      message: "Document parsing failed",
      error: error.message,
    });
  }
}

async function createCandidateFromParsed(req, res) {
  try {
    const payload = {
      ...req.body,
      skills: Array.isArray(req.body.skills)
        ? req.body.skills
        : typeof req.body.skills === "string"
        ? req.body.skills.split(",").map((s) => s.trim())
        : [],
    };

    if (!payload.status || payload.status === "") {
      payload.status = "Applied";
    }

    if (!payload.roleApplied || payload.roleApplied.trim() === "") {
      payload.roleApplied = "Not Specified";
    }

    if (req.user && req.user.role && req.user.role.toUpperCase() === "DATA_ENTRY_OPERATOR") {
      payload.createdByOperator = true;
      payload.sentToManager = false;
    }

    let existingCandidate = null;
    if (payload.email) {
      existingCandidate = await Candidate.findOne({ email: payload.email.toLowerCase().trim() });
    }
    if (!existingCandidate && payload.phone) {
      existingCandidate = await Candidate.findOne({ phone: payload.phone.trim() });
    }

    let candidate;
    if (existingCandidate) {
      // Update existing candidate
      candidate = await Candidate.findByIdAndUpdate(existingCandidate._id, payload, {
        new: true,
        runValidators: true,
      });
    } else {
      // Create new candidate
      candidate = await Candidate.create(payload);
    }

    return res.status(existingCandidate ? 200 : 201).json({
      message: existingCandidate ? "Candidate updated from document" : "Candidate created from document",
      candidate,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Candidate creation failed",
        error: "A candidate with this email or phone already exists."
      });
    }
    return res.status(400).json({
      message: "Candidate creation/update failed",
      error: error.message,
    });
  }
}

module.exports = {
  parseAndCreateCandidate,
  createCandidateFromParsed,
};
