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
      new_class TEXT NOT NULL,
      new_section TEXT NOT NULL DEFAULT '',
      new_gender TEXT NOT NULL DEFAULT '',
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
  await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS new_section TEXT NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS new_gender TEXT NOT NULL DEFAULT ''`);
  // Remove fields no longer used by the MIS Wing workflow.
  await pool.query(`ALTER TABLE students DROP COLUMN IF EXISTS father_name`);
  await pool.query(`ALTER TABLE students DROP COLUMN IF EXISTS old_class`);
  await pool.query(`ALTER TABLE students DROP COLUMN IF EXISTS old_gender`);
  // Database-level duplicate PEN protection.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS students_pen_number_unique
    ON students (pen_number)
    WHERE pen_number IS NOT NULL AND BTRIM(pen_number) <> ''
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
      ? await pool.query(`SELECT * FROM students
        WHERE block_name ILIKE $1 OR school_name ILIKE $1 OR udise_code ILIKE $1
        OR pen_number ILIKE $1 OR student_name ILIKE $1 OR email_id ILIKE $1
        ORDER BY id DESC`, [like])
      : await pool.query("SELECT * FROM students ORDER BY id DESC");
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: "Database error" }); }
});

app.post("/api/records", async (req, res) => {
  try {
    const p = req.body;
    if (/^0/.test(String(p.udise_code || "").trim())) return res.status(400).json({error:"School UDISE Code must be entered without a leading zero."});
    if (!String(p.new_section || "").trim()) return res.status(400).json({error:"New Section is required."});
    if (!p.document_data) return res.status(400).json({error:"A PDF document is required."});
    if (!supabase) return res.status(500).json({error:"Supabase Storage is not configured."});
    const allowed = ["application/pdf"];
    if (!allowed.includes(p.document_type)) return res.status(400).json({error:"Only PDF files are allowed."});
    const raw = Buffer.from(p.document_data, "base64");
    if (raw.length > 512 * 1024) return res.status(400).json({error:"PDF must be 512 KB or smaller."});
    const udiseSafe = String(p.udise_code || "").replace(/[^a-zA-Z0-9_-]/g, "");
    const penSafe = String(p.pen_number || "").replace(/[^a-zA-Z0-9_-]/g, "");
    const studentSafe = String(p.student_name || "Student").replace(/[^a-zA-Z0-9._ -]/g, "").trim().replace(/\s+/g, "_");
    const pdfFileName = `${udiseSafe}_${penSafe}_${studentSafe}.pdf`;
    const filePath = `${udiseSafe}/${penSafe}/${pdfFileName}`;
    const up = await supabase.storage.from(BUCKET).upload(filePath, raw, {contentType:"application/pdf", upsert:true});
    if (up.error) return res.status(500).json({error:"Document upload failed: "+up.error.message});
    // Prevent duplicate PEN numbers before uploading a new document.
    const duplicatePen = await pool.query(
      "SELECT id FROM students WHERE pen_number=$1 LIMIT 1",
      [p.pen_number]
    );
    if (duplicatePen.rowCount) {
      return res.status(409).json({
        error:"This PEN number already exists. Duplicate entry is not allowed."
      });
    }

    const r = await pool.query(
      `INSERT INTO students
       (block_name,school_name,udise_code,pen_number,student_name,new_class,new_section,new_gender,email_id,document_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [p.block_name,p.school_name,p.udise_code,p.pen_number,p.student_name,p.new_class,p.new_section,p.new_gender||"",p.email_id,filePath]);
    res.json({ok:true,id:r.rows[0].id});
  } catch(e) {
    if (e && e.code === "23505" && String(e.constraint || "").includes("students_pen_number_unique")) {
      return res.status(409).json({
        error: "This PEN number already exists. Duplicate entry is not allowed."
      });
    }
    console.error(e);
    res.status(500).json({error:"Could not save record"});
  }
});

// Securely create a one-time signed URL for the associated PDF.
app.get("/api/records/:id/document", adminOnly, async (req,res) => {
  try {
    if (!supabase) return res.status(500).json({error:"Storage not configured"});
    const r = await pool.query("SELECT document_path FROM students WHERE id=$1",[req.params.id]);
    if (!r.rowCount || !r.rows[0].document_path) return res.status(404).json({error:"No document attached"});
    const {data,error} = await supabase.storage.from(BUCKET).createSignedUrl(r.rows[0].document_path, 300, {download:true});
    if (error) {
      const status = /not found|NoSuchKey|object not found/i.test(error.message || "") ? 404 : 500;
      return res.status(status).json({error:error.message});
    }
    res.json({url:data.signedUrl});
  } catch(e) { res.status(500).json({error:"Could not prepare document download"}); }
});

