const fs = require("fs");
const path = require("path");
const https = require("https");
const vm = require("vm");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://frnepaasslsbbmxvvhsb.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  "sb_publishable_V5IaeVV24R1GmZrh09TcsQ_cD95KDn2";
const SUPABASE_AUTH_TOKEN =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ACCESS_TOKEN ||
  SUPABASE_KEY;

const CATEGORY_DISPLAY_MAP = {
  "ak riu thieng": "AK Rìu Thiêng",
  "dao buom": "Dao Bướm",
  "du saitama": "Dù Saitama",
  "m4a1 battle of faith": "M4A1 Battle of Faith",
  "m700 elizabeth": "M700 ELIZABETH"
};

function normalizeCategoryName(raw) {
  if (!raw) return "Giao dịch chung";
  const key = String(raw)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
  return CATEGORY_DISPLAY_MAP[key] || String(raw).trim();
}

const dataJsPath = path.join(__dirname, "data.js");
const content = fs.readFileSync(dataJsPath, "utf-8");

const sandbox = {};
vm.runInNewContext(content.replace(/\bconst\b/g, "var"), sandbox);

if (!Array.isArray(sandbox.feedbackData)) {
  console.error("Could not parse feedbackData from data.js");
  process.exit(1);
}

const rawList = sandbox.feedbackData;
console.log(`Found ${rawList.length} feedback items in data.js`);

function requestJson(method, pathname, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}${pathname}`);
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_AUTH_TOKEN}`,
      ...extraHeaders
    };
    if (payload) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(payload);
    }

    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          resolve({ status: res.statusCode, body: data });
        });
      }
    );

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  try {
    const existingRes = await requestJson("GET", "/rest/v1/feedbacks?select=path");
    if (existingRes.status < 200 || existingRes.status >= 300) {
      throw new Error(`Failed reading existing feedbacks (${existingRes.status}): ${existingRes.body}`);
    }

    const existingPaths = new Set(JSON.parse(existingRes.body).map((r) => r.path));
    const seen = new Set();

    const rowsToInsert = [];
    rawList.forEach((item, idx) => {
      if (!item.path || existingPaths.has(item.path) || seen.has(item.path)) return;
      seen.add(item.path);
      const displayCategory = normalizeCategoryName(item.category);
      rowsToInsert.push({
        title: `${displayCategory} — Feedback #${String(idx + 1).padStart(2, "0")}`,
        category: displayCategory,
        path: item.path,
        filename: item.filename || item.path.split("/").pop()
      });
    });

    if (rowsToInsert.length === 0) {
      console.log("⚡ All items from data.js already exist in Supabase. Nothing to insert.");
      return;
    }

    const chunkSize = 50;
    let totalInserted = 0;

    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize);
      const res = await requestJson(
        "POST",
        "/rest/v1/feedbacks?on_conflict=path",
        chunk,
        { Prefer: "resolution=ignore-duplicates,return=minimal" }
      );

      if (res.status < 200 || res.status >= 300) {
        if (res.status === 401 || res.status === 403 || res.body.includes("42501")) {
          throw new Error(
            `RLS blocked anonymous seed (${res.status}). Pass SUPABASE_ACCESS_TOKEN (Admin JWT) or SUPABASE_SERVICE_ROLE_KEY, or use the Seed button in admin.html after logging in.`
          );
        }
        // Fallback when UNIQUE(path) constraint is not created yet
        if (res.body.includes("no unique or exclusion constraint")) {
          const fallbackRes = await requestJson("POST", "/rest/v1/feedbacks", chunk, {
            Prefer: "return=minimal"
          });
          if (fallbackRes.status < 200 || fallbackRes.status >= 300) {
            throw new Error(`Insert failed (${fallbackRes.status}): ${fallbackRes.body}`);
          }
        } else {
          throw new Error(`Upsert failed (${res.status}): ${res.body}`);
        }
      }

      totalInserted += chunk.length;
    }

    console.log(
      `⚡ Seeded ${totalInserted} new feedback items into Supabase (skipped ${rawList.length - totalInserted} duplicates).`
    );
  } catch (err) {
    console.error("Error seeding Supabase:", err.message);
    process.exit(1);
  }
})();
