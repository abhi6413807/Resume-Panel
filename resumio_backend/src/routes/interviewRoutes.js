const express = require("express");
const { getUpcomingInterviews } = require("../controllers/interviewController");
const { authMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);
router.get("/", getUpcomingInterviews);

module.exports = router;
