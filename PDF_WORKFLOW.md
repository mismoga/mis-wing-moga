Required Update Record workflow:

1. User clicks Download PDF & Update Record.
2. Website downloads the PDF completely.
3. Website sends the student changes to the server.
4. Server updates the student in PostgreSQL.
5. ONLY after the database update succeeds, server deletes the old PDF from Supabase Storage.
6. ONLY after Storage deletion succeeds, server clears document_path.
7. If the student update fails, the PDF is NOT deleted.
8. If PDF deletion fails after a successful update, the student remains updated and the PDF remains available.
