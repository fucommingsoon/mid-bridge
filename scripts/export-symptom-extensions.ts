#!/usr/bin/env npx ts-node
/**
 * Export symptom_extensions from PostgreSQL to TSV file
 *
 * This script queries the symptom_extensions table and exports data to TSV file,
 * including the CUI from the symptoms table for reference.
 *
 * Usage:
 *   npx ts-node scripts/export-symptom-extensions.ts
 *   # or
 *   pnpm run export:extensions
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/db';

// Output directory
const DATA_DIR = path.join(__dirname, '..', 'data', 'sympgan');
const OUTPUT_FILE = path.join(DATA_DIR, 'symptom_extensions.tsv');

/**
 * Escape TSV value
 */
function escapeTSV(value: string | null): string {
  if (value === null || value === undefined) {
    return '';
  }
  // Replace tabs and newlines with spaces
  return value.replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, '');
}

/**
 * Export symptom_extensions to TSV file
 */
async function exportExtensions(): Promise<void> {
  console.log('============================================================');
  console.log('Export symptom_extensions to TSV');
  console.log('============================================================');

  try {
    // Query extensions with symptom CUI
    const extensions = await prisma.symptomExtension.findMany({
      include: {
        symptom: {
          select: {
            cui: true,
          },
        },
      },
      orderBy: {
        symptom: {
          cui: 'asc',
        },
      },
    });

    if (extensions.length === 0) {
      console.log('\nNo data found in symptom_extensions table');
      return;
    }

    console.log(`\nFound ${extensions.length} records to export`);

    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Write to TSV file
    const header = [
      'Symptom_CUI',
      'Full_Description',
      'Summary',
      'Keywords',
      'Clinical_Notes',
      'Source',
      'Version',
    ];

    const lines: string[] = [header.join('\t')];

    for (const ext of extensions) {
      const row = [
        escapeTSV(ext.symptom.cui),
        escapeTSV(ext.fullDescription),
        escapeTSV(ext.summary),
        escapeTSV(ext.keywords),
        escapeTSV(ext.clinicalNotes),
        escapeTSV(ext.source),
        escapeTSV(ext.version),
      ];
      lines.push(row.join('\t'));
    }

    fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf-8');

    console.log(`✓ Exported ${extensions.length} records to ${OUTPUT_FILE}`);

    // Show sample data
    console.log('\nSample data (first 3 records):');
    for (let i = 0; i < Math.min(3, extensions.length); i++) {
      const ext = extensions[i];
      console.log(`\n${i + 1}. CUI: ${ext.symptom.cui}`);
      console.log(`   Summary: ${ext.summary}`);
      if (ext.keywords) {
        console.log(`   Keywords: ${ext.keywords}`);
      }
    }

    console.log('\n============================================================');
    console.log('Export complete!');
    console.log('============================================================');
  } catch (error) {
    console.error('Export failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run main function
exportExtensions();
