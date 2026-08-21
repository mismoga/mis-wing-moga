MIS Wing Moga save-record fix

This version fixes the save failure introduced when Email was removed from the Home tab.
The API now treats the removed Email field as an empty string instead of inserting NULL
into the database's NOT NULL email_id column.

It also verifies/creates the students table immediately before record operations, so a
deleted table can be recreated automatically when DATABASE_URL is valid.

The API now returns the underlying database/storage error in the response to make future
configuration problems diagnosable.
