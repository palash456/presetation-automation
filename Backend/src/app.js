const express = require("express");
const fs = require("fs");
const path = require("path");
const upload = require("./upload");
const { parsePPT } = require("./pptParser");
const logger = require("./logger");

const app = express();

const logsDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.post("/upload", upload.single("file"), async (req, res) => {
  console.log("File received", req);
  if (!req.file) {
    logger.warn("Upload attempted without a file");
    return res.status(400).json({ error: "No file uploaded. Use field name 'file'." });
  }

  const filePath = req.file.path;
  console.log("File received", {
    originalName: req.file.originalname,
    size: req.file.size,
    path: filePath,
  });

  try {
    const metadata = await parsePPT(filePath);
    res.json({ success: true, metadata });
  } catch (err) {
    logger.error("Failed to parse PPT", { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Failed to parse PPT file.", details: err.message });
  } finally {
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) logger.error("Failed to clean up uploaded file", { path: filePath });
      else logger.info("Cleaned up uploaded file", { path: filePath });
    });
  }
});

app.use((err, _req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    logger.warn("File too large", { error: err.message });
    return res.status(413).json({ error: "File too large. Maximum size is 50 MB." });
  }
  if (err.message && err.message.includes("Invalid file type")) {
    logger.warn("Invalid file type", { error: err.message });
    return res.status(400).json({ error: err.message });
  }
  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal server error." });
});

module.exports = app;
