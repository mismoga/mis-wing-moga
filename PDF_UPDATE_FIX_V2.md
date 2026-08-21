The Download PDF & Update workflow now downloads PDF bytes through the
MIS server, avoiding direct browser fetches to Supabase signed URLs/CORS.
The database UPDATE is sent only after a non-empty PDF has been received.
The update response is checked and the UI reports the actual error.
Email remains completely excluded from storage.
