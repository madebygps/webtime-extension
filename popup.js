// WebTime Popup Script
// Displays locally stored browsing data

document.addEventListener('DOMContentLoaded', init);

let currentTab = 'today';
let webTimeDataCache = null;

async function init() {
  setupTabs();
  setupButtons();
  updateDateDisplay();
  await loadData();
}

// Update date display in header
function updateDateDisplay() {
  const dateEl = document.getElementById('current-date');
  const now = new Date();
  const options = { weekday: 'long', month: 'short', day: 'numeric' };
  dateEl.textContent = `Today, ${now.toLocaleDateString('en-US', options)}`;
}

// Tab switching
function setupTabs() {
  const tabs = document.querySelectorAll('.segment-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      document.getElementById(currentTab).classList.add('active');
      
      // Update header total based on selected tab
      updateHeaderTotal();
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
    webTimeDataCache = data.webtime_data || { sites: {}, dailyStats: {} };
    
    displayTodayStats(webTimeDataCache);
    displayWeekStats(webTimeDataCache);
    displayAllTimeStats(webTimeDataCache);
    updateHeaderTotal();
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Update header total time based on current tab
function updateHeaderTotal() {
  if (!webTimeDataCache) return;
  
  let totalTime = 0;
  
  if (currentTab === 'today') {
    const todayKey = getTodayKey();
    const todayData = webTimeDataCache.dailyStats[todayKey] || {};
    totalTime = Object.values(todayData).reduce((sum, data) => sum + data.time, 0);
  } else if (currentTab === 'week') {
    const weekKeys = getWeekKeys();
    weekKeys.forEach(key => {
      const dayData = webTimeDataCache.dailyStats[key] || {};
      totalTime += Object.values(dayData).reduce((sum, data) => sum + data.time, 0);
    });
  } else {
    totalTime = Object.values(webTimeDataCache.sites).reduce((sum, data) => sum + data.totalTime, 0);
  }
  
  document.getElementById('header-total').textContent = formatTime(totalTime);
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

// Get today's date key (uses local timezone)
function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get date keys for the past 7 days (uses local timezone)
function getWeekKeys() {
  const keys = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    keys.push(`${year}-${month}-${day}`);
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
  
  const siteCount = sites.length;
  
  document.getElementById('today-sites').textContent = `${siteCount} site${siteCount !== 1 ? 's' : ''}`;
  
  displayActivityChart(webTimeData);
  displaySiteList('today-list', sites);
}

// Display activity chart for today
function displayActivityChart(webTimeData) {
  const todayKey = getTodayKey();
  const hourlyData = webTimeData.hourlyStats?.[todayKey] || {};
  const currentHour = new Date().getHours();
  
  // Create array of 24 hours with their data
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    time: hourlyData[i] || 0
  }));
  
  // Find max time for scaling and peak hour
  const maxTime = Math.max(...hours.map(h => h.time), 1);
  const peakHour = hours.reduce((peak, h) => h.time > peak.time ? h : peak, hours[0]);
  
  // Show every 3rd hour label (0, 3, 6, 9, 12, 15, 18, 21)
  const showLabels = [0, 3, 6, 9, 12, 15, 18, 21];
  
  // Max bar height in pixels (leaving room for labels)
  const maxBarHeight = 60;
  
  const chartHtml = hours.map(({ hour, time }) => {
    const heightPx = time > 0 ? Math.max((time / maxTime) * maxBarHeight, 2) : 2;
    const isPeak = hour === peakHour.hour && time > 0;
    const isCurrent = hour === currentHour;
    const isEmpty = time === 0;
    
    const label = showLabels.includes(hour) 
      ? (hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour-12}p`)
      : '';
    
    const timeLabel = hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour-12}pm`;
    
    return `
      <div class="chart-bar-wrapper" data-tooltip="${formatTime(time)} at ${timeLabel}">
        <div class="chart-bar ${isEmpty ? 'empty' : ''} ${isPeak ? 'peak' : ''} ${isCurrent ? 'current' : ''}" 
             style="height: ${heightPx}px"></div>
        ${label ? `<span class="chart-label ${isCurrent ? 'current' : ''} ${isPeak ? 'peak' : ''}">${label}</span>` : ''}
        ${isCurrent && !label ? '<span class="current-dot"></span>' : ''}
      </div>
    `;
  }).join('');
  
  document.getElementById('activity-chart').innerHTML = chartHtml;
  
  // Update peak hour display
  const peakEl = document.getElementById('peak-hour');
  if (peakHour.time > 0) {
    const peakHourLabel = peakHour.hour === 0 ? '12am' 
      : peakHour.hour < 12 ? `${peakHour.hour}am` 
      : peakHour.hour === 12 ? '12pm' 
      : `${peakHour.hour - 12}pm`;
    peakEl.textContent = `Peak: ${peakHourLabel}`;
  } else {
    peakEl.textContent = '';
  }
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
  
  const siteCount = sites.length;
  
  document.getElementById('week-sites').textContent = `${siteCount} site${siteCount !== 1 ? 's' : ''}`;
  
  displaySiteList('week-list', sites);
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
  
  const siteCount = sites.length;
  
  document.getElementById('all-sites').textContent = `${siteCount} site${siteCount !== 1 ? 's' : ''}`;
  
  displaySiteList('all-list', sites);
}

// Display site list
function displaySiteList(containerId, sites) {
  const container = document.getElementById(containerId);
  
  if (sites.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12,6 12,12 16,14"/>
          </svg>
        </div>
        <div class="empty-state-title">No Activity</div>
        <div class="empty-state-text">Your browsing time will appear here</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = sites.slice(0, 20).map(site => {
    const safeFavicon = sanitizeUrl(site.favicon);
    return `
      <div class="site-item">
        <div class="site-favicon">
          ${safeFavicon ? `<img src="${safeFavicon}" alt="" onerror="this.style.display='none'; this.parentElement.textContent='🌐'">` : '🌐'}
        </div>
        <div class="site-info">
          <div class="site-name">${escapeHtml(site.domain)}</div>
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
    // Only allow https:// protocol (for Google favicon service)
    if (parsed.protocol === 'https:') {
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
    a.download = `quipu-pacha-${getTodayKey()}.json`;
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
          hourlyStats: {},
          lastUpdated: Date.now()
        }
      });
      await loadData();
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  }
}
