const path = require("path");
const fs = require("fs");
const https = require("https");
const crypto = require("crypto");

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { Pool } = require("pg");

require("dotenv").config();

const PORT = Number(process.env.PORT || 5500);
const DATABASE_URL = process.env.DATABASE_URL;
const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || "local").toLowerCase();
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL in environment.");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const rootDir = __dirname;
const uploadsDir = path.join(rootDir, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// S3 uploads use plain HTTPS with AWS Signature V4 (no SDK required)

function createDefaultState() {
  const defaultUserId = crypto.randomUUID();
  const defaultTaskId = crypto.randomUUID();

  return {
    funds: [
      {
        id: crypto.randomUUID(),
        name: "Zakladni fond",
        status: "ONBOARDING",
        workflowRuns: []
      }
    ],
    users: [
      {
        id: defaultUserId,
        username: "jiri.grummich",
        password: "PrvniPrihlaseni1",
        isActive: true
      }
    ],
    workflows: [
      {
        id: crypto.randomUUID(),
        name: "Uvodni workflow",
        items: [
          {
            id: defaultTaskId,
            type: "TASK",
            name: "Task",
            followUpTaskIds: [],
            taskGroupId: "",
            assigneeUserId: defaultUserId,
            status: "Otevreny",
            completedDate: "",
            note: "",
            files: "",
            deadlineOffsetDays: 5
          }
        ]
      }
    ]
  };
}

async function ensureSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        id SMALLINT PRIMARY KEY CHECK (id = 1),
        state_json JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        version BIGINT NOT NULL DEFAULT 1
      );
    `);

    await client.query(`
      ALTER TABLE app_state
      ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;
    `);

    await client.query("UPDATE app_state SET version = 1 WHERE version IS NULL");

    await client.query(`
      CREATE TABLE IF NOT EXISTS uploaded_files (
        id UUID PRIMARY KEY,
        original_name TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        public_url TEXT NOT NULL,
        content_type TEXT,
        size_bytes BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const existing = await client.query("SELECT id FROM app_state WHERE id = 1");
    if (existing.rowCount === 0) {
      await client.query("INSERT INTO app_state (id, state_json, version) VALUES (1, $1::jsonb, 1)", [JSON.stringify(createDefaultState())]);
    }
  } finally {
    client.release();
  }
}

function assertS3Env() {
  if (!process.env.S3_BUCKET || !process.env.S3_REGION || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
    throw new Error("S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required for STORAGE_PROVIDER=s3");
  }
}

function hmacSha256(key, data, encoding) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest(encoding || "buffer");
}

