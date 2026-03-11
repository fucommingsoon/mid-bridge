#!/usr/bin/env npx ts-node
/**
 * Export vectors from Qdrant to JSON file
 *
 * This script exports all vectors, payloads, and IDs from a Qdrant collection
 * to a JSON file for backup or migration purposes.
 *
 * Usage:
 *   npx ts-node scripts/export-qdrant-vectors.ts
 *   # or
 *   pnpm run export:vectors
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'medical_knowledge';
const BATCH_SIZE = 100;
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'qdrant');
const OUTPUT_FILE = path.join(OUTPUT_DIR, `vectors-${COLLECTION_NAME}-${Date.now()}.json`);

interface ExportedPoint {
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
 * Export vectors from Qdrant
 */
async function exportVectors(): Promise<void> {
  console.log('============================================================');
  console.log('Export vectors from Qdrant');
  console.log('============================================================');
  console.log(`URL: ${QDRANT_URL}`);
  console.log(`Collection: ${COLLECTION_NAME}`);
  console.log(`Output: ${OUTPUT_FILE}`);

  try {
    const client = new QdrantClient({ url: QDRANT_URL });

    // Check if collection exists
    try {
      const collectionInfo = await client.getCollection(COLLECTION_NAME);
      console.log(`\n✓ Collection exists with ${collectionInfo.result.points_count} points`);
    } catch (error: any) {
      console.error(`\n✗ Collection '${COLLECTION_NAME}' not found`);
      console.error('  Make sure Qdrant is running and the collection exists');
      console.error(`  Run: pnpm run index:symptoms`);
      process.exit(1);
    }

    const allPoints: ExportedPoint[] = [];
    let offset: string | null = null;
    let totalCount = 0;

    console.log('\nStarting export...');

    while (true) {
      const result = await client.scroll(COLLECTION_NAME, {
        limit: BATCH_SIZE,
        offset: offset,
        with_payload: true,
        with_vector: true,
      });

      const points = result.points;
      if (points.length === 0) break;

      allPoints.push(...points as ExportedPoint[]);
      totalCount += points.length;

      console.log(`  Exported ${totalCount.toLocaleString()} points...`);

      if (!result.next_page_offset) break;
      offset = result.next_page_offset;
    }

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Write to JSON file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allPoints, null, 2));

    console.log(`\n✓ Exported ${totalCount.toLocaleString()} points to ${OUTPUT_FILE}`);
    console.log(`  File size: ${(fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2)} MB`);

    // Show sample data
    if (allPoints.length > 0) {
      console.log('\nSample data (first 2 points):');
      for (let i = 0; i < Math.min(2, allPoints.length); i++) {
        const point = allPoints[i];
        console.log(`\n${i + 1}. ID: ${point.id}`);
        console.log(`   Vector dimensions: ${Array.isArray(point.vector[0]) ? 'Multi-vector' : point.vector.length}`);
        console.log(`   CUI: ${point.payload?.cui || 'N/A'}`);
        console.log(`   Summary: ${point.payload?.summary?.substring(0, 50) || 'N/A'}...`);
      }
    }

    console.log('\n============================================================');
    console.log('Export complete!');
    console.log('============================================================');
  } catch (error) {
    console.error('\n✗ Export failed:', error);
    process.exit(1);
  }
}

// Run main function
exportVectors();
