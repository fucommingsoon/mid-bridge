#!/usr/bin/env npx ts-node
/**
 * Import vectors from JSON file to Qdrant
 *
 * This script imports vectors, payloads, and IDs from a JSON file
 * exported by export-qdrant-vectors.ts into a Qdrant collection.
 *
 * Usage:
 *   npx ts-node scripts/import-qdrant-vectors.ts <json-file>
 *   # or
 *   pnpm run import:vectors <json-file>
 *
 * Example:
 *   pnpm run import:vectors data/qdrant/vectors-medical_knowledge-1710000000000.json
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'medical_knowledge';
const BATCH_SIZE = 100;

interface ImportedPoint {
  id: string | number;
  vector: number[] | number[][];
  payload?: {
    cui?: string;
    summary?: string;
    full_description?: string;
    [key: string]: any;
  };
}

/**
 * Parse command line arguments
 */
function parseArgs(): { inputFile: string } {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Error: Missing input file');
    console.error('\nUsage:');
    console.error('  npx ts-node scripts/import-qdrant-vectors.ts <json-file>');
    console.error('\nExample:');
    console.error('  pnpm run import:vectors data/qdrant/vectors-medical_knowledge-2024-03-11.json');
    process.exit(1);
  }
  return { inputFile: args[0] };
}

/**
 * Import vectors to Qdrant
 */
async function importVectors(): Promise<void> {
  const { inputFile } = parseArgs();

  console.log('============================================================');
  console.log('Import vectors to Qdrant');
  console.log('============================================================');
  console.log(`URL: ${QDRANT_URL}`);
  console.log(`Collection: ${COLLECTION_NAME}`);
  console.log(`Input file: ${inputFile}`);

  try {
    const client = new QdrantClient({ url: QDRANT_URL });

    // Read input file
    if (!fs.existsSync(inputFile)) {
      console.error(`\n✗ File not found: ${inputFile}`);
      process.exit(1);
    }

    const fileContent = fs.readFileSync(inputFile, 'utf-8');
    const points = JSON.parse(fileContent) as ImportedPoint[];
    const totalPoints = points.length;

    console.log(`\n✓ Loaded ${totalPoints.toLocaleString()} points from file`);
    console.log(`  File size: ${(fileContent.length / 1024 / 1024).toFixed(2)} MB`);

    // Show sample data
    if (points.length > 0) {
      console.log('\nSample data (first 2 points):');
      for (let i = 0; i < Math.min(2, points.length); i++) {
        const point = points[i];
        console.log(`\n${i + 1}. ID: ${point.id}`);
        console.log(`   Vector dimensions: ${Array.isArray(point.vector[0]) ? 'Multi-vector' : point.vector.length}`);
        console.log(`   CUI: ${point.payload?.cui || 'N/A'}`);
        console.log(`   Summary: ${point.payload?.summary?.substring(0, 50) || 'N/A'}...`);
      }
    }

    // Check if collection exists
    console.log('\nChecking collection...');
    let collectionExists = false;
    try {
      await client.getCollection(COLLECTION_NAME);
      collectionExists = true;
      console.log(`✓ Collection '${COLLECTION_NAME}' already exists`);
      console.log('  Data will be added/upserted to existing collection');
    } catch (error: any) {
      console.log(`✓ Collection '${COLLECTION_NAME}' does not exist, will be created`);
    }

    // Import in batches
    console.log('\nStarting import...');
    const startTime = Date.now();

    for (let i = 0; i < totalPoints; i += BATCH_SIZE) {
      const batch = points.slice(i, i + BATCH_SIZE);
      const progress = i + batch.length;

      await client.upsert(COLLECTION_NAME, {
        points: batch,
        wait: false,
      });

      const elapsed = Date.now() - startTime;
      const eta = elapsed / progress * (totalPoints - progress);
      const etaMinutes = Math.ceil(eta / 60000);

      process.stdout.write(`\r  Progress: ${progress.toLocaleString()} / ${totalPoints.toLocaleString()} (${((progress / totalPoints) * 100).toFixed(1)}%) | ETA: ~${etaMinutes}min`);
    }

    const elapsed = Date.now() - startTime;
    const elapsedMinutes = (elapsed / 60000).toFixed(2);

    console.log(`\n\n✓ Import complete!`);
    console.log(`  Total points: ${totalPoints.toLocaleString()}`);
    console.log(`  Time taken: ${elapsedMinutes} minutes`);
    console.log(`  Speed: ${(totalPoints / (elapsed / 1000)).toFixed(0)} points/sec`);

    // Verify import
    console.log('\nVerifying import...');
    const collectionInfo = await client.getCollection(COLLECTION_NAME);
    console.log(`✓ Collection now has ${collectionInfo.result.points_count.toLocaleString()} points`);

    console.log('\n============================================================');
    console.log('Import complete!');
    console.log('============================================================');
  } catch (error) {
    console.error('\n✗ Import failed:', error);
    process.exit(1);
  }
}

// Run main function
importVectors();
