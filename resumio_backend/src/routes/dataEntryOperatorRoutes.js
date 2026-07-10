const express = require("express");
const {
  loginOperator,
  getProfile,
  updateProfile,
  uploadResumeOperator,
  changePassword,
  updateProfilePhoto,
  getInterviews,
  getNotifications,
  markNotificationRead,
  forgotPassword,
  resetPassword,
} = require("../controllers/dataEntryOperatorController");
const { authMiddleware } = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");

const router = express.Router();

// Public routes
router.post("/auth/login", loginOperator);
router.post("/auth/forgot-password", forgotPassword);
router.post("/auth/reset-password/:token", resetPassword);

// Private routes (require token)
router.use(authMiddleware);

router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.post("/resume/upload", upload.single("resume"), uploadResumeOperator);
router.get("/interviews", getInterviews);
router.get("/notifications", getNotifications);
router.patch("/notifications/:id/read", markNotificationRead);
router.put("/settings/password", changePassword);
router.post("/profile/photo", updateProfilePhoto);

module.exports = router;
