# Export/Import Jogja JDIH Data

## Export Data (17,813 records)

```bash
cd server
node src/scripts/exportJogjaData.js
```

Output:
- `exports/jogja_<timestamp>.json` (~17 MB) — full data array
- `exports/jogja_<timestamp>.sql` (~18 MB) — INSERT statements

## Import Data

```bash
cd server

# From JSON (recommended - faster)
node src/scripts/importJogjaData.js exports/jogja_<timestamp>.json

# From SQL
node src/scripts/importJogjaData.js exports/jogja_<timestamp>.sql
```

## Files (gitignored)
```
server/exports/
├── jogja_<timestamp>.json  (~17 MB)
└── jogja_<timestamp>.sql   (~18 MB)
```

## Notes
- JSON import uses `bulkCreate` with `updateOnDuplicate` (idempotent)
- SQL import runs raw statements (slower, ~5 min for 17k)
- Both scripts clear existing `jogja.prov.go.id` data before import
- Export folder is gitignored (files too large for git)

## Full Pipeline
```bash
# 1. Export from production DB
node src/scripts/exportJogjaData.js

# 2. Copy exports/ to new server

# 3. Import on new server
node src/scripts/importJogjaData.js exports/jogja_latest.json
```