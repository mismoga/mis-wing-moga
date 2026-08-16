const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Mismoga";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});
let adminToken = null;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function init() {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set.");
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id BIGSERIAL PRIMARY KEY,
      school_name TEXT NOT NULL,
      udise_code TEXT NOT NULL,
      pen_number TEXT NOT NULL,
      student_name TEXT NOT NULL,
      father_name TEXT NOT NULL,
      old_class TEXT NOT NULL,
      new_class TEXT NOT NULL,
      email_id TEXT NOT NULL,
      bmis_remarks TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function adminOnly(req, res, next) {
  if (!adminToken || req.headers["x-admin-token"] !== adminToken)
    return res.status(401).json({ error: "Unauthorized" });
  next();
}

app.post("/api/admin/unlock", (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD)
    return res.status(401).json({ error: "Incorrect password" });
  adminToken = crypto.randomBytes(32).toString("hex");
  res.json({ token: adminToken });
});

app.get("/api/records", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const like = `%${q}%`;
    const result = q
      ? await pool.query(
          `SELECT * FROM students
           WHERE school_name ILIKE $1 OR udise_code ILIKE $1 OR pen_number ILIKE $1
              OR student_name ILIKE $1 OR father_name ILIKE $1 OR email_id ILIKE $1
           ORDER BY id DESC`, [like])
      : await pool.query("SELECT * FROM students ORDER BY id DESC");
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/records", async (req, res) => {
  try {
    const p = req.body;
    const values = [p.school_name,p.udise_code,p.pen_number,p.student_name,
      p.father_name,p.old_class,p.new_class,p.email_id];
    await pool.query(
      `INSERT INTO students
       (school_name,udise_code,pen_number,student_name,father_name,old_class,new_class,email_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, values);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Could not save record" });
  }
});

app.put("/api/records/:id", adminOnly, async (req, res) => {
  try {
    const p = req.body;
    await pool.query(
      `UPDATE students SET school_name=$1,udise_code=$2,pen_number=$3,
       student_name=$4,father_name=$5,old_class=$6,new_class=$7,email_id=$8,
       bmis_remarks=$9,updated_at=NOW() WHERE id=$10`,
      [p.school_name,p.udise_code,p.pen_number,p.student_name,p.father_name,
       p.old_class,p.new_class,p.email_id,p.bmis_remarks || "",req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Could not update record" });
  }
});

// Express 5-safe SPA fallback
app.use((req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

init().then(() => app.listen(PORT, () =>
  console.log(`MIS Wing Moga running on port ${PORT}`)
)).catch(err => {
  console.error(err);
  process.exit(1);
});
