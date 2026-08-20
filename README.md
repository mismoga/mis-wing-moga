# MIS Wing Moga – Final Website

Final deployment package for the MIS Wing Moga student class updation website.

## Included
- Public Home data entry with UDISE → Block + School lookup
- Old Gender and New Gender
- Nursery through 12th class options
- Required PDF upload, maximum 512 KB
- PDF stored in Supabase Storage as `UDISE_PEN_StudentName.pdf`
- Password-protected Update Record (default password from `ADMIN_PASSWORD`, fallback `Mismoga`)
- PDF preview before update
- Download PDF first, then update record
- After successful update, PDF is deleted from Supabase Storage and the database document reference is cleared
- All Records search
- Password-protected Excel export including gender fields

## Render environment variables
- DATABASE_URL
- SUPABASE_URL (base project URL, not `/rest/v1/`)
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_STORAGE_BUCKET=student-documents
- ADMIN_PASSWORD=Mismoga (or your chosen password)

- Duplicate PEN numbers are blocked in New Entry with both an application check and a database-level unique index.
