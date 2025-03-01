import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define types for Bun's fetch if needed
declare global {
  interface Response {
    ok: boolean;
    status: number;
    json(): Promise<any>;
  }
}

interface PlatformInfo {
  platforms: string[];
  readableNames: string[];
  section: string;
}

interface PlatformMap {
  [key: string]: PlatformInfo;
}

interface VersionInfo {
  url: string;
  version: string;
}

interface ResultMap {
  [os: string]: {
    [platform: string]: VersionInfo;
  };
}

interface DownloadResponse {
  downloadUrl: string;
}

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

const PLATFORMS: PlatformMap = {
  windows: {
    platforms: ['win32-x64', 'win32-arm64'],
    readableNames: ['win32-x64', 'win32-arm64'],
    section: 'Windows Installer'
  },
  mac: {
    platforms: ['darwin-universal', 'darwin-x64', 'darwin-arm64'],
    readableNames: ['darwin-universal', 'darwin-x64', 'darwin-arm64'],
    section: 'Mac Installer'
  },
  linux: {
    platforms: ['linux-x64'],
    readableNames: ['linux-x64'],
    section: 'Linux Installer'
  }
};

/**
 * Extract version from URL or filename
 */
function extractVersion(url: string): string {
  // For Windows
  const winMatch = url.match(/CursorUserSetup-[^-]+-([0-9.]+)\.exe/);
  if (winMatch && winMatch[1]) return winMatch[1];
  
  // For other URLs, try to find version pattern
  const versionMatch = url.match(/[0-9]+\.[0-9]+\.[0-9]+/);
  return versionMatch ? versionMatch[0] : 'Unknown';
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Fetch latest download URL for a platform
 */
async function fetchLatestDownloadUrl(platform: string): Promise<string | null> {
  try {
    const response = await fetch(`https://www.cursor.com/api/download?platform=${platform}&releaseTrack=latest`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json() as DownloadResponse;
    return data.downloadUrl;
  } catch (error) {
    console.error(`Error fetching download URL for platform ${platform}:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
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
  try {
    const jsonData = JSON.stringify(history, null, 2);
    fs.writeFileSync(historyPath, jsonData, 'utf8');
    console.log('Version history saved to version-history.json');
  } catch (error) {
    console.error('Error saving version history:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Update the README.md file with latest Cursor links
 */
async function updateReadme(): Promise<void> {
  const readmePath = path.join(process.cwd(), 'README.md');
  let readmeContent = fs.readFileSync(readmePath, 'utf8');
  
  // Collect all URLs and versions
  const results: ResultMap = {};
  let latestVersion = '0.0.0';
  const currentDate = formatDate(new Date());
  
  // Fetch all platform download URLs
  for (const [osKey, osData] of Object.entries(PLATFORMS)) {
    results[osKey] = {};
    
    for (let i = 0; i < osData.platforms.length; i++) {
      const platform = osData.platforms[i];
      const url = await fetchLatestDownloadUrl(platform);
      
      if (url) {
        const version = extractVersion(url);
        results[osKey][platform] = { url, version };
        
        // Track the highest version number
        if (version !== 'Unknown' && version > latestVersion) {
          latestVersion = version;
        }
      }
    }
  }
  
  // Update the date in the Cursor AI IDE section
  const ideUpdateRegex = /(Official Download Link for The latest version from `\[Cursor AI IDE\]'s \[Check for Updates\.\.\.\]` \(on `)([^`]+)(`\) is:)/;
  readmeContent = readmeContent.replace(ideUpdateRegex, `$1${currentDate}$3`);
  
  // Also update the date in the website section
  const websiteUpdateRegex = /(Official Download Link for The latest version from \[Cursor AI's Website\]\(https:\/\/www\.cursor\.com\/downloads\) \(on `)([^`]+)(`\) is:)/;
  readmeContent = readmeContent.replace(websiteUpdateRegex, `$1${currentDate}$3`);
  
  // We're no longer updating the version numbers in the "Latest Version" section
  // as requested - only updating the dates and version history table
  
  // Check if the latest version already exists in the table
  const versionRowRegex = new RegExp(`\\| ${latestVersion} \\|`);
  if (!versionRowRegex.test(readmeContent)) {
    // Add new row to the table for the latest version
    const tableStartRegex = /\| Version \| Date \| Mac Installer \| Windows Installer \| Linux Installer \|\n\| --- \| --- \| --- \| --- \| --- \|/;
    
    // Generate Mac links section
    let macLinks = '';
    if (results.mac) {
      const macPlatforms = ['darwin-universal', 'darwin-x64', 'darwin-arm64'];
      const macUrls = macPlatforms.map(platform => {
        if (results.mac[platform] && results.mac[platform].url) {
          return `[${platform}](${results.mac[platform].url})`;
        }
        return null;
      }).filter(Boolean);
      
      macLinks = macUrls.join(' <br>');
    }
    
    // Generate Windows links section
    let windowsLinks = '';
    if (results.windows) {
      const winPlatforms = ['win32-x64', 'win32-arm64'];
      const winUrls = winPlatforms.map(platform => {
        if (results.windows[platform] && results.windows[platform].url) {
          return `[${platform}](${results.windows[platform].url})`;
        }
        return null;
      }).filter(Boolean);
      
      windowsLinks = winUrls.join('<br>');
    }
    
    // Generate Linux link
    let linuxLinks = 'Not Ready';
    if (results.linux && results.linux['linux-x64'] && results.linux['linux-x64'].url) {
      linuxLinks = `[linux-x64](${results.linux['linux-x64'].url})`;
    }
    
    // New table row
    const newRow = `\n| ${latestVersion} | ${currentDate} | ${macLinks} | ${windowsLinks} | ${linuxLinks} |`;
    
    // Insert the new row after the table header
    readmeContent = readmeContent.replace(tableStartRegex, `$&${newRow}`);
    
    // Update version history JSON
    updateVersionHistory(latestVersion, currentDate, results);
  }
  
  // Save the updated README
  fs.writeFileSync(readmePath, readmeContent);
  console.log(`README.md updated with Cursor version ${latestVersion}`);
}

/**
 * Update version history JSON with new version information
 */
function updateVersionHistory(version: string, date: string, results: ResultMap): void {
  // Read existing version history
  const history = readVersionHistory();
  
  // Check if this version already exists
  const existingVersionIndex = history.versions.findIndex(entry => entry.version === version);
  if (existingVersionIndex !== -1) {
    console.log(`Version ${version} already exists in version-history.json, skipping.`);
    return;
  }
  
  // Prepare new entry
  const platforms: { [platform: string]: string } = {};
  
  // Add Mac platforms
  if (results.mac) {
    for (const [platform, info] of Object.entries(results.mac)) {
      platforms[platform] = info.url;
    }
  }
  
  // Add Windows platforms
  if (results.windows) {
    for (const [platform, info] of Object.entries(results.windows)) {
      platforms[platform] = info.url;
    }
  }
  
  // Add Linux platforms
  if (results.linux) {
    for (const [platform, info] of Object.entries(results.linux)) {
      platforms[platform] = info.url;
    }
  }
  
  // Create the new entry
  const newEntry: VersionHistoryEntry = {
    version,
    date,
    platforms
  };
  
  // Add to history and sort by version (newest first)
  history.versions.push(newEntry);
  history.versions.sort((a, b) => {
    return b.version.localeCompare(a.version, undefined, { numeric: true });
  });
  
  // Save updated history
  saveVersionHistory(history);
  console.log(`Added version ${version} to version-history.json`);
}

// Run the update
updateReadme().catch(error => {
  console.error('Error updating README:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
}); 