const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Manager = require("../models/Manager");

async function ensureDefaultAdmin() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";

  const existingAdmin = await Admin.findOne({ email: adminEmail });
  if (existingAdmin) return;

  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  await Admin.create({ email: adminEmail, password: hashedPassword });
  console.log("Default admin created:", adminEmail);
}

async function ensureDefaultManager() {
  const managerEmail = (process.env.MANAGER_EMAIL || "manager@example.com").toLowerCase();
  const managerPassword = process.env.MANAGER_PASSWORD || "Manager@123";

  const existingManager = await Manager.findOne({ email: managerEmail });
  if (existingManager) return;

  const hashedPassword = await bcrypt.hash(managerPassword, 10);
  await Manager.create({ email: managerEmail, password: hashedPassword });
  console.log("Default manager created:", managerEmail);
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { adminId: admin._id, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      token,
      admin: { email: admin.email },
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
}

async function managerLogin(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const manager = await Manager.findOne({ email: email.toLowerCase() });
    if (!manager) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, manager.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { managerId: manager._id, email: manager.email },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      token,
      manager: { email: manager.email },
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
}

async function ensureDefaultOperator() {
  const operatorEmail = (process.env.OPERATOR_EMAIL || "operator@example.com").toLowerCase();
  const operatorPassword = process.env.OPERATOR_PASSWORD || "Operator@123";

  const Operator = require("../models/Operator");
  const existingOperator = await Operator.findOne({ email: operatorEmail });
  if (existingOperator) return;

  const hashedPassword = await bcrypt.hash(operatorPassword, 10);
  await Operator.create({ email: operatorEmail, password: hashedPassword });
  console.log("Default operator created:", operatorEmail);
}

async function getOperatorSettings(req, res) {
  try {
    if (!req.user.adminId) {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    const Operator = require("../models/Operator");
    const operator = await Operator.findOne().select("-password");
    if (!operator) {
      return res.json({ email: "", exists: false });
    }
    return res.json({ email: operator.email, exists: true });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch operator settings", error: error.message });
  }
}

async function updateOperatorSettings(req, res) {
  try {
    if (!req.user.adminId) {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const Operator = require("../models/Operator");
    let operator = await Operator.findOne();

    const updateData = { email: email.toLowerCase() };
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    if (operator) {
      operator = await Operator.findByIdAndUpdate(operator._id, updateData, { new: true });
    } else {
      if (!password) {
        return res.status(400).json({ message: "Password is required to set Operator credentials" });
      }
      operator = await Operator.create(updateData);
    }

    return res.json({ message: "Operator credentials updated successfully", email: operator.email });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update operator settings", error: error.message });
  }
}

module.exports = {
  login,
  ensureDefaultAdmin,
  managerLogin,
  ensureDefaultManager,
  ensureDefaultOperator,
  getOperatorSettings,
  updateOperatorSettings,
};
