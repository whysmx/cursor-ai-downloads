import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    const response = await axios.get(`https://www.cursor.com/api/download?platform=${platform}&releaseTrack=latest`);
    return response.data.downloadUrl;
  } catch (error) {
    console.error(`Error fetching download URL for platform ${platform}:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
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
  }
  
  // Save the updated README
  fs.writeFileSync(readmePath, readmeContent);
  console.log(`README.md updated with Cursor version ${latestVersion}`);
}

// Run the update
updateReadme().catch(error => {
  console.error('Error updating README:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
}); 