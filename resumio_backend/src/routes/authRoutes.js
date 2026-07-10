const express = require("express");
const {
  login,
  managerLogin,
  getOperatorSettings,
  updateOperatorSettings,
} = require("../controllers/authController");
const { authMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", login);
router.post("/manager-login", managerLogin);

router.get("/operator-settings", authMiddleware, getOperatorSettings);
router.post("/operator-settings", authMiddleware, updateOperatorSettings);

module.exports = router;
