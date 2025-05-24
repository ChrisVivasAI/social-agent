import fs from 'fs';
import { execSync } from 'child_process';

// Get all files using Vertex AI models
const findCommand = 'findstr /s /m "gemini-2.0" src\\*.ts';
let files = [];

try {
  const output = execSync(findCommand, { encoding: 'utf8' });
  if (output.trim()) {
    files = output.trim().split('\n').filter(Boolean);
    console.log(`Found ${files.length} files with gemini-2.0 references`);
  } else {
    console.log("No files found with gemini-2.0 references");
  }
} catch (error) {
  // findstr returns non-zero exit code when no matches found
  if (error.status !== 1) {
    console.error('Error finding files:', error.message);
  } else {
    console.log("No files found with gemini-2.0 references");
  }
}

// Process each file
for (const file of files) {
  console.log(`Processing ${file}...`);
  
  try {
    // Read file content
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace gemini-2.0-pro with gemini-1.5-pro
    const updatedContent = content
      .replace(/gemini-2\.0-pro/g, 'gemini-1.5-pro')
      .replace(/gemini-2\.0-flash/g, 'gemini-1.5-flash');
    
    // Write the modified content back to the file if changes were made
    if (content !== updatedContent) {
      fs.writeFileSync(file, updatedContent, 'utf8');
      console.log(`Updated ${file}`);
    } else {
      console.log(`No changes needed for ${file}`);
    }
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
}

console.log('Model update complete! Please restart the LangGraph server.'); 