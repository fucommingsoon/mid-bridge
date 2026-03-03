# SympGAN Dataset

This directory contains medical knowledge data extracted from the SympGAN dataset for the Medi-Bridge API PostgreSQL database.

## Data Files

| File | Size | Records | Description |
|------|------|---------|-------------|
| `diseases.tsv` | 16.8 MB | 25,819 | Disease data (original SympGAN data) |
| `symptoms.tsv` | 3.0 MB | 12,560 | Symptom data (original SympGAN data) |
| `symptom_disease_associations.tsv` | 12.9 MB | 184,648 | Disease-symptom association data |
| `symptom_extensions.tsv` | 2 KB | - | Symptom extended information (AI-generated, reverse export) |

## Data Source

SympGAN is an open-source medical knowledge graph dataset containing:
- Approximately 25,000 diseases
- Approximately 12,000 symptoms
- Approximately 184,000 disease-symptom associations

Data sources include: HSDN, MalaCards, OrphaNet, UMLS, HPO, NCI, and other authoritative medical databases.

## File Format

All files are in TSV (Tab-Separated Values) format with UTF-8 encoding.

### diseases.tsv

| Field | Description |
|-------|-------------|
| Disease_CUI | Disease unique identifier (UMLS CUI) |
| Disease_Name | Disease name |
| Alias | Aliases (pipe-separated) |
| Definition | Definition |
| External_Ids | External IDs (pipe-separated, e.g., HPO, OMIM, SNOMEDCT) |

### symptoms.tsv

| Field | Description |
|-------|-------------|
| Symptom_CUI | Symptom unique identifier (UMLS CUI) |
| Symptom_Name | Symptom name |
| Alias | Aliases (pipe-separated) |
| Definition | Definition |
| External_Ids | External IDs (pipe-separated) |

### symptom_disease_associations.tsv

| Field | Description |
|-------|-------------|
| Symptom_CUI | Symptom CUI |
| Symptom_Name | Symptom name |
| Disease_CUI | Disease CUI |
| Disease_Name | Disease name |
| Source | Data source (HSDN, MalaCards, OrphaNet, etc.) |

### symptom_extensions.tsv

| Field | Description |
|-------|-------------|
| Symptom_CUI | Associated symptom CUI |
| Full_Description | Complete description (long text for clinical reference) |
| Summary | Summary (short description optimized for vector search) |
| Keywords | Keywords (semicolon-separated) |
| Clinical_Notes | Clinical notes |
| Source | Data source (AI, manual, etc.) |
| Version | Version number |

> **Note**: `symptom_extensions.tsv` is a reverse export from PostgreSQL, used to store AI-generated extended information. Do not modify this file directly for re-import.

## Database Table Structure

Table structures after importing to PostgreSQL:

### diseases table
```sql
CREATE TABLE diseases (
    id SERIAL PRIMARY KEY,
    cui VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    alias TEXT,
    definition TEXT,
    external_ids TEXT,
    created_at TIMESTAMP NOT NULL
);
```

### symptoms table
```sql
CREATE TABLE symptoms (
    id SERIAL PRIMARY KEY,
    cui VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    alias TEXT,
    definition TEXT,
    external_ids TEXT,
    created_at TIMESTAMP NOT NULL
);
```

### disease_symptom_associations table
```sql
CREATE TABLE disease_symptom_associations (
    id SERIAL PRIMARY KEY,
    disease_id INTEGER REFERENCES diseases(id) ON DELETE CASCADE,
    symptom_id INTEGER REFERENCES symptoms(id) ON DELETE CASCADE,
    source VARCHAR(200),
    created_at TIMESTAMP NOT NULL
);
```

### symptom_extensions table
```sql
CREATE TABLE symptom_extensions (
    id SERIAL PRIMARY KEY,
    symptom_id INTEGER REFERENCES symptoms(id) ON DELETE CASCADE,
    full_description TEXT,
    summary TEXT,
    keywords TEXT,
    clinical_notes TEXT,
    source VARCHAR(100),
    version VARCHAR(50),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

## Import Data

### Method 1: Run Import Script

```bash
cd /path/to/medi-bridge-api
python scripts/import_sympgan.py
```

The script will automatically:
1. Import diseases.tsv → diseases table
2. Import symptoms.tsv → symptoms table
3. Import symptom_disease_associations.tsv → disease_symptom_associations table
4. Skip existing data (determined by CUI)

### Method 2: Re-import (Clear Tables)

```bash
# Clear tables
docker exec my-postgres psql -U postgres -d postgres -c \
  "TRUNCATE disease_symptom_associations, symptoms, diseases CASCADE;"

# Run import script
python scripts/import_sympgan.py
```

## Data Validation

### Check Imported Record Counts

```sql
SELECT 'diseases' as table_name, COUNT(*) as count FROM diseases
UNION ALL
SELECT 'symptoms', COUNT(*) FROM symptoms
UNION ALL
SELECT 'associations', COUNT(*) FROM disease_symptom_associations;
```

Expected results:
- diseases: 25,819
- symptoms: 12,560
- associations: 184,648

### View Sample Data

```sql
-- View diseases
SELECT id, cui, name FROM diseases LIMIT 5;

-- View symptoms
SELECT id, cui, name FROM symptoms LIMIT 5;

-- View associations
SELECT ds.id, d.name as disease, s.name as symptom, ds.source
FROM disease_symptom_associations ds
JOIN diseases d ON ds.disease_id = d.id
JOIN symptoms s ON ds.symptom_id = s.id
LIMIT 5;
```

## Generating Extended Information

The `symptom_extensions` table stores extended information generated through AI:

1. **Full_Description**: Complete medical description, suitable for clinical reference
2. **Summary**: Brief summary optimized for vector search
3. **Keywords**: Keyword tags for categorization and retrieval
4. **Clinical_Notes**: Clinical notes providing additional reference information

This information can be:
- Batch generated using Alibaba Cloud Qwen (通义千问) AI model
- Manually edited and supplemented
- Imported from other medical knowledge bases

### Generate Extensions Using AI

```bash
# Set API key
export BAILIAN_API_KEY=your_alibaba_cloud_api_key

# Generate extensions for 100 symptoms
python scripts/generate_symptom_extensions.py --limit 100

# Specify custom delay between API calls
python scripts/generate_symptom_extensions.py --limit 100 --delay 2
```

## Important Notes

1. **Data Integrity**: The SympGAN dataset is sourced from multiple databases and may contain duplicates or inconsistencies
2. **Update Frequency**: This dataset is a static snapshot and does not auto-update
3. **Clinical Use**: This data is for reference only and cannot replace professional medical advice
4. **Extended Information**: `symptom_extensions.tsv` is a reverse export; manual modifications should not be directly re-imported

## References

- SympGAN: https://github.com/nc仍然/SympGAN
- UMLS: https://www.nlm.nih.gov/research/umls/
- HPO: https://hpo.jax.org/
- Alibaba Cloud Dashscope: https://dashscope.aliyun.com/
