require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const authRoutes = require("./routes/authRoutes");
const candidateRoutes = require("./routes/candidateRoutes");
const interviewRoutes = require("./routes/interviewRoutes");
const documentRoutes = require("./routes/documentRoutes");
const dataEntryOperatorRoutes = require("./routes/dataEntryOperatorRoutes");
const { ensureDefaultAdmin, ensureDefaultManager, ensureDefaultOperator } = require("./controllers/authController");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "API is running" });
});

app.get("/api/public/candidates/:id/resume", async (req, res) => {
  try {
    const Candidate = require("./models/Candidate");
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate || !candidate.resumeUrl) {
      return res.status(404).json({ message: "Resume not found" });
    }
    const path = require("path");
    const fs = require("fs");
    const filePath = path.join(__dirname, "..", candidate.resumeUrl);
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    return res.status(404).json({ message: "File not found" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch resume", error: error.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/data-entry-operator", dataEntryOperatorRoutes);

// Serve static assets from frontend build folder
const frontendDistPath = path.join(__dirname, "..", "..", "resumio_frontend", "dist");
app.use(express.static(frontendDistPath));

// Fallback all non-API and non-upload routes to frontend index.html
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
    return next();
  }
  const fs = require("fs");
  const indexPath = path.join(frontendDistPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Frontend build not found. Please build frontend first.");
  }
});

app.use((err, req, res, next) => {
  if (!err) return next();

  return res.status(400).json({
    message: err.message || "Request failed",
  });
});

const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI;
const { initScheduler } = require("./utils/scheduler");

async function startServer() {
  try {
    await mongoose.connect(MONGO_URI);
    await ensureDefaultAdmin();
    await ensureDefaultManager();
    await ensureDefaultOperator();
    initScheduler();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
