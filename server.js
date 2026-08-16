const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Mismoga";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "student-documents";
let adminToken = null;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

async function init() {
  if (!process.env.DATABASE_URL) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id BIGSERIAL PRIMARY KEY,
      block_name TEXT NOT NULL DEFAULT '',
      school_name TEXT NOT NULL,
      udise_code TEXT NOT NULL,
      pen_number TEXT NOT NULL,
      student_name TEXT NOT NULL,
      father_name TEXT NOT NULL,
      old_class TEXT NOT NULL,
      new_class TEXT NOT NULL,
      email_id TEXT NOT NULL,
      bmis_remarks TEXT NOT NULL DEFAULT '',
      document_path TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Safe upgrades for an existing database.
  await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS block_name TEXT NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS document_path TEXT NOT NULL DEFAULT ''`);
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
      ? await pool.query(`SELECT * FROM students
        WHERE block_name ILIKE $1 OR school_name ILIKE $1 OR udise_code ILIKE $1
        OR pen_number ILIKE $1 OR student_name ILIKE $1 OR father_name ILIKE $1 OR email_id ILIKE $1
        ORDER BY id DESC`, [like])
      : await pool.query("SELECT * FROM students ORDER BY id DESC");
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: "Database error" }); }
});

app.post("/api/records", async (req, res) => {
  try {
    const p = req.body;
    if (!p.document_data) return res.status(400).json({error:"A PDF document is required."});
    if (!supabase) return res.status(500).json({error:"Supabase Storage is not configured."});
    const allowed = ["application/pdf"];
    if (!allowed.includes(p.document_type)) return res.status(400).json({error:"Only PDF files are allowed."});
    const raw = Buffer.from(p.document_data, "base64");
    if (raw.length > 10 * 1024 * 1024) return res.status(400).json({error:"PDF must be 10 MB or smaller."});
    const safeName = (p.document_name || "document.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${p.udise_code}/${p.pen_number}/${Date.now()}-${safeName}`;
    const up = await supabase.storage.from(BUCKET).upload(filePath, raw, {contentType:"application/pdf", upsert:false});
    if (up.error) return res.status(500).json({error:"Document upload failed: "+up.error.message});
    const r = await pool.query(
      `INSERT INTO students
       (block_name,school_name,udise_code,pen_number,student_name,father_name,old_class,new_class,email_id,document_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [p.block_name,p.school_name,p.udise_code,p.pen_number,p.student_name,p.father_name,p.old_class,p.new_class,p.email_id,filePath]);
    res.json({ok:true,id:r.rows[0].id});
  } catch(e) { res.status(500).json({error:"Could not save record"}); }
});

// Securely create a one-time signed URL for the associated PDF.
app.get("/api/records/:id/document", adminOnly, async (req,res) => {
  try {
    if (!supabase) return res.status(500).json({error:"Storage not configured"});
    const r = await pool.query("SELECT document_path FROM students WHERE id=$1",[req.params.id]);
    if (!r.rowCount || !r.rows[0].document_path) return res.status(404).json({error:"No document attached"});
    const {data,error} = await supabase.storage.from(BUCKET).createSignedUrl(r.rows[0].document_path, 300, {download:true});
    if (error) return res.status(500).json({error:error.message});
    res.json({url:data.signedUrl});
  } catch(e) { res.status(500).json({error:"Could not prepare document download"}); }
});

// The update endpoint requires that the associated document exists.
app.put("/api/records/:id", adminOnly, async (req,res) => {
  try {
    const r = await pool.query("SELECT document_path FROM students WHERE id=$1",[req.params.id]);
    if (!r.rowCount || !r.rows[0].document_path)
      return res.status(400).json({error:"No document is attached. Record was not updated."});
    const p = req.body;
    await pool.query(
      `UPDATE students SET block_name=$1,school_name=$2,udise_code=$3,pen_number=$4,
       student_name=$5,father_name=$6,old_class=$7,new_class=$8,email_id=$9,
       bmis_remarks=$10,updated_at=NOW() WHERE id=$11`,
      [p.block_name,p.school_name,p.udise_code,p.pen_number,p.student_name,p.father_name,
       p.old_class,p.new_class,p.email_id,p.bmis_remarks||"",req.params.id]);
    res.json({ok:true});
  } catch(e) { res.status(500).json({error:"Could not update record"}); }
});

app.use((req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
init().then(()=>app.listen(PORT,()=>console.log(`MIS Wing Moga running on ${PORT}`)))
  .catch(e=>{console.error(e);process.exit(1)});
