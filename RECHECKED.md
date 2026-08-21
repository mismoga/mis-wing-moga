MIS Wing Moga full recheck

Fixed:
1. Removed email from record search, update, export, and frontend.
2. Removed email_id from UPDATE SQL.
3. Kept email_id removal during database initialization.
4. Fixed duplicate server startup/listen code.
5. Export now initializes/verifies the database before querying.
6. Save INSERT remains exactly 10 columns / 10 values with no RETURNING.
7. Update workflow remains PDF-download-first.
8. All Records screen has no PDF column and no Email column.
9. UDISE leading-zero validation and New Section validation remain.
10. Duplicate PEN protection remains.
