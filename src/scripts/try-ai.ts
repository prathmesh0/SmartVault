import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { aiService } from '../modules/ai/ai.service.js';
import { extractorService } from '../modules/extractor/extractor.service.js';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error(
      'Usage: npm run try:ai -- "C:\\Users\\Prathmesh.Parab\\Downloads\\one_page_extraction_sample.pdf"',
    );
    process.exit(1);
  }

  const buffer = await readFile(filePath);
  const ext = extname(filePath).toLowerCase();
  const mimeType = ext === '.pdf' ? 'application/pdf' : 'text/plain';

  console.log(`\n📄 Extracting text from ${filePath} (${mimeType})...`);
  const { text, length } = await extractorService.extract(buffer, mimeType);
  console.log(`✅ Extracted ${length} characters. Preview:\n---\n${text.slice(0, 300)}...\n---\n`);

  console.log('🤖 Calling Groq for analysis...');
  const result = await aiService.analyzeDocument(text);
  console.log('✅ AI result:\n', JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('\n❌ Failed:', err);
  process.exit(1);
});
