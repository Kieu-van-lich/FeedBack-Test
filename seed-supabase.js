const fs = require("fs");
const path = require("path");
const https = require("https");

const SUPABASE_URL = "https://frnepaasslsbbmxvvhsb.supabase.co";
const SUPABASE_KEY = "sb_publishable_V5IaeVV24R1GmZrh09TcsQ_cD95KDn2";

// Read data.js
const dataJsPath = path.join(__dirname, "data.js");
const content = fs.readFileSync(dataJsPath, "utf-8");
const jsonMatch = content.match(/const feedbackData =\s*(\[[\s\S]*?\]);/);

if (!jsonMatch || !jsonMatch[1]) {
  console.error("Could not parse feedbackData from data.js");
  process.exit(1);
}

const rawList = JSON.parse(jsonMatch[1]);
console.log(`Found ${rawList.length} items in data.js`);

const rows = rawList.map((item, idx) => ({
  title: `${item.category} — Feedback #${String(idx + 1).padStart(2, "0")}`,
  category: item.category,
  path: item.path,
  filename: item.filename || item.path.split("/").pop()
}));

// Insert into Supabase REST API
const url = new URL(`${SUPABASE_URL}/rest/v1/feedbacks`);
const payload = JSON.stringify(rows);

const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: "POST",
  headers: {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
  }
};

const req = https.request(options, (res) => {
  let responseData = "";
  res.on("data", (chunk) => responseData += chunk);
  res.on("end", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log(`⚡ Successfully seeded ${rows.length} feedback items into Supabase!`);
    } else {
      console.error(`Status: ${res.statusCode}`, responseData);
    }
  });
});

req.on("error", (err) => {
  console.error("Error seeding Supabase:", err);
});

req.write(payload);
req.end();
