const express = require("express");
const {
  createCandidate,
  getCandidates,
  getCandidateById,
  updateCandidate,
  deleteCandidate,
  uploadResume,
  scheduleInterview,
  updateInterviewStatus,
  sendCandidatesToManager,
} = require("../controllers/candidateController");
const { authMiddleware } = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/", getCandidates);
router.post("/", createCandidate);
router.post("/send-to-manager", sendCandidatesToManager);
router.get("/:id", getCandidateById);
router.put("/:id", updateCandidate);
router.delete("/:id", deleteCandidate);
router.post("/:id/resume", upload.single("resume"), uploadResume);
router.post("/:id/interviews", scheduleInterview);
router.patch("/:candidateId/interviews/:interviewId/status", updateInterviewStatus);

module.exports = router;
