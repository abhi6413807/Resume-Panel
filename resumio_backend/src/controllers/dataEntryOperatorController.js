const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Candidate = require("../models/Candidate");
const Operator = require("../models/Operator");
const Notification = require("../models/Notification");
const { extractTextWithFallback, parseCandidateData } = require("../utils/documentParser");
const fs = require("fs");
const path = require("path");

function normalizeCsvToArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// 2. Login Operator
async function loginOperator(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const operator = await Operator.findOne({ email: email.toLowerCase() });

    if (!operator) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, operator.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { candidateId: operator._id, email: operator.email, role: "DATA_ENTRY_OPERATOR" },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      token,
      candidate: {
        _id: operator._id,
        fullName: "Data Entry Operator",
        email: operator.email,
        role: "DATA_ENTRY_OPERATOR",
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
}

// 3. Get Profile
async function getProfile(req, res) {
  try {
    const candidate = await Candidate.findById(req.user.candidateId).select("-password");
    if (!candidate) {
      return res.status(404).json({ message: "Operator profile not found" });
    }
    return res.json(candidate);
  } catch (error) {
    return res.status(500).json({ message: "Fetch profile failed", error: error.message });
  }
}

// 4. Update Profile
async function updateProfile(req, res) {
  try {
    const candidateId = req.user.candidateId;
    const {
      fullName,
      phone,
      address,
      city,
      state,
      country,
      linkedin,
      github,
      portfolio,
      skills,
      education,
      experience,
      summary,
      roleApplied,
    } = req.body;

    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({ message: "Operator not found" });
    }

    if (fullName) candidate.fullName = fullName;
    if (phone) candidate.phone = phone;
    if (address !== undefined) candidate.address = address;
    if (city !== undefined) candidate.city = city;
    if (state !== undefined) candidate.state = state;
    if (country !== undefined) candidate.country = country;
    if (linkedin !== undefined) candidate.linkedin = linkedin;
    if (github !== undefined) candidate.github = github;
    if (portfolio !== undefined) candidate.portfolio = portfolio;
    if (summary !== undefined) candidate.summary = summary;
    if (roleApplied !== undefined) candidate.roleApplied = roleApplied;

    if (skills !== undefined) {
      candidate.skills = normalizeCsvToArray(skills);
    }
    if (education !== undefined) {
      candidate.education = education;
    }
    if (experience !== undefined) {
      candidate.experience = experience;
    }

    await candidate.save();

    // Create profile updated notification
    await Notification.create({
      candidateId: candidate._id,
      message: "Your profile details have been successfully updated.",
      type: "Profile Updated",
    });

    return res.json({
      message: "Profile updated successfully",
      candidate,
    });
  } catch (error) {
    return res.status(400).json({ message: "Update profile failed", error: error.message });
  }
}

// 5. Resume Upload & Parsing
async function uploadResumeOperator(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resume file is required" });
    }

    const candidate = await Candidate.findById(req.user.candidateId);
    if (!candidate) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ message: "Operator not found" });
    }

    // Delete old resume file if exists
    if (candidate.resumeUrl) {
      const oldFileName = candidate.resumeUrl.replace("/uploads/resumes/", "");
      const oldDiskPath = path.join(__dirname, "..", "..", "uploads", "resumes", oldFileName);
      if (fs.existsSync(oldDiskPath)) {
        fs.unlinkSync(oldDiskPath);
      }
    }

    const filePath = req.file.path;
    const fileType = req.file.mimetype;

    // Parse resume contents automatically
    const { text: extractedText } = await extractTextWithFallback(filePath, fileType);
    const parsedResult = parseCandidateData(extractedText);

    candidate.resumeUrl = `/uploads/resumes/${req.file.filename}`;

    // Autofill profile details with parsed resume results
    const parsed = parsedResult.candidate;
    if (parsed.fullName && (!candidate.fullName || candidate.fullName.startsWith("--"))) {
      candidate.fullName = parsed.fullName;
    }
    if (parsed.phone && !candidate.phone) {
      candidate.phone = parsed.phone;
    }
    if (parsed.summary && !candidate.summary) {
      candidate.summary = parsed.summary;
    }
    if (parsed.roleApplied && !candidate.roleApplied) {
      candidate.roleApplied = parsed.roleApplied;
    }
    if (parsed.totalExperience && !candidate.totalExperience) {
      candidate.totalExperience = parsed.totalExperience;
    }
    if (parsed.currentLocation && !candidate.currentLocation) {
      candidate.currentLocation = parsed.currentLocation;
    }
    if (parsed.currentCompany && !candidate.currentCompany) {
      candidate.currentCompany = parsed.currentCompany;
    }
    if (parsed.skills && parsed.skills.length > 0) {
      // Merge unique skills
      candidate.skills = [...new Set([...candidate.skills, ...parsed.skills])];
    }

    await candidate.save();

    await Notification.create({
      candidateId: candidate._id,
      message: "Resume uploaded and profile details auto-filled successfully.",
      type: "Profile Updated",
    });

    return res.json({
      message: "Resume uploaded and parsed successfully",
      resumeUrl: candidate.resumeUrl,
      candidate,
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(400).json({ message: "Resume upload and parsing failed", error: error.message });
  }
}

