// WebTime Background Service Worker
// All data stored locally using chrome.storage.local - no external servers

let activeTabId = null;
let activeTabUrl = null;
let startTime = null;
let isIdle = false;

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('WebTime installed - tracking time privately');
  initializeStorage();
});

// Initialize storage structure
async function initializeStorage() {
  const data = await chrome.storage.local.get(['webtime_data']);
  if (!data.webtime_data) {
    await chrome.storage.local.set({
      webtime_data: {
        sites: {},
        dailyStats: {},
        lastUpdated: Date.now()
      }
    });
  }
}

// Get domain from URL
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    // Skip non-http(s) URLs for privacy (chrome://, file://, etc.)
    if (!urlObj.protocol.startsWith('http')) {
      return null;
    }
    return urlObj.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

// List of domains to never track (sensitive/private)
const BLOCKED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  'chrome.google.com' // Chrome Web Store
];

// Check if domain should be tracked
function shouldTrackDomain(domain) {
  if (!domain) return false;
  if (BLOCKED_DOMAINS.includes(domain)) return false;
  if (domain.endsWith('.local')) return false;
  return true;
}

// Get today's date key
function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

// Get favicon URL using Chrome's local favicon cache (no external requests)
function getFaviconUrl(domain) {
  // Use chrome-extension:// favicon API - fully local, no network requests
  return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=https://${encodeURIComponent(domain)}&size=32`;
}

// Save time for the current active tab
async function saveTimeForActiveTab() {
  if (!activeTabUrl || !startTime || isIdle) return;
  
  const domain = getDomain(activeTabUrl);
  if (!shouldTrackDomain(domain)) return;
  
  const timeSpent = Date.now() - startTime;
  if (timeSpent < 1000) return; // Ignore less than 1 second
  
  const todayKey = getTodayKey();
  
  try {
    const data = await chrome.storage.local.get(['webtime_data']);
    const webTimeData = data.webtime_data || { sites: {}, dailyStats: {} };
    
    // Initialize site if not exists
    if (!webTimeData.sites[domain]) {
      webTimeData.sites[domain] = {
        totalTime: 0,
        visits: 0,
        favicon: getFaviconUrl(domain),
        firstVisit: Date.now()
      };
    }
    
    // Initialize daily stats if not exists
    if (!webTimeData.dailyStats[todayKey]) {
      webTimeData.dailyStats[todayKey] = {};
    }
    
    if (!webTimeData.dailyStats[todayKey][domain]) {
      webTimeData.dailyStats[todayKey][domain] = {
        time: 0,
        visits: 0
      };
    }
    
    // Update total time
    webTimeData.sites[domain].totalTime += timeSpent;
    webTimeData.dailyStats[todayKey][domain].time += timeSpent;
    webTimeData.lastUpdated = Date.now();
    
    await chrome.storage.local.set({ webtime_data: webTimeData });
  } catch (error) {
    console.error('Error saving time:', error);
  }
  
  startTime = Date.now();
}

// Record visit for a domain
async function recordVisit(domain) {
  if (!shouldTrackDomain(domain)) return;
  
  const todayKey = getTodayKey();
  
  try {
    const data = await chrome.storage.local.get(['webtime_data']);
    const webTimeData = data.webtime_data || { sites: {}, dailyStats: {} };
    
    // Initialize site if not exists
    if (!webTimeData.sites[domain]) {
      webTimeData.sites[domain] = {
        totalTime: 0,
        visits: 0,
        favicon: getFaviconUrl(domain),
        firstVisit: Date.now()
      };
    }
    
    // Initialize daily stats if not exists
    if (!webTimeData.dailyStats[todayKey]) {
      webTimeData.dailyStats[todayKey] = {};
    }
    
    if (!webTimeData.dailyStats[todayKey][domain]) {
      webTimeData.dailyStats[todayKey][domain] = {
        time: 0,
        visits: 0
      };
    }
    
    // Increment visits
    webTimeData.sites[domain].visits++;
    webTimeData.dailyStats[todayKey][domain].visits++;
    webTimeData.lastUpdated = Date.now();
    
    await chrome.storage.local.set({ webtime_data: webTimeData });
  } catch (error) {
    console.error('Error recording visit:', error);
  }
}

// Handle tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await saveTimeForActiveTab();
  
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      activeTabId = activeInfo.tabId;
      activeTabUrl = tab.url;
      startTime = Date.now();
      
      const domain = getDomain(tab.url);
      await recordVisit(domain);
    }
  } catch (error) {
    console.error('Error on tab activation:', error);
  }
});

// Handle tab URL updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.url) {
    await saveTimeForActiveTab();
    
    activeTabUrl = changeInfo.url;
    startTime = Date.now();
    
    const domain = getDomain(changeInfo.url);
    await recordVisit(domain);
  }
});

// Handle window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await saveTimeForActiveTab();
    isIdle = true;
  } else {
    isIdle = false;
    startTime = Date.now();
  }
});

// Handle idle state
chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === 'idle' || state === 'locked') {
    await saveTimeForActiveTab();
    isIdle = true;
  } else if (state === 'active') {
    isIdle = false;
    startTime = Date.now();
  }
});

// Set idle detection interval (60 seconds)
chrome.idle.setDetectionInterval(60);

// Periodic save (every 30 seconds)
setInterval(saveTimeForActiveTab, 30000);

// Initialize tracking on startup
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0] && tabs[0].url) {
    activeTabId = tabs[0].id;
    activeTabUrl = tabs[0].url;
    startTime = Date.now();
  }
});
