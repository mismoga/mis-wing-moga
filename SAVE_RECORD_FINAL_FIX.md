Fixed the save response.

The INSERT statement does not use RETURNING, so PostgreSQL correctly returns
no rows. The API previously tried to read r.rows[0].id, causing:
Cannot read properties of undefined (reading 'id').

The API now waits for the INSERT to succeed and returns {ok:true} without
accessing a nonexistent result row. Email remains completely excluded.
