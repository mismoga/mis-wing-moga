Final save-record fix:
- Removed the malformed RETURNING fragment from the INSERT.
- INSERT now uses exactly 10 columns and 10 parameter values.
- Email is not stored or referenced.
- The INSERT does not use RETURNING because the application does not require it.
