// WebTime Background Service Worker
// All data stored locally using chrome.storage.local - no external servers
// Uses heartbeat-based tracking for accurate time measurement

const HEARTBEAT_INTERVAL_SECONDS = 30;
const MAX_VALID_GAP_MS = 45 * 1000; // 45 seconds - if gap is larger, system was likely asleep

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('WebTime installed - tracking time privately');
  initializeStorage();
  setupHeartbeatAlarm();
});

// Also setup alarm on startup (service worker restart)
chrome.runtime.onStartup.addListener(() => {
  setupHeartbeatAlarm();
});

// Setup the heartbeat alarm
function setupHeartbeatAlarm() {
  chrome.alarms.create('heartbeat', {
    periodInMinutes: HEARTBEAT_INTERVAL_SECONDS / 60
  });
}

// Initialize storage structure
async function initializeStorage() {
  const data = await chrome.storage.local.get(['webtime_data', 'webtime_tracking']);
  
  if (!data.webtime_data) {
    await chrome.storage.local.set({
      webtime_data: {
        sites: {},
        dailyStats: {},
        hourlyStats: {},
        lastUpdated: Date.now()
      }
    });
  }
  
  if (!data.webtime_tracking) {
    await chrome.storage.local.set({
      webtime_tracking: {
        activeTabUrl: null,
        lastHeartbeat: null,
        isIdle: false
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

// Get today's date key (uses local timezone)
function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get favicon URL using Google's favicon service
function getFaviconUrl(domain) {
  // Use Google's favicon service - reliable and works in all browsers
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

// Heartbeat handler - called by chrome.alarms
async function handleHeartbeat() {
  const now = Date.now();
  
  try {
    const { webtime_tracking } = await chrome.storage.local.get(['webtime_tracking']);
    const tracking = webtime_tracking || { activeTabUrl: null, lastHeartbeat: null, isIdle: false };
    
    // Don't track if idle
    if (tracking.isIdle) {
      tracking.lastHeartbeat = now;
      await chrome.storage.local.set({ webtime_tracking: tracking });
      return;
    }
    
    // Don't track if no active URL
    if (!tracking.activeTabUrl) {
      tracking.lastHeartbeat = now;
      await chrome.storage.local.set({ webtime_tracking: tracking });
      return;
    }
    
    const domain = getDomain(tracking.activeTabUrl);
    if (!shouldTrackDomain(domain)) {
      tracking.lastHeartbeat = now;
      await chrome.storage.local.set({ webtime_tracking: tracking });
      return;
    }
    
    // Calculate time since last heartbeat
    if (tracking.lastHeartbeat) {
      const gap = now - tracking.lastHeartbeat;
      
      // Only record time if the gap is reasonable (system wasn't asleep)
      if (gap <= MAX_VALID_GAP_MS && gap >= 1000) {
        await recordTime(domain, gap);
      }
      // If gap > MAX_VALID_GAP_MS, we assume system was asleep and discard the time
    }
    
    // Update last heartbeat
    tracking.lastHeartbeat = now;
    await chrome.storage.local.set({ webtime_tracking: tracking });
    
  } catch (error) {
    console.error('Error in heartbeat:', error);
  }
}

// Record time for a domain
async function recordTime(domain, timeMs) {
  const todayKey = getTodayKey();
  const now = new Date();
  
  try {
    const data = await chrome.storage.local.get(['webtime_data']);
    const webTimeData = data.webtime_data || { sites: {}, dailyStats: {}, hourlyStats: {} };
    
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
    
    // Initialize hourly stats if not exists
    if (!webTimeData.hourlyStats) {
      webTimeData.hourlyStats = {};
    }
    
    if (!webTimeData.hourlyStats[todayKey]) {
      webTimeData.hourlyStats[todayKey] = {};
    }
    
    const currentHour = now.getHours();
    if (!webTimeData.hourlyStats[todayKey][currentHour]) {
      webTimeData.hourlyStats[todayKey][currentHour] = 0;
    }
    
    // Update total time
    webTimeData.sites[domain].totalTime += timeMs;
    webTimeData.dailyStats[todayKey][domain].time += timeMs;
    webTimeData.hourlyStats[todayKey][currentHour] += timeMs;
    webTimeData.lastUpdated = Date.now();
    
    await chrome.storage.local.set({ webtime_data: webTimeData });
  } catch (error) {
    console.error('Error recording time:', error);
  }
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

// Update active tab URL in persistent storage
async function setActiveTab(url) {
  const { webtime_tracking } = await chrome.storage.local.get(['webtime_tracking']);
  const tracking = webtime_tracking || { activeTabUrl: null, lastHeartbeat: null, isIdle: false };
  
  tracking.activeTabUrl = url;
  tracking.lastHeartbeat = Date.now(); // Reset heartbeat when changing tabs
  
  await chrome.storage.local.set({ webtime_tracking: tracking });
}

// Update idle state in persistent storage
async function setIdleState(idle) {
  const { webtime_tracking } = await chrome.storage.local.get(['webtime_tracking']);
  const tracking = webtime_tracking || { activeTabUrl: null, lastHeartbeat: null, isIdle: false };
  
  tracking.isIdle = idle;
  if (!idle) {
    // Reset heartbeat when becoming active to avoid counting sleep time
    tracking.lastHeartbeat = Date.now();
  }
  
  await chrome.storage.local.set({ webtime_tracking: tracking });
}

// Handle alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'heartbeat') {
    handleHeartbeat();
  }
});

// Handle tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      await setActiveTab(tab.url);
      const domain = getDomain(tab.url);
      await recordVisit(domain);
    }
  } catch (error) {
    console.error('Error on tab activation:', error);
  }
});

// Handle tab URL updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Check if this is the active tab
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && tabId === activeTab.id && changeInfo.url) {
      await setActiveTab(changeInfo.url);
      const domain = getDomain(changeInfo.url);
      await recordVisit(domain);
    }
  } catch (error) {
    console.error('Error on tab update:', error);
  }
});

// Handle window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await setIdleState(true);
  } else {
    await setIdleState(false);
    // Re-capture active tab when window regains focus
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.url) {
        await setActiveTab(activeTab.url);
      }
    } catch (error) {
      console.error('Error getting active tab on focus:', error);
    }
  }
});

// Handle idle state
chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === 'idle' || state === 'locked') {
    await setIdleState(true);
  } else if (state === 'active') {
    await setIdleState(false);
    // Re-capture active tab when becoming active
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.url) {
        await setActiveTab(activeTab.url);
      }
    } catch (error) {
      console.error('Error getting active tab on active:', error);
    }
  }
});

// Set idle detection interval (60 seconds)
chrome.idle.setDetectionInterval(60);

// Initialize on service worker startup
(async () => {
  await initializeStorage();
  setupHeartbeatAlarm();
  
  // Capture current active tab
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && activeTab.url) {
      await setActiveTab(activeTab.url);
    }
  } catch (error) {
    console.error('Error initializing active tab:', error);
  }
})();
