#!/usr/bin/env npx ts-node
/**
 * Index symptom extensions to Qdrant vector database
 *
 * This script reads data from symptom_extensions table, generates embeddings,
 * and stores them in Qdrant for vector search.
 *
 * Usage:
 *   npx ts-node scripts/index-symptoms-to-qdrant.ts [--limit=100] [--delay=0.1]
 *   # or
 *   pnpm run index:qdrant -- --limit=100
 */

import { prisma } from '../lib/db';
import { vectorService } from '../lib/qdrant';
import { config } from '../lib/config';
import { QdrantClient } from '@qdrant/js-client-rest';

interface ScriptOptions {
  limit: number;
  delay: number;
}

/**
 * Parse command line arguments
 */
function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {
    limit: 100,
    delay: 0.1,
  };

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--delay=')) {
      options.delay = parseFloat(arg.split('=')[1]);
    }
  }

  return options;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if a point with given CUI already exists in Qdrant
 */
async function checkPointExistsByCUI(client: QdrantClient, cui: string): Promise<boolean> {
  try {
    const results = await client.scroll(config.qdrant.collection, {
      filter: {
        must: [
          {
            key: 'cui',
            match: { value: cui },
          },
        ],
      },
      limit: 1,
    });
    return results.points.length > 0;
  } catch {
    // Collection doesn't exist or other error
    return false;
  }
}

/**
 * Index symptom extensions to Qdrant
 */
async function indexExtensionsToQdrant(options: ScriptOptions): Promise<void> {
  console.log('============================================================');
  console.log('Index Symptom Extensions to Qdrant');
  console.log('============================================================');

  // Get Qdrant client
  const qdrantClient = new QdrantClient({
    url: config.qdrant.url,
    apiKey: config.qdrant.apiKey,
  });

  // Ensure collection exists
  await vectorService.ensureCollection();

  // Count total extensions
  const totalCount = await prisma.symptomExtension.count();

  console.log(`\nTotal symptom extensions: ${totalCount}`);

  if (totalCount === 0) {
    console.log('No data found in symptom_extensions table');
    console.log('\nPlease run generate-symptom-extensions.ts first');
    return;
  }

  const limit = Math.min(options.limit, totalCount);
  console.log(`Processing ${limit} records...\n`);

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
      id: 'asc',
    },
    take: limit,
  });

  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (let idx = 0; idx < extensions.length; idx++) {
    const ext = extensions[idx];
    const { cui } = ext.symptom;

    // Use fullDescription for embedding (more comprehensive), fallback to summary
    const textToEmbed = ext.fullDescription || ext.summary;

    if (!textToEmbed) {
      console.log(`[${idx + 1}/${limit}] Skipping ${cui}: No text to embed`);
      skippedCount++;
      continue;
    }

    console.log(`[${idx + 1}/${limit}] Processing: ${cui}`);

    // Check if already exists in Qdrant
    const exists = await checkPointExistsByCUI(qdrantClient, cui);
    if (exists) {
      console.log(`  ⊘ Already exists in Qdrant, skipping`);
      skippedCount++;
      continue;
    }

    // Store in Qdrant
    try {
      await vectorService.store(cui, textToEmbed, {
        cui,
        summary: ext.summary,
        full_description: ext.fullDescription,
      });

      successCount++;
      console.log(`  ✓ Indexed: ${cui}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`  ✗ Failed to index: ${errorMessage}`);
      failedCount++;
    }

    // Small delay between requests
    if (idx < extensions.length - 1) {
      await sleep(options.delay * 1000);
    }
  }

  console.log('\n============================================================');
  console.log('Indexing Summary:');
  console.log(`  Success: ${successCount}`);
  console.log(`  Skipped: ${skippedCount}`);
  console.log(`  Failed: ${failedCount}`);
  console.log(`  Remaining: ${totalCount - limit}`);
  console.log('============================================================');
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const options = parseArgs();

  try {
    await indexExtensionsToQdrant(options);
  } catch (error) {
    console.error(
      '\nScript failed:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run main function
main();
