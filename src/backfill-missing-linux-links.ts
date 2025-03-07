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
 * Save version history to JSON file
 */
function saveVersionHistory(history: VersionHistory): void {
  const historyPath = path.join(process.cwd(), 'version-history.json');
  
  // Create a backup before saving
  if (fs.existsSync(historyPath)) {
    fs.copyFileSync(historyPath, `${historyPath}.backup`);
    console.log(`Created backup at ${historyPath}.backup`);
  }
  
  // Pretty print JSON with 2 spaces
  const jsonData = JSON.stringify(history, null, 2);
  fs.writeFileSync(historyPath, jsonData, 'utf8');
  console.log('Version history saved to version-history.json');
}

/**
 * Generate Linux links based on version patterns
 */
function generateLinuxLinks(version: string, date: string, platforms: Record<string, string>): { x64: string | null, arm64: string | null } {
  // Extract build ID from any existing URL if possible
  let buildId = '';
  let isAppImage = false;
  
  // First, try to extract buildId from darwin URLs
  if (platforms['darwin-universal']) {
    const darwinMatch = platforms['darwin-universal'].match(/\/production\/([^\/]+)\/darwin/);
    if (darwinMatch) {
      buildId = darwinMatch[1];
      isAppImage = true;
    }
  }
  
  // If not found, try to extract from win32 URLs
  if (!buildId && platforms['win32-x64']) {
    const winMatch = platforms['win32-x64'].match(/\/production\/([^\/]+)\/win32/);
    if (winMatch) {
      buildId = winMatch[1];
      isAppImage = true;
    }
  }
  
  // If we found a build ID, generate Linux URLs
  if (buildId && isAppImage) {
    console.log(`Found build ID ${buildId} for version ${version}`);
    const x64Url = `https://anysphere-binaries.s3.us-east-1.amazonaws.com/production/client/linux/x64/appimage/Cursor-${version}-${buildId}.deb.glibc2.25-x86_64.AppImage`;
    const arm64Url = `https://anysphere-binaries.s3.us-east-1.amazonaws.com/production/client/linux/arm64/appimage/Cursor-${version}-${buildId}.deb.glibc2.28-aarch64.AppImage`;
    
    return { x64: x64Url, arm64: arm64Url };
  }
  
  // For newer versions, try the downloader.cursor.sh pattern
  const year = date.split('-')[0];
  const month = date.split('-')[1];
  const day = date.split('-')[2];
  
  // Most URLs follow pattern like: https://downloader.cursor.sh/builds/250219jnihavxsz/linux/appImage/x64
  // But we can't derive the random code without external information
  
  console.log(`Could not generate Linux links for version ${version}`);
  return { x64: null, arm64: null };
}

/**
 * Main function to backfill missing Linux links
 */
async function backfillMissingLinuxLinks(): Promise<void> {
  console.log('Starting backfill for missing Linux links...');
  
  // Read the version history
  const history = readVersionHistory();
  
  if (!history.versions || history.versions.length === 0) {
    console.log('No versions found in history file');
    return;
  }
  
  console.log(`Found ${history.versions.length} versions in history`);
  
  // Process versions missing Linux links
  let versionsToProcess = history.versions
    .filter(entry => 
      (!entry.platforms['linux-x64'] || !entry.platforms['linux-arm64']) && 
      (entry.platforms['darwin-universal'] || entry.platforms['win32-x64'])
    );
  
  console.log(`Will process ${versionsToProcess.length} versions with missing Linux links`);
  
  if (versionsToProcess.length === 0) {
    console.log('No versions need processing, exiting');
    return;
  }
  
  let updatedCount = 0;
  let skippedCount = 0;
  
  // Process each version
  for (const entry of versionsToProcess) {
    const version = entry.version;
    console.log(`Processing version ${version}...`);
    
    // Generate Linux links for this version
    const { x64, arm64 } = generateLinuxLinks(version, entry.date, entry.platforms);
    
    let updated = false;
    
    // Update linux-x64 if missing and generated
    if (!entry.platforms['linux-x64'] && x64) {
      console.log(`Adding linux-x64 link for version ${version}: ${x64}`);
      entry.platforms['linux-x64'] = x64;
      updated = true;
    }
    
    // Update linux-arm64 if missing and generated
    if (!entry.platforms['linux-arm64'] && arm64) {
      console.log(`Adding linux-arm64 link for version ${version}: ${arm64}`);
      entry.platforms['linux-arm64'] = arm64;
      updated = true;
    }
    
    if (updated) {
      updatedCount++;
    } else {
      skippedCount++;
    }
  }
  
  console.log(`Backfill summary: Updated ${updatedCount}, Skipped ${skippedCount}`);
  
  // Save the updated history
  if (updatedCount > 0) {
    console.log('Saving updated history with new Linux links...');
    saveVersionHistory(history);
    console.log('Backfill process completed and saved');
  } else {
    console.log('No updates made, skipping save');
  }
}

// Run the backfill process
backfillMissingLinuxLinks().catch(error => {
  console.error('Error in backfill process:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
}); 