# Technical Notes

The rename is intentionally split between user-facing product identity and stable internal identifiers.

Keep unchanged:

* `package.json` package name `Inkline`
* SQLite filename `Inkline.sqlite`
* keytar service name `Inkline`

Reason: changing these would require app data and credential migration, which is outside a visual/product naming pass.
