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

interface DownloadResponse {
  downloadUrl: string;
}

/**
 * Fetch specific version download URL for a platform
 */
async function fetchVersionDownloadUrl(platform: string, version: string): Promise<string | null> {
  try {
    console.log(`Fetching ${platform} URL for version ${version}...`);
    const response = await fetch(`https://www.cursor.com/api/download?platform=${platform}&releaseTrack=${version}`, {
      headers: {
        'User-Agent': 'Cursor-Version-Checker',
        'Cache-Control': 'no-cache',
      },
      timeout: 10000,
    });
    
    if (!response.ok) {
      console.warn(`HTTP error fetching ${platform} for ${version}: ${response.status}`);
      return null;
    }
    
    const data = await response.json() as DownloadResponse;
    return data.downloadUrl;
  } catch (error) {
    console.error(`Error fetching ${platform} URL for version ${version}:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Try to generate linux-arm64 URL from linux-x64 URL using pattern matching
 */
function generateArm64UrlFromX64(x64Url: string): string | null {
  // Pattern 1: Recent builds with glibc in the URL
  const glibcPattern = /\/linux\/x64\/appimage\/Cursor-([^-]+)-([^.]+)\.deb\.glibc([^-]+)-x86_64\.AppImage/;
  const glibcMatch = x64Url.match(glibcPattern);
  
  if (glibcMatch) {
    // For these URLs, we just need to change x64 to arm64 and x86_64 to aarch64
    // The glibc version might be different (2.25 for x64, 2.28 for arm64)
    return x64Url
      .replace('/linux/x64/', '/linux/arm64/')
      .replace('x86_64', 'aarch64')
      .replace('glibc2.25', 'glibc2.28');
  }
  
  // Pattern 2: Downloader.cursor.sh URLs (newer format)
  const downloaderPattern = /(https:\/\/downloader\.cursor\.sh\/builds\/[^\/]+)\/linux\/appImage\/x64/;
  const downloaderMatch = x64Url.match(downloaderPattern);
  
  if (downloaderMatch) {
    // For these URLs, we just need to change the end part
    return `${downloaderMatch[1]}/linux/appImage/arm64`;
  }
  
  // No pattern matched
  return null;
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
 * Main function to backfill linux-arm64 URLs
 */
async function backfillLinuxARM64(): Promise<void> {
  console.log('Starting linux-arm64 backfill process...');
  
  // Read the version history
  const history = readVersionHistory();
  
  if (!history.versions || history.versions.length === 0) {
    console.log('No versions found in history file');
    return;
  }
  
  console.log(`Found ${history.versions.length} versions in history`);
  
  // Process all versions that need updating (have linux-x64 but not linux-arm64)
  let versionsToProcess = history.versions
    .filter(entry => !entry.platforms['linux-arm64'] && entry.platforms['linux-x64']);
  
  console.log(`Will process ${versionsToProcess.length} versions in this run`);
  
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  // Process each version
  for (let i = 0; i < history.versions.length; i++) {
    const entry = history.versions[i];
    const version = entry.version;
    
    // Skip if linux-arm64 already exists
    if (entry.platforms['linux-arm64']) {
      //console.log(`Version ${version} already has linux-arm64 URL, skipping`);
      skippedCount++;
      continue;
    }
    
    // Skip if no linux-x64 URL
    if (!entry.platforms['linux-x64']) {
      //console.log(`Version ${version} has no linux-x64 URL, skipping`);
      skippedCount++;
      continue;
    }
    
    // Skip if not in our list to process
    if (!versionsToProcess.some(v => v.version === version)) {
      console.log(`Version ${version} not in process list, skipping`);
      continue;
    }
    
    const x64Url = entry.platforms['linux-x64'];
    console.log(`Processing version ${version} with linux-x64 URL: ${x64Url}`);
    
    // Try different methods to get linux-arm64 URL
    
    // Method 1: Try to fetch from API
    let arm64Url = await fetchVersionDownloadUrl('linux-arm64', version);
    
    // Method 2: If API fetch failed, try pattern matching
    if (!arm64Url) {
      console.log(`Falling back to pattern matching for version ${version}`);
      arm64Url = generateArm64UrlFromX64(x64Url);
    }
    
    // Update the entry if we found a URL
    if (arm64Url) {
      console.log(`Found linux-arm64 URL for version ${version}: ${arm64Url}`);
      entry.platforms['linux-arm64'] = arm64Url;
      updatedCount++;
      
      // Save after each successful update to avoid losing progress
      if (updatedCount % 10 === 0) {
        console.log(`Saving intermediate progress after ${updatedCount} updates...`);
        saveVersionHistory(history);
      }
    } else {
      console.error(`Could not determine linux-arm64 URL for version ${version}`);
      errorCount++;
    }
    
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`Backfill summary: Updated ${updatedCount}, Skipped ${skippedCount}, Errors ${errorCount}`);
  
  // Save the updated history
  if (updatedCount > 0) {
    console.log('Saving updated history with new linux-arm64 URLs...');
    console.log(`Example updated entry: ${JSON.stringify(history.versions[0], null, 2)}`);
    saveVersionHistory(history);
    console.log('Backfill process completed and saved');
  } else {
    console.log('No updates made, skipping save');
  }
}

// Run the backfill process
backfillLinuxARM64().catch(error => {
  console.error('Error in backfill process:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
}); 