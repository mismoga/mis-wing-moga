MIS Wing Moga - final amendments package

Included amendments:
- Old Gender and New Gender
- Duplicate PEN protection
- 512 KB PDF upload limit
- PDF naming: UDISE_PEN_StudentName.pdf
- Supabase PDF storage/reference handling
- Missing Supabase object (NoSuchKey) handling
- Excel export dependency
- Aadhaar-card PDF instruction near upload window

Update workflow requirement:
PDF must download successfully first, then ask the user for confirmation.
Only after confirmation should the frontend call the update endpoint.
After a successful update, the PDF is deleted and document_path is cleared.
