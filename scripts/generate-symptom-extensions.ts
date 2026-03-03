#!/usr/bin/env npx ts-node
/**
 * Generate symptom extensions using Qwen AI model
 *
 * This script queries symptoms that don't have extensions yet,
 * calls Qwen (通义千问) to generate descriptions and summaries,
 * and inserts them into the symptom_extensions table.
 *
 * Usage:
 *   npx ts-node scripts/generate-symptom-extensions.ts [--limit=100] [--delay=1.0]
 *   # or
 *   pnpm run generate:extensions -- --limit=100
 */

import { prisma } from '../lib/db';
import { llmService } from '../lib/bailian/llm';

// System prompt for symptom description generation
const SYSTEM_PROMPT = `你是一位资深的医学专家。请根据提供的症状信息，生成专业、准确的医学描述。

请按照以下要求生成内容：
1. full_description: 完整的医学描述，包括症状的定义、常见原因、临床表现、可能相关的疾病等，适合临床参考
2. summary: 简洁的概要，用一句话概括该症状，适合快速检索和展示
3. keywords: 关键词，包括症状相关的医学术语、解剖部位、症状特征等，用分号分隔，不超过5个
4. clinical_notes: 临床注意事项，包括诊断要点、鉴别诊断、建议检查等

请严格按照以下 JSON 格式返回，不要包含任何其他内容：
{
    "full_description": "完整的医学描述...",
    "summary": "简洁的概要",
    "keywords": "关键词1;关键词2;关键词3;关键词4;关键词5",
    "clinical_notes": "临床注意事项..."
}`;

interface ExtensionData {
  full_description: string;
  summary: string;
  keywords: string;
  clinical_notes: string;
}

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
    delay: 1.0,
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
 * Build prompt for symptom description generation
 */
function buildPrompt(symptom: { name: string; alias?: string | null; definition?: string | null }): string {
  let prompt = `请为以下症状生成医学描述和概要：

症状名称：${symptom.name}`;

  if (symptom.alias) {
    prompt += `\n别名：${symptom.alias}`;
  }

  if (symptom.definition) {
    prompt += `\n定义：${symptom.definition}`;
  }

  prompt += `

请生成：
1. full_description: 完整的医学描述（200-500字）
2. summary: 简洁概要（10-30字）
3. keywords: 关键词（用分号分隔，3-5个）
4. clinical_notes: 临床注意事项（50-150字）

请严格按 JSON 格式返回，不要包含任何其他文字。`;

  return prompt;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate extension for a single symptom with retry logic
 */
async function generateExtensionForSymptom(
  symptom: { id: number; cui: string; name: string; alias: string | null; definition: string | null },
  retryCount: number = 3
): Promise<ExtensionData | null> {
  const symptomData = {
    name: symptom.name,
    alias: symptom.alias,
    definition: symptom.definition,
  };

  const prompt = buildPrompt(symptomData);

  for (let attempt = 0; attempt < retryCount; attempt++) {
    try {
      const result = await llmService.generateJSON<ExtensionData>(prompt, SYSTEM_PROMPT);

      // Validate result has required fields
      const requiredFields: (keyof ExtensionData)[] = [
        'full_description',
        'summary',
        'keywords',
        'clinical_notes',
      ];
      if (requiredFields.every((field) => result[field])) {
        return result;
      } else {
        console.log(
          `  ⚠ Warning: Missing fields in response for ${symptom.cui}, attempt ${attempt + 1}`
        );
        if (attempt < retryCount - 1) {
          await sleep(2000);
          continue;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(
        `  ✗ Error generating for ${symptom.cui}: ${errorMessage}, attempt ${attempt + 1}`
      );
      if (attempt < retryCount - 1) {
        await sleep(5000);
        continue;
      } else {
        return null;
      }
    }
  }

  return null;
}

/**
 * Generate extensions for a batch of symptoms
 */
async function generateExtensionsBatch(options: ScriptOptions): Promise<void> {
  console.log('============================================================');
  console.log('Symptom Extension Generator using Qwen AI');
  console.log('============================================================');

  // Count total symptoms without extensions
  const totalCount = await prisma.symptom.count({
    where: {
      NOT: {
        extensions: {
          some: {
            source: 'AI',
          },
        },
      },
    },
  });

  console.log(`\nFound ${totalCount} symptoms without AI extensions`);

  if (totalCount === 0) {
    console.log('All symptoms already have AI extensions!');
    return;
  }

  // Get symptoms to process
  const limit = Math.min(options.limit, totalCount);
  console.log(`Processing ${limit} symptoms...\n`);

  const symptoms = await prisma.symptom.findMany({
    where: {
      NOT: {
        extensions: {
          some: {
            source: 'AI',
          },
        },
      },
    },
    orderBy: {
      id: 'asc',
    },
    take: limit,
  });

  let successCount = 0;
  let failedCount = 0;

  for (let idx = 0; idx < symptoms.length; idx++) {
    const symptom = symptoms[idx];
    console.log(`[${idx + 1}/${limit}] Processing: ${symptom.cui} - ${symptom.name}`);

    // Generate extension
    const extensionData = await generateExtensionForSymptom(symptom);

    if (extensionData) {
      try {
        // Insert into database
        await prisma.symptomExtension.create({
          data: {
            symptomId: symptom.id,
            fullDescription: extensionData.full_description,
            summary: extensionData.summary,
            keywords: extensionData.keywords,
            clinicalNotes: extensionData.clinical_notes,
            source: 'AI',
            version: '1.0',
          },
        });

        successCount++;
        console.log(`  ✓ Generated and saved`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`  ✗ Failed to save: ${errorMessage}`);
        failedCount++;
      }
    } else {
      console.log(`  ✗ Failed to generate`);
      failedCount++;
    }

    // Small delay between requests to avoid rate limiting
    if (idx < symptoms.length - 1) {
      await sleep(options.delay * 1000);
    }
  }

  console.log('\n============================================================');
  console.log('Generation Summary:');
  console.log(`  Success: ${successCount}`);
  console.log(`  Failed: ${failedCount}`);
  console.log(`  Remaining: ${totalCount - limit}`);
  console.log('============================================================');
}

/**
 * Main function
 */
async function main(): Promise<void> {
  // Check if BAILIAN_API_KEY is set
  if (!process.env.BAILIAN_API_KEY) {
    console.error('Error: BAILIAN_API_KEY environment variable is not set');
    console.error('Please set it in your .env file or export it');
    process.exit(1);
  }

  const options = parseArgs();

  try {
    await generateExtensionsBatch(options);
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
