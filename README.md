# MIS WING MOGA v2

Render:
- Build: npm install
- Start: npm start

Existing:
- DATABASE_URL = Supabase Session Pooler URI
- ADMIN_PASSWORD = your update password

Add:
- SUPABASE_URL = Supabase project URL
- SUPABASE_SERVICE_ROLE_KEY = Supabase service-role key (secret; Render environment only)
- SUPABASE_STORAGE_BUCKET = student-documents

Create a private Supabase Storage bucket named `student-documents`.
The app creates the database columns automatically, but the storage bucket must exist.


Document upload limit: 512 KB PDF.