function buildS3AuthHeaders(method, bucket, key, region, contentType, body) {
  const accessKey = process.env.S3_ACCESS_KEY_ID;
  const secretKey = process.env.S3_SECRET_ACCESS_KEY;
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const datetime = now.toISOString().replace(/[:\-]/g, "").slice(0, 15) + "Z";
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const payloadHash = crypto.createHash("sha256").update(body).digest("hex");
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${datetime}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [method, `/${key}`, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${date}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", datetime, scope, crypto.createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const signingKey = hmacSha256(hmacSha256(hmacSha256(hmacSha256(`AWS4${secretKey}`, date), region), "s3"), "aws4_request");
  const signature = hmacSha256(signingKey, stringToSign, "hex");
  return {
    "Content-Type": contentType,
    "x-amz-date": datetime,
    "x-amz-content-sha256": payloadHash,
    "Authorization": `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  };
}

async function s3Request(method, bucket, key, region, contentType, body) {
  const headers = buildS3AuthHeaders(method, bucket, key, region, contentType, body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: `${bucket}.s3.${region}.amazonaws.com`, path: `/${key}`, method, headers: { ...headers, "Content-Length": body.length } },
      (res) => {
        let raw = "";
        res.on("data", (c) => { raw += c; });
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300 || (method === "DELETE" && res.statusCode === 404)) {
            resolve();
          } else {
            reject(new Error(`S3 ${method} ${res.statusCode}: ${raw}`));
          }
        });
      }
    );
    req.on("error", reject);
    if (body.length) req.write(body);
    req.end();
  });
}

async function saveFile(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const key = `${Date.now()}-${crypto.randomUUID()}${ext}`;

  if (STORAGE_PROVIDER === "s3") {
    assertS3Env();
    const bucket = process.env.S3_BUCKET;
    const region = process.env.S3_REGION;
    const contentType = file.mimetype || "application/octet-stream";
    await s3Request("PUT", bucket, key, region, contentType, file.buffer);
    const publicBase = process.env.S3_PUBLIC_BASE_URL;
    const url = publicBase
      ? `${publicBase.replace(/\/$/, "")}/${key}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    return { key, url };
  }

  const targetPath = path.join(uploadsDir, key);
  fs.writeFileSync(targetPath, file.buffer);
  return { key, url: `${PUBLIC_BASE_URL}/uploads/${key}` };
}

async function removeFile(storageKey) {
  if (!storageKey) return;

  if (STORAGE_PROVIDER === "s3") {
    assertS3Env();
    await s3Request("DELETE", process.env.S3_BUCKET, storageKey, process.env.S3_REGION, "application/octet-stream", Buffer.alloc(0));
    return;
  }

  const targetPath = path.join(uploadsDir, storageKey);
  if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
}

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/state", async (req, res) => {
  try {
    const result = await pool.query("SELECT state_json, updated_at, version FROM app_state WHERE id = 1");
    if (result.rowCount === 0) {
      const defaults = createDefaultState();
      return res.json({ state: defaults, updatedAt: new Date().toISOString(), version: 0 });
    }

    res.json({ state: result.rows[0].state_json, updatedAt: result.rows[0].updated_at, version: Number(result.rows[0].version) || 1 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load state" });
  }
});

app.put("/api/state", async (req, res) => {
  const payload = req.body;
  const state = payload && typeof payload === "object" && payload.state && typeof payload.state === "object"
    ? payload.state
    : payload;
  const expectedVersionValue = payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "expectedVersion")
    ? Number(payload.expectedVersion)
    : null;
  const expectedVersion = Number.isInteger(expectedVersionValue) && expectedVersionValue >= 0 ? expectedVersionValue : null;

  if (!state || typeof state !== "object") {
    return res.status(400).json({ message: "Invalid state payload" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query("SELECT version FROM app_state WHERE id = 1 FOR UPDATE");
    if (existing.rowCount === 0) {
      if (expectedVersion !== null && expectedVersion !== 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "State was changed by another session", currentVersion: 0 });
      }

      const inserted = await client.query(
        `
          INSERT INTO app_state (id, state_json, updated_at, version)
          VALUES (1, $1::jsonb, NOW(), 1)
          RETURNING updated_at, version
        `,
        [JSON.stringify(state)]
      );

      await client.query("COMMIT");
      return res.json({ ok: true, updatedAt: inserted.rows[0].updated_at, version: Number(inserted.rows[0].version) || 1 });
    }

    const currentVersion = Number(existing.rows[0].version) || 1;
    if (expectedVersion !== null && expectedVersion !== currentVersion) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "State was changed by another session", currentVersion });
    }

    const updated = await client.query(
      `
        UPDATE app_state
        SET state_json = $1::jsonb,
            updated_at = NOW(),
            version = version + 1
        WHERE id = 1
        RETURNING updated_at, version
      `,
      [JSON.stringify(state)]
    );

    await client.query("COMMIT");
    res.json({ ok: true, updatedAt: updated.rows[0].updated_at, version: Number(updated.rows[0].version) || currentVersion + 1 });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Failed to rollback state transaction", rollbackError);
    }
    console.error(error);
    res.status(500).json({ message: "Failed to persist state" });
  } finally {
    client.release();
  }
});

app.post("/api/uploads", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "File is required" });
  }

  try {
    const stored = await saveFile(req.file);
    const id = crypto.randomUUID();

    await pool.query(
      `
        INSERT INTO uploaded_files (id, original_name, storage_key, public_url, content_type, size_bytes)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [id, req.file.originalname, stored.key, stored.url, req.file.mimetype || "", req.file.size]
    );

    res.status(201).json({
      id,
      name: req.file.originalname,
      storageKey: stored.key,
      url: stored.url,
      sizeBytes: req.file.size,
      uploadedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Upload failed" });
  }
});

app.delete("/api/uploads/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, storage_key FROM uploaded_files WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Upload not found" });
    }

    const row = result.rows[0];
    await removeFile(row.storage_key);
    await pool.query("DELETE FROM uploaded_files WHERE id = $1", [row.id]);

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Delete failed" });
  }
});

app.use(express.static(rootDir));

app.get("*", (req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

async function start() {
  try {
    await ensureSchema();
    app.listen(PORT, () => {
      console.log(`Fund Admin backend running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

start();
