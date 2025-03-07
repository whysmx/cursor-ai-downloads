import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Interface for version history JSON
interface VersionHistoryEntry {
  version: string;
  date: string;
  platforms: {
    [platform: string]: string; // platform -> download URL
  };
}

interface VersionHistory {
  versions: VersionHistoryEntry[];
}

/**
 * Read version history from JSON file
 */
function readVersionHistory(): VersionHistory {
  const historyPath = path.join(process.cwd(), 'version-history.json');
  if (fs.existsSync(historyPath)) {
    try {
      const jsonData = fs.readFileSync(historyPath, 'utf8');
      return JSON.parse(jsonData) as VersionHistory;
    } catch (error) {
      console.error('Error reading version history:', error instanceof Error ? error.message : 'Unknown error');
      return { versions: [] };
    }
  } else {
    console.log('version-history.json not found');
    return { versions: [] };
  }
}

/**
 * Update README.md file with linux-arm64 links from version history
 */
function updateReadmeFromHistory(): void {
  console.log('Starting README update process...');
  
  // Read version history
  const history = readVersionHistory();
  
  if (!history.versions || history.versions.length === 0) {
    console.log('No versions found in history file');
    return;
  }
  
  // Read README.md
  const readmePath = path.join(process.cwd(), 'README.md');
  if (!fs.existsSync(readmePath)) {
    console.error('README.md file not found');
    return;
  }
  
  let readmeContent = fs.readFileSync(readmePath, 'utf8');
  
  // Create a backup
  fs.writeFileSync(`${readmePath}.backup`, readmeContent, 'utf8');
  console.log(`Created backup at ${readmePath}.backup`);
  
  let updatedCount = 0;
  
  // Process each version in history
  for (const entry of history.versions) {
    const version = entry.version;
    
    // Skip if no linux-arm64 URL
    if (!entry.platforms['linux-arm64']) {
      console.log(`Version ${version} has no linux-arm64 URL, skipping`);
      continue;
    }
    
    // Check if this version has only linux-x64 in README
    const linuxX64Only = new RegExp(
      `\\| ${version} \\| [\\d-]+ \\| .*? \\| .*? \\| \\[linux-x64\\]\\([^)]+\\) \\|`
    );
    
    // Check if this version already has linux-arm64 in README
    const linuxArm64Present = new RegExp(
      `\\| ${version} \\| [\\d-]+ \\| .*? \\| .*? \\| .*?\\[linux-arm64\\]\\([^)]+\\).*? \\|`
    );
    
    if (linuxArm64Present.test(readmeContent)) {
      console.log(`Version ${version} already has linux-arm64 in README, skipping`);
      continue;
    }
    
    if (linuxX64Only.test(readmeContent)) {
      // Replace the linux-x64 line with both linux-x64 and linux-arm64
      const oldLinuxSection = `[linux-x64](${entry.platforms['linux-x64']}) |`;
      const newLinuxSection = `[linux-x64](${entry.platforms['linux-x64']})<br>[linux-arm64](${entry.platforms['linux-arm64']}) |`;
      
      // Use string replacement to update the line for this version
      readmeContent = readmeContent.replace(
        new RegExp(`(\\| ${version} \\| [\\d-]+ \\| .*? \\| .*? \\| )\\[linux-x64\\]\\([^)]+\\) \\|`),
        `$1${newLinuxSection}`
      );
      
      console.log(`Updated README for version ${version} with linux-arm64 URL`);
      updatedCount++;
    } else {
      console.log(`Version ${version} doesn't match expected pattern in README, skipping`);
    }
  }
  
  console.log(`README update summary: Updated ${updatedCount} versions`);
  
  // Save the updated README
  if (updatedCount > 0) {
    fs.writeFileSync(readmePath, readmeContent, 'utf8');
    console.log('README.md updated successfully');
  } else {
    console.log('No updates made to README.md');
  }
}

// Run the update process
updateReadmeFromHistory();
console.log('Process completed'); 