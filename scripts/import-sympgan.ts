#!/usr/bin/env npx ts-node
/**
 * Import SympGAN data from TSV files to PostgreSQL
 *
 * This script imports:
 * 1. diseases.tsv -> diseases table
 * 2. symptoms.tsv -> symptoms table
 * 3. symptom_disease_associations.tsv -> disease_symptom_associations table
 *
 * Usage:
 *   npx ts-node scripts/import-sympgan.ts
 *   # or
 *   pnpm run import:sympgan
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/db';

// Data directory
const DATA_DIR = path.join(__dirname, '..', 'data', 'sympgan');

// Batch size for bulk inserts
const BATCH_SIZE = 1000;

interface TSVRow {
  [key: string]: string;
}

/**
 * Read TSV file and return list of objects
 */
function readTSV(filePath: string): TSVRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');

  if (lines.length === 0) {
    return [];
  }

  // Parse header
  const headers = lines[0].split('\t');

  // Parse data rows
  const rows: TSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split('\t');
    if (values.length === headers.length) {
      const row: TSVRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Import diseases from TSV file
 */
async function importDiseases(): Promise<Map<string, number>> {
  const tsvPath = path.join(DATA_DIR, 'diseases.tsv');

  if (!fs.existsSync(tsvPath)) {
    console.log(`File not found: ${tsvPath}`);
    return new Map();
  }

  console.log(`\n[1/3] Importing diseases from ${tsvPath}...`);

  const rows = readTSV(tsvPath);
  console.log(`  Found ${rows.length} disease records`);

  const cuiToId = new Map<string, number>();
  let imported = 0;
  let skipped = 0;

  // Process in batches
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      // Check if already exists
      const existing = await prisma.disease.findUnique({
        where: { cui: row['Disease_CUI'] },
        select: { id: true },
      });

      if (existing) {
        cuiToId.set(row['Disease_CUI'], existing.id);
        skipped++;
        continue;
      }

      // Create new disease
      const disease = await prisma.disease.create({
        data: {
          cui: row['Disease_CUI'],
          name: row['Disease_Name'],
          alias: row['Alias'] || null,
          definition: row['Definition'] || null,
          externalIds: row['External_Ids'] || null,
        },
      });

      cuiToId.set(row['Disease_CUI'], disease.id);
      imported++;
    }

    console.log(`  Processed ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} records...`);
  }

  console.log(`  Imported: ${imported}, Skipped (existing): ${skipped}`);
  return cuiToId;
}

/**
 * Import symptoms from TSV file
 */
async function importSymptoms(): Promise<Map<string, number>> {
  const tsvPath = path.join(DATA_DIR, 'symptoms.tsv');

  if (!fs.existsSync(tsvPath)) {
    console.log(`File not found: ${tsvPath}`);
    return new Map();
  }

  console.log(`\n[2/3] Importing symptoms from ${tsvPath}...`);

  const rows = readTSV(tsvPath);
  console.log(`  Found ${rows.length} symptom records`);

  const cuiToId = new Map<string, number>();
  let imported = 0;
  let skipped = 0;

  // Process in batches
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      // Check if already exists
      const existing = await prisma.symptom.findUnique({
        where: { cui: row['Symptom_CUI'] },
        select: { id: true },
      });

      if (existing) {
        cuiToId.set(row['Symptom_CUI'], existing.id);
        skipped++;
        continue;
      }

      // Create new symptom
      const symptom = await prisma.symptom.create({
        data: {
          cui: row['Symptom_CUI'],
          name: row['Symptom_Name'],
          alias: row['Alias'] || null,
          definition: row['Definition'] || null,
          externalIds: row['External_Ids'] || null,
        },
      });

      cuiToId.set(row['Symptom_CUI'], symptom.id);
      imported++;
    }

    console.log(`  Processed ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} records...`);
  }

  console.log(`  Imported: ${imported}, Skipped (existing): ${skipped}`);
  return cuiToId;
}

/**
 * Import disease-symptom associations from TSV file
 */
async function importAssociations(
  diseaseCuiToId: Map<string, number>,
  symptomCuiToId: Map<string, number>
): Promise<void> {
  const tsvPath = path.join(DATA_DIR, 'symptom_disease_associations.tsv');

  if (!fs.existsSync(tsvPath)) {
    console.log(`File not found: ${tsvPath}`);
    return;
  }

  console.log(`\n[3/3] Importing associations from ${tsvPath}...`);

  const rows = readTSV(tsvPath);
  console.log(`  Found ${rows.length} association records`);

  let imported = 0;
  let skippedDisease = 0;
  let skippedSymptom = 0;
  let skippedExisting = 0;

  // Process in batches
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      const diseaseCui = row['Disease_CUI'];
      const symptomCui = row['Symptom_CUI'];

      // Get IDs from CUI mappings
      const diseaseId = diseaseCuiToId.get(diseaseCui);
      const symptomId = symptomCuiToId.get(symptomCui);

      if (!diseaseId) {
        skippedDisease++;
        continue;
      }
      if (!symptomId) {
        skippedSymptom++;
        continue;
      }

      // Check if association already exists
      const existing = await prisma.diseaseSymptomAssociation.findFirst({
        where: {
          diseaseId,
          symptomId,
        },
      });

      if (existing) {
        skippedExisting++;
        continue;
      }

      // Create new association
      await prisma.diseaseSymptomAssociation.create({
        data: {
          diseaseId,
          symptomId,
          source: row['Source'] || null,
        },
      });

      imported++;
    }

    console.log(`  Processed ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} records...`);
  }

  console.log(`\n  Imported: ${imported}`);
  console.log(`  Skipped - disease not found: ${skippedDisease}`);
  console.log(`  Skipped - symptom not found: ${skippedSymptom}`);
  console.log(`  Skipped - existing association: ${skippedExisting}`);
}

/**
 * Main import function
 */
async function main(): Promise<void> {
  console.log('============================================================');
  console.log('SympGAN Data Import to PostgreSQL');
  console.log('============================================================');

  // Verify data files exist
  const requiredFiles = ['diseases.tsv', 'symptoms.tsv', 'symptom_disease_associations.tsv'];
  for (const file of requiredFiles) {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.error(`\nError: Data file not found: ${filePath}`);
      console.error('Please ensure SympGAN dataset is in ./data/sympgan/');
      process.exit(1);
    }
  }

  try {
    // Import diseases and get CUI to ID mapping
    const diseaseCuiToId = await importDiseases();

    // Import symptoms and get CUI to ID mapping
    const symptomCuiToId = await importSymptoms();

    // Import associations using mappings
    await importAssociations(diseaseCuiToId, symptomCuiToId);

    // Show statistics
    console.log('\n============================================================');
    console.log('Import completed successfully!');
    console.log('============================================================');

    const diseaseCount = await prisma.disease.count();
    const symptomCount = await prisma.symptom.count();
    const assocCount = await prisma.diseaseSymptomAssociation.count();

    console.log(`\nTotal diseases in database: ${diseaseCount}`);
    console.log(`Total symptoms in database: ${symptomCount}`);
    console.log(`Total disease-symptom associations: ${assocCount}`);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run main function
main();
