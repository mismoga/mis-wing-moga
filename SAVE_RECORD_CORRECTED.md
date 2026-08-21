Corrected the Add Student INSERT statement.

The previous build contained a duplicated SQL fragment after the INSERT:
VALUES ... RETURNING ... This caused PostgreSQL's syntax error near RETURNING.

The Add Student query is now a single INSERT with 10 columns and 10 values,
and no RETURNING clause. Email is not stored.
