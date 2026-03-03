# Medi-Bridge Scripts

This directory contains utility scripts for Medi-Bridge data management.

## Scripts

| Script | Description | Command |
|--------|-------------|---------|
| `import-sympgan.ts` | Import SympGAN TSV data to PostgreSQL | `pnpm run import:sympgan` |
| `generate-symptom-extensions.ts` | Generate symptom extensions using Qwen AI | `pnpm run generate:extensions` |
| `export-symptom-extensions.ts` | Export symptom_extensions to TSV | `pnpm run export:extensions` |
| `index-symptoms-to-qdrant.ts` | Index symptom extensions to Qdrant vector DB | `pnpm run index:qdrant` |

---

## import-sympgan.ts

Import SympGAN dataset from TSV files to PostgreSQL database.

**Usage:**
```bash
pnpm run import:sympgan
# or
npx ts-node scripts/import-sympgan.ts
```

**Features:**
- Batch imports diseases, symptoms, and disease-symptom associations
- Skips existing records (by CUI)
- Shows progress during import
- Handles ~180K+ associations efficiently

**Data Flow:**
```
data/sympgan/diseases.tsv → diseases table
data/sympgan/symptoms.tsv → symptoms table
data/sympgan/symptom_disease_associations.tsv → disease_symptom_associations table
```

**Re-import (clear tables first):**
```bash
docker exec my-postgres psql -U postgres -d postgres -c \
  "TRUNCATE disease_symptom_associations, symptoms, diseases CASCADE;"
pnpm run import:sympgan
```

---

## generate-symptom-extensions.ts

Generate AI-powered symptom descriptions and summaries using Alibaba Cloud Qwen (通义千问) model.

**Prerequisites:**
- Set `BAILIAN_API_KEY` environment variable in `.env`
- Ensure `symptoms` table has data

**Usage:**
```bash
# Generate for 100 symptoms (default)
pnpm run generate:extensions

# Generate for specific number
pnpm run generate:extensions -- --limit 50

# Set custom delay between API calls (seconds)
pnpm run generate:extensions -- --limit 100 --delay 2
```

**Arguments:**
| Argument | Default | Description |
|----------|---------|-------------|
| --limit | 100 | Number of symptoms to process |
| --delay | 1.0 | Delay between API calls in seconds |

**Features:**
- Queries symptoms without existing AI extensions
- Generates 4 types of content:
  - `full_description`: Complete medical description (200-500 words)
  - `summary`: Brief summary (10-30 words)
  - `keywords`: 3-5 keywords (semicolon-separated)
  - `clinical_notes`: Clinical notes (50-150 words)
- Automatic retry on failure (3 attempts)
- Progress tracking and error reporting

**Data Flow:**
```
symptoms table (without extensions)
    ↓
Qwen AI API (dashscope)
    ↓
symptom_extensions table
```

---

## export-symptom-extensions.ts

Export symptom_extensions from PostgreSQL to TSV file.

**Usage:**
```bash
pnpm run export:extensions
# or
npx ts-node scripts/export-symptom-extensions.ts
```

**Features:**
- Exports all records from `symptom_extensions` table
- Joins with `symptoms` table to include CUI
- Outputs to `data/sympgan/symptom_extensions.tsv`
- Shows sample data after export

**Data Flow:**
```
symptom_extensions table + symptoms table
    ↓
data/sympgan/symptom_extensions.tsv
```

---

## index-symptoms-to-qdrant.ts

Index symptom extensions to Qdrant vector database for semantic search.

**Prerequisites:**
- Ensure `symptom_extensions` table has data
- Qdrant service should be running

**Usage:**
```bash
# Index 100 symptom extensions (default)
pnpm run index:qdrant

# Index specific number
pnpm run index:qdrant -- --limit 50

# Set custom delay between operations
pnpm run index:qdrant -- --limit 100 --delay 0.5
```

**Arguments:**
| Argument | Default | Description |
|----------|---------|-------------|
| --limit | 100 | Number of symptom extensions to process |
| --delay | 0.1 | Delay between operations in seconds |

**Features:**
- Reads from `symptom_extensions` table (with CUI from `symptoms` table)
- Checks if CUI already exists in Qdrant (skips if exists)
- Uses `full_description` field for embedding (fallback to `summary`)
- Stores vector with CUI as payload identifier
- Idempotent - safe to run multiple times

**Data Flow:**
```
symptom_extensions + symptoms tables
    ↓
Embedding Service (text-embedding-v4)
    ↓
Qdrant Vector Database
```

**Payload Structure:**
```json
{
    "cui": "C0027834",
    "summary": "Chest discomfort or pain",
    "full_description": "Complete description..."
}
```

---

## Common Workflow

**Initial setup:**
```bash
# 1. Import SympGAN base data
pnpm run import:sympgan

# 2. Generate AI extensions (ensure BAILIAN_API_KEY is set in .env)
pnpm run generate:extensions -- --limit 100

# 3. Index to Qdrant for vector search
pnpm run index:qdrant -- --limit 100
```

**Export/backup:**
```bash
# Export extensions to TSV
pnpm run export:extensions
```

## Notes

1. **Order matters**: Always run `import:sympgan` before `generate:extensions`
2. **API limits**: Use `--delay` parameter to avoid rate limiting with Qwen API
3. **Idempotent**: Scripts skip existing data, safe to run multiple times
4. **Backup**: Use `export:extensions` before major changes

## Related Documentation

- [SympGAN Dataset](../data/sympgan/README.md) - Data source and format details
- [Prisma Schema](../prisma/schema.prisma) - Database table structures
