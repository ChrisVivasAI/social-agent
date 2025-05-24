import fs from 'fs';
import { execSync } from 'child_process';

// Get all files still using ChatAnthropic
const findCommand = 'findstr /s /m "new ChatAnthropic" src\\*.ts';
let files = [];

try {
  const output = execSync(findCommand, { encoding: 'utf8' });
  files = output.trim().split('\n').filter(Boolean);
  console.log(`Found ${files.length} files still using ChatAnthropic`);
} catch (error) {
  console.error('Error finding files:', error.message);
  process.exit(1);
}

// Process each file
for (const file of files) {
  console.log(`Processing ${file}...`);
  
  try {
    // Read file content
    let content = fs.readFileSync(file, 'utf8');
    
    // Check if already importing getVertexChatModel
    const hasVertexImport = content.includes('getVertexChatModel');
    
    // Add import if needed
    if (!hasVertexImport) {
      // Determine the relative path to utils/vertex-model.js
      const depth = file.replace(/\\/g, '/').split('/').length - 2;
      const importPath = '../'.repeat(depth) + 'utils/vertex-model.js';
      
      // Replace ChatAnthropic import with getVertexChatModel import
      content = content.replace(
        /import\s+{\s*ChatAnthropic\s*}\s*from\s*["']@langchain\/anthropic["'];?/g,
        `import { getVertexChatModel } from "${importPath}";`
      );
      
      // If it doesn't have the import pattern we expect, add the import
      if (!content.includes('getVertexChatModel')) {
        // Find the first import statement to add our import after it
        const firstImportMatch = content.match(/import .+ from ["'].+["'];?/);
        if (firstImportMatch) {
          const firstImport = firstImportMatch[0];
          content = content.replace(
            firstImport,
            `${firstImport}\nimport { getVertexChatModel } from "${importPath}";`
          );
        }
      }
    }
    
    // Replace ChatAnthropic instances with getVertexChatModel
    content = content.replace(
      /const\s+(\w+)\s*=\s*new\s+ChatAnthropic\(\{\s*model:\s*["']([^"']+)["'],\s*temperature:\s*([0-9.]+)\s*\}\)/g,
      'const $1 = getVertexChatModel("$2", $3)'
    );
    
    // Handle case where withStructuredOutput is chained
    content = content.replace(
      /const\s+(\w+)\s*=\s*new\s+ChatAnthropic\(\{\s*model:\s*["']([^"']+)["'],\s*temperature:\s*([0-9.]+)\s*\}\)\.withStructuredOutput/g,
      'const $1 = getVertexChatModel("$2", $3).withStructuredOutput'
    );
    
    // Write the modified content back to the file
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
}

console.log('Conversion complete! Please restart the LangGraph server.'); 