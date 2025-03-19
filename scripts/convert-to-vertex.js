// This script helps convert Anthropic model usage to Google Vertex AI
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

// Define your search and replace patterns
const replacements = [
  {
    search: /import\s+{\s*ChatAnthropic\s*}\s*from\s*["']@langchain\/anthropic["'];?/g,
    replace: `import { getVertexChatModel } from "../../../utils/vertex-model.js";`
  },
  {
    search: /const\s+(\w+)\s*=\s*new\s+ChatAnthropic\(\{\s*model:\s*["']([^"']+)["'],\s*temperature:\s*([0-9.]+)\s*\}\);/g,
    replace: (match, varName, model, temp) => `const ${varName} = getVertexChatModel("${model}", ${temp});`
  }
];

// Windows-compatible command for finding files
const findCommand = process.platform === 'win32' 
  ? 'findstr /s /m "ChatAnthropic" src\\*.ts' 
  : 'grep -l "ChatAnthropic" --include="*.ts" -r src/';

// Find TypeScript files containing Anthropic imports
exec(findCommand, (error, stdout, stderr) => {
  if (error && error.code !== 1) { // findstr returns 1 if it found matches
    console.error(`Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`Stderr: ${stderr}`);
    return;
  }

  const files = stdout.trim().split('\n').filter(Boolean);
  console.log(`Found ${files.length} files with Anthropic imports:`);
  
  files.forEach(file => {
    // Clean up file path if needed (Windows might add extra info)
    const cleanFile = file.trim();
    console.log(`Processing ${cleanFile}...`);
    
    let content = fs.readFileSync(cleanFile, 'utf8');
    let modified = false;
    
    // Apply each replacement pattern
    replacements.forEach(({ search, replace }) => {
      const newContent = content.replace(search, replace);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });
    
    // If file was modified, write it back
    if (modified) {
      // Adjust the import path based on file depth
      const fileParts = cleanFile.replace(/\\/g, '/').split('/');
      const depth = fileParts.length - 2; // Adjust based on src/ structure
      const importPath = '../'.repeat(depth) + 'utils/vertex-model.js';
      
      // Fix the import path
      content = content.replace(/..\/..\/..\/utils\/vertex-model.js/g, importPath);
      
      fs.writeFileSync(cleanFile, content, 'utf8');
      console.log(`Updated ${cleanFile}`);
    } else {
      console.log(`No changes needed for ${cleanFile}`);
    }
  });
  
  console.log('Conversion complete!');
}); 