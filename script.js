// FPL Optimizer - Step 1: Core Setup & API Integration
// Handles data fetching, caching, and display

// Cache TTLs (in milliseconds)
const CACHE_TTL = {
    STATIC: 60 * 60 * 1000,  // 1 hour for static data
    LIVE: 5 * 60 * 1000       // 5 minutes for live data
};

// API endpoints (use relative paths for Vercel, or absolute for local dev)
const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : '/api';

const ENDPOINTS = {
    BOOTSTRAP: `${API_BASE}/bootstrap-static`,
    FIXTURES: `${API_BASE}/fixtures`,
    EVENT_LIVE: (gw) => `${API_BASE}/event-live?gw=${gw}`
};

// Cache management
class CacheManager {
    static get(key) {
        try {
            const item = localStorage.getItem(key);
            if (!item) return null;

            const { data, timestamp } = JSON.parse(item);
            return { data, timestamp };
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    static set(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.error('Cache set error:', error);
        }
    }

    static isValid(key, ttl) {
        const cached = this.get(key);
        if (!cached) return false;

        const age = Date.now() - cached.timestamp;
        return age < ttl;
    }

    static clear() {
        const keys = ['fpl_bootstrap', 'fpl_fixtures', 'fpl_live'];
        keys.forEach(key => localStorage.removeItem(key));
    }
}

// Data fetching with caching
async function fetchWithCache(url, cacheKey, ttl) {
    // Check cache first
    if (CacheManager.isValid(cacheKey, ttl)) {
        console.log(`Using cached data for ${cacheKey}`);
        const cached = CacheManager.get(cacheKey);
        return cached.data;
    }

    // Fetch fresh data
    console.log(`Fetching fresh data for ${cacheKey}`);
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Cache the data
    CacheManager.set(cacheKey, data);

    return data;
}

// Main data loading function
async function loadFPLData() {
    const loadBtn = document.getElementById('loadDataBtn');
    const playersList = document.getElementById('playersList');
    const fixturesList = document.getElementById('fixturesList');

    try {
        loadBtn.disabled = true;
        loadBtn.textContent = 'Loading...';

        playersList.innerHTML = '<p class="loading">Fetching player data...</p>';
        fixturesList.innerHTML = '<p class="loading">Fetching fixtures...</p>';

        // Fetch bootstrap-static data (all players, teams, gameweeks)
        const bootstrapData = await fetchWithCache(
            ENDPOINTS.BOOTSTRAP,
            'fpl_bootstrap',
            CACHE_TTL.STATIC
        );

        // Fetch fixtures
        const fixturesData = await fetchWithCache(
            ENDPOINTS.FIXTURES,
            'fpl_fixtures',
            CACHE_TTL.STATIC
        );

        // Get current gameweek
        const currentGW = bootstrapData.events.find(e => e.is_current);

        // Display stats
        document.getElementById('playerCount').textContent = bootstrapData.elements.length;
        document.getElementById('currentGW').textContent = currentGW ? currentGW.id : 'N/A';
        document.getElementById('fixtureCount').textContent = fixturesData.length;

        // Display players
        displayPlayers(bootstrapData);

        // Display fixtures
        displayFixtures(fixturesData, bootstrapData.teams, currentGW?.id);

        // Update cache status
        updateCacheStatus();

        loadBtn.textContent = 'Refresh Data';

    } catch (error) {
        console.error('Error loading FPL data:', error);
        playersList.innerHTML = `<p class="error">Error: ${error.message}</p>`;
        fixturesList.innerHTML = `<p class="error">Failed to load fixtures</p>`;
    } finally {
        loadBtn.disabled = false;
    }
}

// Display players in simple text format
function displayPlayers(data) {
    const playersList = document.getElementById('playersList');
    const { elements, teams } = data;

    // Create team lookup
    const teamLookup = {};
    teams.forEach(team => {
        teamLookup[team.id] = team.short_name;
    });

    // Sort players by total points
    const topPlayers = elements
        .sort((a, b) => b.total_points - a.total_points)
        .slice(0, 50);  // Top 50 players

    // Display format: "Salah (LIV) - £12.5m - 107pts"
    playersList.innerHTML = topPlayers.map(player => {
        const teamCode = teamLookup[player.team];
        const price = (player.now_cost / 10).toFixed(1);
        const points = player.total_points;

        return `<div class="player-item">${player.web_name} (${teamCode}) - £${price}m - ${points}pts</div>`;
    }).join('');
}

// Display upcoming fixtures
function displayFixtures(fixtures, teams, currentGW) {
    const fixturesList = document.getElementById('fixturesList');

    // Create team lookup
    const teamLookup = {};
    teams.forEach(team => {
        teamLookup[team.id] = team.short_name;
    });

    // Filter upcoming fixtures (next 10)
    const upcomingFixtures = fixtures
        .filter(f => !f.finished && f.event >= (currentGW || 1))
        .slice(0, 10);

    if (upcomingFixtures.length === 0) {
        fixturesList.innerHTML = '<p class="placeholder">No upcoming fixtures</p>';
        return;
    }

    fixturesList.innerHTML = upcomingFixtures.map(fixture => {
        const homeTeam = teamLookup[fixture.team_h];
        const awayTeam = teamLookup[fixture.team_a];
        const gw = fixture.event;
        const difficulty = `H:${fixture.team_h_difficulty} A:${fixture.team_a_difficulty}`;

        return `<div class="fixture-item">GW${gw}: ${homeTeam} vs ${awayTeam} (${difficulty})</div>`;
    }).join('');
}

// Update cache status display
function updateCacheStatus() {
    const statusEl = document.getElementById('cacheStatus');
    const bootstrap = CacheManager.get('fpl_bootstrap');
    const fixtures = CacheManager.get('fpl_fixtures');

    if (bootstrap || fixtures) {
        const lastUpdate = bootstrap ? new Date(bootstrap.timestamp).toLocaleTimeString() : 'N/A';
        statusEl.textContent = `Cache: Last updated ${lastUpdate}`;
    } else {
        statusEl.textContent = 'Cache: Empty';
    }
}

// Clear cache
function clearCache() {
    CacheManager.clear();
    updateCacheStatus();
    document.getElementById('playersList').innerHTML = '<p class="placeholder">Click "Load FPL Data" to fetch player information</p>';
    document.getElementById('fixturesList').innerHTML = '<p class="placeholder">Fixtures will appear here</p>';
    document.getElementById('playerCount').textContent = '0';
    document.getElementById('currentGW').textContent = '-';
    document.getElementById('fixtureCount').textContent = '0';
    alert('Cache cleared! Click "Load FPL Data" to refresh.');
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loadDataBtn').addEventListener('click', loadFPLData);
    document.getElementById('clearCacheBtn').addEventListener('click', clearCache);

    // Update cache status on load
    updateCacheStatus();

    // Auto-load data if cache exists
    if (CacheManager.isValid('fpl_bootstrap', CACHE_TTL.STATIC)) {
        console.log('Loading from cache on page load');
        loadFPLData();
    }
});
