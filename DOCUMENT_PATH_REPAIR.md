Fixed the Associated PDF / No document attached problem.

The application now:
- Saves document_path when a new PDF is uploaded.
- Repairs older records with a blank document_path by checking the deterministic
  Supabase Storage path used by the upload process.
- Uses the repaired path for PDF download and update.
- Keeps the PDF-download-before-update rule.
- Does not store email.
