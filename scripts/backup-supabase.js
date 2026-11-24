#!/usr/bin/env node
/**
 * ============================================================================
 * Sao lưu định kỳ dữ liệu Kho Feedback từ Supabase (chỉ đọc)
 * - Lưu snapshot JSON gồm categories, feedbacks và storage_objects (feedback-images)
 *   vào backups/supabase_backup_YYYYMMDD.json (hoặc đường dẫn chỉ định qua --out=).
 * - Tùy chọn: --prune --keep=4 để giữ lại N bản backup gần nhất trong backups/.
 * ============================================================================
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const PROJECT_REF = "frnepaasslsbbmxvvhsb";
const SUPABASE_URL = process.env.SUPABASE_URL || `https://${PROJECT_REF}.supabase.co`;
const SUPABASE_API_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  "sb_publishable_V5IaeVV24R1GmZrh09TcsQ_cD95KDn2";
const SUPABASE_BEARER =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ACCESS_TOKEN ||
  SUPABASE_API_KEY;
const BUCKET = "feedback-images";

function parseArgs(argv) {
  let outPath = null;
  let prune = false;
  let keep = 4;

  for (const arg of argv) {
    if (arg.startsWith("--out=")) {
      outPath = arg.slice("--out=".length).trim();
    } else if (arg === "--prune") {
      prune = true;
    } else if (arg.startsWith("--keep=")) {
      const n = Number.parseInt(arg.slice("--keep=".length), 10);
      if (Number.isFinite(n) && n > 0) keep = n;
    }
  }

  return { outPath, prune, keep };
}

function getLocalDateStamp(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function requestJson(method, pathname, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}${pathname}`);
    const payload = body !== null ? JSON.stringify(body) : null;
    const headers = {
      apikey: SUPABASE_API_KEY,
      Authorization: `Bearer ${SUPABASE_BEARER}`,
      ...extraHeaders
    };
    if (payload !== null) {
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
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({ status: res.statusCode, body: data });
        });
      }
    );

    req.on("error", reject);
    if (payload !== null) req.write(payload);
    req.end();
  });
}

async function fetchAllRows(pathname) {
  const rows = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const res = await requestJson("GET", pathname, null, {
      Range: `${offset}-${offset + pageSize - 1}`
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`GET ${pathname} failed (${res.status}): ${res.body}`);
    }
    const batch = JSON.parse(res.body);
    if (!Array.isArray(batch)) {
      throw new Error(`Unexpected response for ${pathname}`);
    }
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function listStorageObjectsRecursive(prefix = "") {
  const collected = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const res = await requestJson("POST", `/storage/v1/object/list/${BUCKET}`, {
      prefix,
      limit,
      offset,
      sortBy: { column: "created_at", order: "desc" }
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`POST storage list "${prefix}" failed (${res.status}): ${res.body}`);
    }

    const entries = JSON.parse(res.body);
    if (!Array.isArray(entries) || entries.length === 0) break;

    for (const entry of entries) {
      if (!entry || !entry.name) continue;
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        const nested = await listStorageObjectsRecursive(fullPath);
        collected.push(...nested);
      } else {
        collected.push({
          id: entry.id,
          name: fullPath,
          created_at: entry.created_at || null,
          updated_at: entry.updated_at || null,
          size: entry.metadata && typeof entry.metadata.size === "number" ? entry.metadata.size : null,
          mimetype: entry.metadata && entry.metadata.mimetype ? entry.metadata.mimetype : null
        });
      }
    }

    if (entries.length < limit) break;
    offset += limit;
  }

  return collected;
}

function pruneOldBackups(backupsDir, keep) {
  const files = fs
    .readdirSync(backupsDir)
    .filter((f) => /^supabase_backup_\d{8}\.json$/.test(f))
    .sort()
    .reverse();

  const removed = [];
  for (const oldFile of files.slice(keep)) {
    fs.unlinkSync(path.join(backupsDir, oldFile));
    removed.push(oldFile);
  }
  return removed;
}

(async () => {
  try {
    const { outPath, prune, keep } = parseArgs(process.argv.slice(2));
    const backupsDir = path.resolve(__dirname, "..", "backups");
    const targetPath = outPath
      ? path.resolve(outPath)
      : path.join(backupsDir, `supabase_backup_${getLocalDateStamp()}.json`);

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    const [categories, feedbacks, storageObjects] = await Promise.all([
      fetchAllRows("/rest/v1/categories?select=*&order=sort_order.asc,created_at.asc"),
      fetchAllRows("/rest/v1/feedbacks?select=*&order=created_at.desc"),
      listStorageObjectsRecursive("")
    ]);

    const seenStorage = new Set();
    const uniqueStorageObjects = [];
    for (const obj of storageObjects) {
      if (!seenStorage.has(obj.name)) {
        seenStorage.add(obj.name);
        uniqueStorageObjects.push(obj);
      }
    }

    const snapshot = {
      exported_at: new Date().toISOString(),
      project_ref: PROJECT_REF,
      counts: {
        categories: categories.length,
        feedbacks: feedbacks.length,
        storage_objects: uniqueStorageObjects.length
      },
      categories,
      feedbacks,
      storage_objects: uniqueStorageObjects
    };

    fs.writeFileSync(targetPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
    const bytes = fs.statSync(targetPath).size;

    console.log(
      `⚡ Backup saved: ${targetPath} (${bytes} bytes) | categories=${categories.length}, feedbacks=${feedbacks.length}, storage_objects=${uniqueStorageObjects.length}`
    );

    if (prune && fs.existsSync(backupsDir)) {
      const removed = pruneOldBackups(backupsDir, keep);
      console.log(`Pruned ${removed.length} old backup(s) (keep=${keep}).`);
    }
  } catch (err) {
    console.error("Backup failed:", err.message);
    process.exit(1);
  }
})();

