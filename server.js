const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(__dirname));

// Multer Storage setup for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = req.body.category || "giao-dich-chung";
    const dirPath = path.join(__dirname, "pictures", category);
    
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    cb(null, dirPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    cb(null, `${basename}_${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

// API Route: Get Feedbacks
app.get("/api/feedbacks", (req, res) => {
  const dataJsPath = path.join(__dirname, "data.js");
  if (!fs.existsSync(dataJsPath)) {
    return res.json([]);
  }

  const content = fs.readFileSync(dataJsPath, "utf-8");
  const jsonMatch = content.match(/const feedbackData =\s*(\[[\s\S]*?\]);/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      return res.json(data);
    } catch (e) {
      return res.status(500).json({ error: "Failed to parse data.js" });
    }
  }
  res.json([]);
});

// API Route: Save / Add New Feedback with image upload
app.post("/api/feedbacks/upload", upload.single("image"), (req, res) => {
  try {
    const category = req.body.category || "Giao dịch chung";
    let relativePath = "";

    if (req.file) {
      relativePath = path.relative(__dirname, req.file.path).replace(/\\/g, "/");
    } else if (req.body.imagePath) {
      relativePath = req.body.imagePath;
    }

    if (!relativePath) {
      return res.status(400).json({ error: "Missing image" });
    }

    const newItem = {
      path: relativePath,
      category: category,
      filename: req.file ? req.file.filename : relativePath.split("/").pop()
    };

    // Read existing data.js
    const dataJsPath = path.join(__dirname, "data.js");
    let currentList = [];
    if (fs.existsSync(dataJsPath)) {
      const content = fs.readFileSync(dataJsPath, "utf-8");
      const jsonMatch = content.match(/const feedbackData =\s*(\[[\s\S]*?\]);/);
      if (jsonMatch && jsonMatch[1]) {
        currentList = JSON.parse(jsonMatch[1]);
      }
    }

    currentList.unshift(newItem);

    // Save back to data.js
    const newContent = `const feedbackData = ${JSON.stringify(currentList, null, 2)};\n`;
    fs.writeFileSync(dataJsPath, newContent, "utf-8");

    res.json({ success: true, item: newItem });
  } catch (err) {
    console.error("Error saving feedback:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`⚡ Kho Feedback Server running at http://localhost:${PORT}`);
  console.log(`  - Admin Dashboard: http://localhost:${PORT}/admin.html`);
  console.log(`  - Main Website: http://localhost:${PORT}/index.html`);
});