app.get("/api/records/:id/document-preview", adminOnly, async (req,res) => {
  try {
    if (!supabase) return res.status(500).json({error:"Storage not configured"});
    const r = await pool.query("SELECT document_path FROM students WHERE id=$1",[req.params.id]);
    if (!r.rowCount || !r.rows[0].document_path) return res.status(404).json({error:"No document attached"});
    const {data,error} = await supabase.storage.from(BUCKET).createSignedUrl(r.rows[0].document_path, 300);
    if (error) {
      const status = /not found|NoSuchKey|object not found/i.test(error.message || "") ? 404 : 500;
      return res.status(status).json({error:error.message});
    }
    res.json({url:data.signedUrl});
  } catch(e) { res.status(500).json({error:"Could not prepare document preview"}); }
});

// The update endpoint requires that the associated document exists.
app.put("/api/records/:id", adminOnly, async (req,res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({error:"Invalid record ID."});

    const existing = await pool.query(
      "SELECT document_path FROM students WHERE id=$1",
      [id]
    );
    if (!existing.rowCount)
      return res.status(404).json({error:"Student record not found. Record was not updated."});
    if (!existing.rows[0].document_path)
      return res.status(400).json({error:"No PDF is attached. Download the PDF before updating. Record was not updated."});

    const p = req.body || {};
    const udise = String(p.udise_code || "").trim();
    const pen = String(p.pen_number || "").trim();
    const newSection = String(p.new_section || "").trim();

    if (!udise) return res.status(400).json({error:"School UDISE Code is required."});
    if (/^0/.test(udise)) return res.status(400).json({error:"School UDISE Code must be entered without a leading zero."});
    if (!pen) return res.status(400).json({error:"PEN Number is required."});
    if (!newSection) return res.status(400).json({error:"New Section is required."});

    // If PEN is changed, make sure it does not collide with another student.
    const duplicatePen = await pool.query(
      "SELECT id FROM students WHERE pen_number=$1 AND id<>$2 LIMIT 1",
      [pen, id]
    );
    if (duplicatePen.rowCount) {
      return res.status(409).json({error:"This PEN number already exists. Duplicate entry is not allowed."});
    }

    const updateResult = await pool.query(
      `UPDATE students SET block_name=$1,school_name=$2,udise_code=$3,pen_number=$4,
       student_name=$5,new_class=$6,new_section=$7,new_gender=$8,email_id=$9,
       bmis_remarks=$10,updated_at=NOW() WHERE id=$11`,
      [
        p.block_name || "", p.school_name || "", udise, pen,
        p.student_name || "", p.new_class || "", newSection,
        p.new_gender || "", p.email_id || "", p.bmis_remarks || "", id
      ]
    );

    if (!updateResult.rowCount)
      return res.status(404).json({error:"Student record was not found. Record was not updated."});

    // The record is updated only after the browser has successfully downloaded the PDF.
    // Delete the stored PDF only after the database update succeeds.
    const documentPath = existing.rows[0].document_path;
    if (supabase && documentPath) {
      const del = await supabase.storage.from(BUCKET).remove([documentPath]);
      if (del.error) {
        console.error("PDF deletion failed:", del.error.message);
        return res.json({ok:true,documentDeleted:false,warning:"Record updated, but the downloaded PDF could not be removed from storage."});
      }
    }

    await pool.query("UPDATE students SET document_path='' WHERE id=$1", [id]);
    res.json({ok:true,documentDeleted:true});
  } catch(e) {
    console.error("Record update failed:", e);
    if (e && e.code === "23505") {
      return res.status(409).json({error:"This PEN number already exists. Duplicate entry is not allowed."});
    }
    res.status(500).json({error:"Could not update record: "+(e.message || "Database error")});
  }
});


app.get("/api/export.xlsx", adminOnly, async (req,res) => {
  try {
    const ExcelJS = require("exceljs");
    const result = await pool.query(`SELECT block_name,school_name,udise_code,pen_number,student_name,
      new_gender,new_class,new_section,email_id,bmis_remarks,created_at,updated_at
      FROM students ORDER BY id DESC`);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("All Records");
    ws.columns = [
      {header:"Block Name",key:"block_name",width:22},{header:"School Name",key:"school_name",width:32},
      {header:"UDISE Code",key:"udise_code",width:16},{header:"PEN Number",key:"pen_number",width:16},
      {header:"Student Name",key:"student_name",width:28},
      {header:"New Gender",key:"new_gender",width:14},{header:"New Class",key:"new_class",width:14},
      {header:"New Section",key:"new_section",width:14},
      {header:"Email ID",key:"email_id",width:30},{header:"BMIS Remarks",key:"bmis_remarks",width:35},
      {header:"Created At",key:"created_at",width:24},{header:"Updated At",key:"updated_at",width:24}
    ];
    result.rows.forEach(row=>ws.addRow(row)); ws.getRow(1).font={bold:true}; ws.views=[{state:"frozen",ySplit:1}];
    const buf=await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition",'attachment; filename="MIS_Wing_Moga_All_Records.xlsx"');
    res.send(Buffer.from(buf));
  } catch(e){console.error(e);res.status(500).json({error:"Could not export Excel file"});}
});

app.use((req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
init().then(()=>app.listen(PORT,()=>console.log(`MIS Wing Moga running on ${PORT}`)))
  .catch(e=>{console.error(e);process.exit(1)});
