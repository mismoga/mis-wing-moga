Email storage has been completely removed from the MIS student workflow.
The Home tab does not collect email, the API does not save email, and database
initialization removes the legacy email_id column if it exists. Existing student
records are not migrated into any email field.