// 6. Change Password
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new passwords are required" });
    }

    const candidate = await Candidate.findById(req.user.candidateId);
    if (!candidate) {
      return res.status(404).json({ message: "Operator not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, candidate.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect current password" });
    }

    candidate.password = await bcrypt.hash(newPassword, 10);
    await candidate.save();

    return res.json({ message: "Password updated successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Password change failed", error: error.message });
  }
}

// 7. Update Profile Photo
async function updateProfilePhoto(req, res) {
  try {
    const { profilePhoto } = req.body;
    if (!profilePhoto) {
      return res.status(400).json({ message: "Profile photo string is required" });
    }

    const candidate = await Candidate.findById(req.user.candidateId);
    if (!candidate) {
      return res.status(404).json({ message: "Operator not found" });
    }

    candidate.profilePhoto = profilePhoto;
    await candidate.save();

    return res.json({ message: "Profile photo updated successfully", profilePhoto });
  } catch (error) {
    return res.status(500).json({ message: "Profile photo update failed", error: error.message });
  }
}

// 8. Get Interviews
async function getInterviews(req, res) {
  try {
    const candidate = await Candidate.findById(req.user.candidateId).select("interviews");
    if (!candidate) {
      return res.status(404).json({ message: "Operator not found" });
    }
    return res.json(candidate.interviews);
  } catch (error) {
    return res.status(500).json({ message: "Fetch interviews failed", error: error.message });
  }
}

// 9. Get Notifications
async function getNotifications(req, res) {
  try {
    const notifications = await Notification.find({ candidateId: req.user.candidateId }).sort({
      createdAt: -1,
    });
    return res.json(notifications);
  } catch (error) {
    return res.status(500).json({ message: "Fetch notifications failed", error: error.message });
  }
}

// 10. Mark Notification Read
async function markNotificationRead(req, res) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, candidateId: req.user.candidateId },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    return res.json(notification);
  } catch (error) {
    return res.status(500).json({ message: "Mark notification read failed", error: error.message });
  }
}

// 11. Forgot Password
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const candidate = await Candidate.findOne({ email: email.toLowerCase() });
    if (!candidate) {
      return res.status(404).json({ message: "No account found with this email" });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString("hex");
    candidate.resetPasswordToken = resetToken;
    candidate.resetPasswordExpire = Date.now() + 3600000; // 1 hour expiration
    await candidate.save();

    return res.json({
      message: "Reset token generated successfully. (For development/testing, token is returned below).",
      resetToken,
    });
  } catch (error) {
    return res.status(500).json({ message: "Forgot password request failed", error: error.message });
  }
}

// 12. Reset Password
async function resetPassword(req, res) {
  try {
    const { password } = req.body;
    const { token } = req.params;

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    const candidate = await Candidate.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!candidate) {
      return res.status(400).json({ message: "Password reset token is invalid or has expired" });
    }

    candidate.password = await bcrypt.hash(password, 10);
    candidate.resetPasswordToken = undefined;
    candidate.resetPasswordExpire = undefined;
    await candidate.save();

    return res.json({ message: "Password has been reset successfully. You can now login." });
  } catch (error) {
    return res.status(500).json({ message: "Reset password failed", error: error.message });
  }
}

module.exports = {
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
};
