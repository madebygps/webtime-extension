// WebTime Popup Script
// Displays locally stored browsing data

document.addEventListener('DOMContentLoaded', init);

async function init() {
  setupTabs();
  setupButtons();
  await loadData();
}

// Tab switching
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });
}

// Button handlers
function setupButtons() {
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('clear-btn').addEventListener('click', clearData);
}

// Load and display data
async function loadData() {
  try {
    const data = await chrome.storage.local.get(['webtime_data']);
    const webTimeData = data.webtime_data || { sites: {}, dailyStats: {} };
    
    displayTodayStats(webTimeData);
    displayWeekStats(webTimeData);
    displayAllTimeStats(webTimeData);
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Format time in human readable format
function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

// Get today's date key
function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

// Get date keys for the past 7 days
function getWeekKeys() {
  const keys = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    keys.push(date.toISOString().split('T')[0]);
  }
  return keys;
}

// Display today's stats
function displayTodayStats(webTimeData) {
  const todayKey = getTodayKey();
  const todayData = webTimeData.dailyStats[todayKey] || {};
  
  const sites = Object.entries(todayData)
    .map(([domain, data]) => ({
      domain,
      time: data.time,
      visits: data.visits,
      favicon: webTimeData.sites[domain]?.favicon || ''
    }))
    .sort((a, b) => b.time - a.time);
  
  const totalTime = sites.reduce((sum, site) => sum + site.time, 0);
  const siteCount = sites.length;
  
  document.getElementById('today-total').textContent = formatTime(totalTime);
  document.getElementById('today-sites').textContent = siteCount;
  
  displaySiteList('today-list', sites, totalTime);
}

// Display week stats
function displayWeekStats(webTimeData) {
  const weekKeys = getWeekKeys();
  const weekSites = {};
  
  weekKeys.forEach(key => {
    const dayData = webTimeData.dailyStats[key] || {};
    Object.entries(dayData).forEach(([domain, data]) => {
      if (!weekSites[domain]) {
        weekSites[domain] = { time: 0, visits: 0 };
      }
      weekSites[domain].time += data.time;
      weekSites[domain].visits += data.visits;
    });
  });
  
  const sites = Object.entries(weekSites)
    .map(([domain, data]) => ({
      domain,
      time: data.time,
      visits: data.visits,
      favicon: webTimeData.sites[domain]?.favicon || ''
    }))
    .sort((a, b) => b.time - a.time);
  
  const totalTime = sites.reduce((sum, site) => sum + site.time, 0);
  const siteCount = sites.length;
  
  document.getElementById('week-total').textContent = formatTime(totalTime);
  document.getElementById('week-sites').textContent = siteCount;
  
  displaySiteList('week-list', sites, totalTime);
}

// Display all-time stats
function displayAllTimeStats(webTimeData) {
  const sites = Object.entries(webTimeData.sites)
    .map(([domain, data]) => ({
      domain,
      time: data.totalTime,
      visits: data.visits,
      favicon: data.favicon
    }))
    .sort((a, b) => b.time - a.time);
  
  const totalTime = sites.reduce((sum, site) => sum + site.time, 0);
  const siteCount = sites.length;
  
  document.getElementById('all-total').textContent = formatTime(totalTime);
  document.getElementById('all-sites').textContent = siteCount;
  
  displaySiteList('all-list', sites, totalTime);
}

// Display site list
function displaySiteList(containerId, sites, maxTime) {
  const container = document.getElementById(containerId);
  
  if (sites.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-text">No browsing data yet.<br>Start browsing to see your stats!</div>
      </div>
    `;
    return;
  }
  
  const topTime = sites[0]?.time || 1;
  
  container.innerHTML = sites.slice(0, 20).map(site => {
    const percentage = Math.min(100, Math.max(0, (site.time / topTime) * 100)); // Clamp 0-100
    const safeFavicon = sanitizeUrl(site.favicon);
    return `
      <div class="site-item">
        <div class="site-favicon">
          ${safeFavicon ? `<img src="${safeFavicon}" alt="" onerror="this.style.display='none'; this.parentElement.textContent='🌐'">` : '🌐'}
        </div>
        <div class="site-info">
          <div class="site-name">${escapeHtml(site.domain)}</div>
          <div class="site-visits">${Math.floor(site.visits)} visit${site.visits !== 1 ? 's' : ''}</div>
          <div class="time-bar">
            <div class="time-bar-fill" style="width: ${percentage}%"></div>
          </div>
        </div>
        <div class="site-time">${formatTime(site.time)}</div>
      </div>
    `;
  }).join('');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Sanitize URL to prevent XSS through malicious URLs
function sanitizeUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    // Only allow chrome-extension:// and https:// protocols
    if (parsed.protocol === 'chrome-extension:' || parsed.protocol === 'https:') {
      return url;
    }
    return '';
  } catch {
    return '';
  }
}

// Export data as JSON
async function exportData() {
  try {
    const data = await chrome.storage.local.get(['webtime_data']);
    const webTimeData = data.webtime_data || { sites: {}, dailyStats: {} };
    
    const exportData = {
      exportDate: new Date().toISOString(),
      data: webTimeData
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `webtime-export-${getTodayKey()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting data:', error);
  }
}

// Clear all data
async function clearData() {
  if (confirm('Are you sure you want to clear all browsing time data? This cannot be undone.')) {
    try {
      await chrome.storage.local.set({
        webtime_data: {
          sites: {},
          dailyStats: {},
          lastUpdated: Date.now()
        }
      });
      await loadData();
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  }
}
