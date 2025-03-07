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
    console.log('version-history.json not found, creating a new file');
    return { versions: [] };
  }
}

/**
 * Update README.md with Linux links from version-history.json
 */
async function updateReadmeWithLinuxLinks(): Promise<void> {
  console.log('Starting README.md update with Linux links...');
  
  // Read version history
  const history = readVersionHistory();
  
  // Read README.md content
  const readmePath = path.join(process.cwd(), 'README.md');
  if (!fs.existsSync(readmePath)) {
    console.error('README.md file not found');
    return;
  }
  
  // Create a backup of the README.md file
  const backupPath = path.join(process.cwd(), 'README.md.linux-update-backup');
  fs.copyFileSync(readmePath, backupPath);
  console.log(`Created backup of README.md at ${backupPath}`);
  
  let readmeContent = fs.readFileSync(readmePath, 'utf8');
  
  // First, fix duplicate entries for 0.46.10
  const duplicatePattern = /\| 0\.46\.10 \| 2025-03-06 \|.*?\| .*?linux-x64.*?\) \|\n/s;
  readmeContent = readmeContent.replace(duplicatePattern, '');
  
  // Update 'Not Ready' entries
  // The pattern looks for lines like:
  // | 0.46.8 | 2025-03-01 | [darwin-universal](...)... | [win32-x64](...)... | Not Ready |
  const notReadyPattern = /\| ([\d\.]+) \| ([\d-]+) \| (.*?) \| (.*?) \| Not Ready \|/g;
  
  readmeContent = readmeContent.replace(notReadyPattern, (match, version, date, macLinks, winLinks) => {
    // Find this version in the history
    const versionEntry = history.versions.find(entry => entry.version === version);
    
    if (versionEntry && versionEntry.platforms['linux-x64'] && versionEntry.platforms['linux-arm64']) {
      // Create Linux links section
      const linuxLinks = `[linux-x64](${versionEntry.platforms['linux-x64']})<br>[linux-arm64](${versionEntry.platforms['linux-arm64']})`;
      
      console.log(`Updating Linux links for version ${version}`);
      return `| ${version} | ${date} | ${macLinks} | ${winLinks} | ${linuxLinks} |`;
    }
    
    // No Linux links found, keep the line as is
    console.log(`No Linux links found for version ${version}, keeping "Not Ready"`);
    return match;
  });
  
  // Write updated content back to README.md
  fs.writeFileSync(readmePath, readmeContent);
  console.log('README.md has been updated with Linux links');
}

// Run the update process
updateReadmeWithLinuxLinks().catch(error => {
  console.error('Error updating README.md:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
}); 