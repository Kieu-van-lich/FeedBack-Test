#!/usr/bin/env node
/**
 * ============================================================================
 * Dọn dẹp file ảnh mồ côi trên Supabase Storage bucket 'feedback-images'
 * - Mặc định chạy chế độ --dry-run (chỉ đọc & liệt kê, KHÔNG xóa file).
 * - Truyền thêm cờ --execute để thực hiện xóa thật (yêu cầu đã chạy
 *   supabase/phase1_sync.sql để bật policy DELETE trên storage.objects,
 *   hoặc dùng SUPABASE_SERVICE_ROLE_KEY qua biến môi trường).
 * ============================================================================
 */

const https = require("https");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://frnepaasslsbbmxvvhsb.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  "sb_publishable_V5IaeVV24R1GmZrh09TcsQ_cD95KDn2";
const BUCKET = "feedback-images";

const isExecute = process.argv.includes("--execute");

function requestJson(method, pathname, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}${pathname}`);
    const payload = body !== null ? JSON.stringify(body) : null;
    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
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

function extractStorageNameFromUrl(rawPath) {
  if (!rawPath || typeof rawPath !== "string") return null;
  const markers = [
    `/storage/v1/object/public/${BUCKET}/`,
    `/storage/v1/object/sign/${BUCKET}/`
  ];
  for (const marker of markers) {
    if (rawPath.includes(marker)) {
      const part = rawPath.split(marker)[1].split("?")[0].split("#")[0];
      try {
        return decodeURIComponent(part);
      } catch (e) {
        return part;
      }
    }
  }
  return null;
}

async function fetchAllReferencedStorageNames() {
  const referenced = new Set();
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const res = await requestJson("GET", "/rest/v1/feedbacks?select=path", null, {
      Range: `${offset}-${offset + pageSize - 1}`
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Không đọc được bảng feedbacks (${res.status}): ${res.body}`);
    }
    const rows = JSON.parse(res.body);
    for (const row of rows) {
      const name = extractStorageNameFromUrl(row.path);
      if (name) referenced.add(name);
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return referenced;
}

async function listObjectsInPrefix(prefix) {
  const results = [];
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
      throw new Error(`Không liệt kê được Storage prefix "${prefix}" (${res.status}): ${res.body}`);
    }

    const items = JSON.parse(res.body);
    if (!Array.isArray(items) || items.length === 0) break;

    for (const item of items) {
      if (!item || !item.name) continue;
      // Folders returned by storage list API have id === null
      if (item.id === null) continue;
      const fullName = prefix ? `${prefix}/${item.name}` : item.name;
      results.push({
        name: fullName,
        size: Number(item.metadata?.size || 0),
        created_at: item.created_at || null
      });
    }

    if (items.length < limit) break;
    offset += limit;
  }

  return results;
}

async function listAllBucketObjects() {
  const rootItems = await listObjectsInPrefix("");
  const uploadItems = await listObjectsInPrefix("uploads");

  const map = new Map();
  for (const obj of [...rootItems, ...uploadItems]) {
    map.set(obj.name, obj);
  }
  return Array.from(map.values());
}

async function deleteStorageObjects(names) {
  const batchSize = 50;
  let deletedTotal = 0;

  for (let i = 0; i < names.length; i += batchSize) {
    const batch = names.slice(i, i + batchSize);
    const res = await requestJson("DELETE", `/storage/v1/object/${BUCKET}`, {
      prefixes: batch
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Xóa Storage thất bại (${res.status}): ${res.body}`);
    }

    let parsed = [];
    try {
      parsed = JSON.parse(res.body);
    } catch (e) {
      parsed = [];
    }
    const deletedCount = Array.isArray(parsed) ? parsed.length : 0;
    deletedTotal += deletedCount;

    if (deletedCount === 0 && batch.length > 0) {
      throw new Error(
        "Storage API trả về 0 file đã xóa (có thể bucket thiếu policy DELETE trên storage.objects — hãy chạy supabase/phase1_sync.sql hoặc truyền SUPABASE_SERVICE_ROLE_KEY)."
      );
    }
  }

  return deletedTotal;
}

(async () => {
  try {
    console.log(`🔍 Đang kiểm tra bucket '${BUCKET}' (${isExecute ? "CHẾ ĐỘ XÓA THẬT" : "CHẾ ĐỘ DRY-RUN"})...`);

    const [referencedNames, allObjects] = await Promise.all([
      fetchAllReferencedStorageNames(),
      listAllBucketObjects()
    ]);

    const orphans = allObjects.filter((obj) => !referencedNames.has(obj.name));
    const totalBytes = orphans.reduce((sum, obj) => sum + obj.size, 0);
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

    console.log(`- Tổng file trong bucket '${BUCKET}': ${allObjects.length}`);
    console.log(`- Số đường dẫn Storage đang được bảng feedbacks tham chiếu: ${referencedNames.size}`);
    console.log(`- Số file mồ côi phát hiện: ${orphans.length} (~${totalMB} MB / ${totalBytes} bytes)`);

    if (orphans.length === 0) {
      console.log("✅ Bucket sạch sẽ, không có file mồ côi nào.");
      return;
    }

    console.log("\nDanh sách mẫu (tối đa 15 file đầu):");
    orphans.slice(0, 15).forEach((obj, idx) => {
      console.log(`  ${idx + 1}. ${obj.name} (${obj.size} bytes, ${obj.created_at || "n/a"})`);
    });
    if (orphans.length > 15) {
      console.log(`  ... và ${orphans.length - 15} file khác.`);
    }

    if (!isExecute) {
      console.log("\nℹ️ Đang chạy ở chế độ --dry-run (không xóa file). Chạy lại với '--execute' sau khi đã backup và bật policy DELETE để xóa.");
      return;
    }

    const deletedCount = await deleteStorageObjects(orphans.map((o) => o.name));
    console.log(`\n⚡ Đã xóa thành công ${deletedCount} file mồ côi khỏi bucket '${BUCKET}'!`);
  } catch (err) {
    console.error("❌ Lỗi:", err.message);
    process.exit(1);
  }
})();

