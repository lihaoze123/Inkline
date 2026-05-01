# Technical Notes

The rename is intentionally split between user-facing product identity and stable internal identifiers.

Keep unchanged:

* `package.json` package name `english-coach`
* SQLite filename `english-coach.sqlite`
* keytar service name `english-coach`

Reason: changing these would require app data and credential migration, which is outside a visual/product naming pass.
