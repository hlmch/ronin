// ============================================================================
// FPL OPTIMIZER - Rebuilt for Real Team Data
// ============================================================================

// Global state
const APP_STATE = {
    teamId: null,
    teamData: null,
    teamPicks: null,
    bootstrapData: null,
    fixturesData: null,
    currentGW: null,
    currentPage: 'dashboard',
    currentCaptainStrategy: 'BALANCED',
    playerData: null
};

// API Configuration
const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : '/api';

const ENDPOINTS = {
    BOOTSTRAP: `${API_BASE}/bootstrap-static`,
    FIXTURES: `${API_BASE}/fixtures`,
    TEAM: (id) => `${API_BASE}/team?teamId=${id}`,
    PICKS: (id, gw) => `${API_BASE}/picks?teamId=${id}${gw ? `&gw=${gw}` : ''}`
};

// Cache TTL
const CACHE_TTL = {
    STATIC: 2 * 60 * 60 * 1000, // 2 hours for static data
    TEAM: 5 * 60 * 1000 // 5 minutes for team data
};

// ============================================================================
// PAGE NAVIGATION
// ============================================================================

function switchPage(pageName) {
    // Update active nav button
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.page === pageName) {
            btn.classList.add('active');
        }
    });

    // Update active page
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageName).classList.add('active');

    APP_STATE.currentPage = pageName;
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

class CacheManager {
    static set(key, data) {
        const cacheEntry = {
            data,
            timestamp: Date.now()
        };
        localStorage.setItem(key, JSON.stringify(cacheEntry));
    }

    static get(key) {
        const cached = localStorage.getItem(key);
        return cached ? JSON.parse(cached) : null;
    }

    static isValid(key, ttl) {
        const cached = this.get(key);
        if (!cached) return false;

        const age = Date.now() - cached.timestamp;
        return age < ttl;
    }

    static clear() {
        const keys = ['fpl_bootstrap', 'fpl_fixtures', 'fpl_team', 'fpl_picks'];
        keys.forEach(key => localStorage.removeItem(key));
    }
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchWithCache(url, cacheKey, ttl) {
    // Check cache first
    if (CacheManager.isValid(cacheKey, ttl)) {
        console.log(`✓ Using cached data for ${cacheKey}`);
        const cached = CacheManager.get(cacheKey);
        return cached.data;
    }

    // Fetch fresh data
    console.log(`→ Fetching fresh data for ${cacheKey}`);
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    CacheManager.set(cacheKey, data);

    return data;
}

async function loadTeamData(teamId) {
    try {
        // Load bootstrap data first
        APP_STATE.bootstrapData = await fetchWithCache(
            ENDPOINTS.BOOTSTRAP,
            'fpl_bootstrap',
            CACHE_TTL.STATIC
        );

        // Load fixtures
        APP_STATE.fixturesData = await fetchWithCache(
            ENDPOINTS.FIXTURES,
            'fpl_fixtures',
            CACHE_TTL.STATIC
        );

        // Get current gameweek
        const currentEvent = APP_STATE.bootstrapData.events.find(e => e.is_current);
        APP_STATE.currentGW = currentEvent ? currentEvent.id : 1;

        // Load user's team data
        APP_STATE.teamData = await fetchWithCache(
            ENDPOINTS.TEAM(teamId),
            `fpl_team_${teamId}`,
            CACHE_TTL.TEAM
        );

        // Load user's current picks
        APP_STATE.teamPicks = await fetchWithCache(
            ENDPOINTS.PICKS(teamId, APP_STATE.currentGW),
            `fpl_picks_${teamId}_${APP_STATE.currentGW}`,
            CACHE_TTL.TEAM
        );

        // Process player data
        APP_STATE.playerData = APP_STATE.bootstrapData.elements.map(player => {
            const team = APP_STATE.bootstrapData.teams.find(t => t.id === player.team);
            return {
                ...player,
                team_name: team ? team.short_name : 'UNK',
                team_obj: team
            };
        });

        return true;
    } catch (error) {
        console.error('Error loading team data:', error);
        throw error;
    }
}

// ============================================================================
// DASHBOARD - TEAM ID INPUT
// ============================================================================

function initDashboard() {
    const loadTeamBtn = document.getElementById('loadTeamBtn');
    const teamIdInput = document.getElementById('teamIdInput');

    // Load saved team ID
    const savedTeamId = localStorage.getItem('fpl_saved_team_id');
    if (savedTeamId) {
        teamIdInput.value = savedTeamId;
    }

    loadTeamBtn.addEventListener('click', async () => {
        const teamId = teamIdInput.value.trim();

        if (!teamId || isNaN(teamId)) {
            alert('Please enter a valid Team ID');
            return;
        }

        try {
            loadTeamBtn.disabled = true;
            loadTeamBtn.textContent = 'Loading...';

            APP_STATE.teamId = teamId;
            localStorage.setItem('fpl_saved_team_id', teamId);

            await loadTeamData(teamId);

            // Display team info
            displayTeamInfo();

            // Show quick actions
            document.getElementById('quickStats').style.display = 'block';

            // Enable other pages
            initPlayerDatabase();
            initMyTeamPage();

            loadTeamBtn.textContent = '✓ Team Loaded';
            setTimeout(() => {
                loadTeamBtn.textContent = 'Load My Team';
                loadTeamBtn.disabled = false;
            }, 2000);

        } catch (error) {
            alert(`Failed to load team: ${error.message}`);
            loadTeamBtn.textContent = 'Load My Team';
            loadTeamBtn.disabled = false;
        }
    });
}

function displayTeamInfo() {
    const teamInfo = document.getElementById('teamInfo');
    const data = APP_STATE.teamData;

    document.getElementById('teamName').textContent = data.name;
    document.getElementById('managerName').textContent = `${data.player_first_name} ${data.player_last_name}`;
    document.getElementById('overallRank').textContent = data.summary_overall_rank?.toLocaleString() || 'N/A';
    document.getElementById('totalPoints').textContent = data.summary_overall_points?.toLocaleString() || '0';
    document.getElementById('teamValue').textContent = `£${(data.last_deadline_value / 10).toFixed(1)}m`;
    document.getElementById('bankValue').textContent = `£${(data.last_deadline_bank / 10).toFixed(1)}m`;
    document.getElementById('freeTransfers').textContent = data.transfers?.limit || '1';

    teamInfo.style.display = 'block';
}

// ============================================================================
// PLAYER DATABASE TABLE
// ============================================================================

function initPlayerDatabase() {
    const container = document.getElementById('playerTableContainer');
    const teamFilter = document.getElementById('teamFilter');

    // Populate team filter
    const teams = APP_STATE.bootstrapData.teams.sort((a, b) => a.name.localeCompare(b.name));
    teams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        teamFilter.appendChild(option);
    });

    // Render initial table
    renderPlayerTable();

    // Add filter event listeners
    document.getElementById('playerSearch').addEventListener('input', renderPlayerTable);
    document.getElementById('positionFilter').addEventListener('change', renderPlayerTable);
    teamFilter.addEventListener('change', renderPlayerTable);
    document.getElementById('priceFilter').addEventListener('change', renderPlayerTable);
    document.getElementById('availableOnly').addEventListener('change', renderPlayerTable);
    document.getElementById('refreshDataBtn').addEventListener('click', async () => {
        CacheManager.clear();
        await loadTeamData(APP_STATE.teamId);
        renderPlayerTable();
    });
}

function getUpcomingFixtures(player, count = 3) {
    const fixtures = APP_STATE.fixturesData
        .filter(f => !f.finished && (f.team_h === player.team || f.team_a === player.team))
        .sort((a, b) => a.event - b.event)
        .slice(0, count);

    return fixtures.map(f => {
        const isHome = f.team_h === player.team;
        const oppTeamId = isHome ? f.team_a : f.team_h;
        const oppTeam = APP_STATE.bootstrapData.teams.find(t => t.id === oppTeamId);
        const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;

        return {
            opponent: oppTeam ? oppTeam.short_name : 'UNK',
            isHome,
            difficulty,
            event: f.event
        };
    });
}

function getDifficultyColor(difficulty) {
    const colors = {
        1: '#00ff87', // Very easy - bright green
        2: '#7bed9f', // Easy - light green
        3: '#ffa502', // Medium - orange
        4: '#ff6348', // Hard - red
        5: '#ff4757'  // Very hard - dark red
    };
    return colors[difficulty] || '#ccc';
}

function renderPlayerTable() {
    const container = document.getElementById('playerTableContainer');

    // Get filter values
    const searchTerm = document.getElementById('playerSearch').value.toLowerCase();
    const positionFilter = document.getElementById('positionFilter').value;
    const teamFilter = document.getElementById('teamFilter').value;
    const priceFilter = document.getElementById('priceFilter').value;
    const availableOnly = document.getElementById('availableOnly').checked;

    // Filter players
    let players = APP_STATE.playerData.filter(p => {
        // Search filter
        if (searchTerm && !p.web_name.toLowerCase().includes(searchTerm)) {
            return false;
        }

        // Position filter
        if (positionFilter && p.element_type != positionFilter) {
            return false;
        }

        // Team filter
        if (teamFilter && p.team != teamFilter) {
            return false;
        }

        // Price filter
        if (priceFilter) {
            const [min, max] = priceFilter.split('-').map(Number);
            const price = p.now_cost / 10;
            if (price < min || price > max) {
                return false;
            }
        }

        // Available only
        if (availableOnly && (p.chance_of_playing_next_round !== null && p.chance_of_playing_next_round < 100)) {
            return false;
        }

        return true;
    });

    // Sort by total points descending
    players.sort((a, b) => b.total_points - a.total_points);

    // Limit to top 100 for performance
    players = players.slice(0, 100);

    // Build table HTML
    let html = `
        <table class="player-table">
            <thead>
                <tr>
                    <th>Player</th>
                    <th>Team</th>
                    <th>Pos</th>
                    <th>Price</th>
                    <th>Pts</th>
                    <th>Form</th>
                    <th>xGI</th>
                    <th>Own%</th>
                    <th>Next 3 Fixtures</th>
                </tr>
            </thead>
            <tbody>
    `;

    players.forEach(player => {
        const positionMap = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
        const position = positionMap[player.element_type];
        const price = (player.now_cost / 10).toFixed(1);
        const xGI = ((parseFloat(player.expected_goals || 0) + parseFloat(player.expected_assists || 0))).toFixed(1);
        const fixtures = getUpcomingFixtures(player);

        const fixturesHTML = fixtures.map(f => {
            const bgColor = getDifficultyColor(f.difficulty);
            const prefix = f.isHome ? '' : '@';
            return `<span class="fixture-badge" style="background: ${bgColor};">${prefix}${f.opponent}</span>`;
        }).join(' ');

        html += `
            <tr>
                <td class="player-name-cell">${player.web_name}</td>
                <td>${player.team_name}</td>
                <td>${position}</td>
                <td>£${price}</td>
                <td><strong>${player.total_points}</strong></td>
                <td>${player.form}</td>
                <td>${xGI}</td>
                <td>${player.selected_by_percent}%</td>
                <td class="fixtures-cell">${fixturesHTML}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';

    container.innerHTML = html;
}

// ============================================================================
// MY TEAM PAGE
// ============================================================================

function initMyTeamPage() {
    displayMyTeam();
    analyzeTransfers();
    analyzeCaptainOptions();
}

function displayMyTeam() {
    const container = document.getElementById('myTeamContent');
    const picks = APP_STATE.teamPicks.picks;

    let html = '<div class="my-team-display">';
    html += '<h3>Current Squad (GW' + APP_STATE.currentGW + ')</h3>';
    html += '<div class="team-grid">';

    picks.forEach(pick => {
        const player = APP_STATE.playerData.find(p => p.id === pick.element);
        if (!player) return;

        const positionMap = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
        const isCaptain = pick.is_captain;
        const isViceCaptain = pick.is_vice_captain;

        html += `
            <div class="team-player-card">
                <div class="player-card-header">
                    ${isCaptain ? '<span class="captain-badge">C</span>' : ''}
                    ${isViceCaptain ? '<span class="vice-badge">VC</span>' : ''}
                </div>
                <div class="player-card-name">${player.web_name}</div>
                <div class="player-card-team">${player.team_name}</div>
                <div class="player-card-stats">
                    <span>${positionMap[player.element_type]}</span>
                    <span>£${(player.now_cost / 10).toFixed(1)}</span>
                    <span>${player.total_points}pts</span>
                </div>
            </div>
        `;
    });

    html += '</div></div>';
    container.innerHTML = html;

    // Show sections
    document.getElementById('transferSection').style.display = 'block';
    document.getElementById('captainSection').style.display = 'block';
}

function analyzeTransfers() {
    // TODO: Implement proper transfer analysis based on real team
    const container = document.getElementById('transferAnalysis');
    container.innerHTML = '<p class="info-message">Transfer analysis coming soon - analyzing your actual team!</p>';
}

function analyzeCaptainOptions() {
    // TODO: Implement proper captain analysis based on real team
    const container = document.getElementById('captainAnalysis');
    container.innerHTML = '<p class="info-message">Captain analysis coming soon - analyzing your actual team!</p>';
}

// ============================================================================
// WILDCARD BUILDER
// ============================================================================

document.getElementById('buildWildcardBtn')?.addEventListener('click', () => {
    const container = document.getElementById('wildcardTeam');
    container.innerHTML = '<p class="info-message">Wildcard builder coming soon - will build optimal team!</p>';
});

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Set up navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchPage(e.target.dataset.page);
        });
    });

    // Initialize dashboard
    initDashboard();

    // Set up strategy buttons
    document.querySelectorAll('.strategy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.strategy-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            APP_STATE.currentCaptainStrategy = e.target.dataset.strategy;
            if (APP_STATE.teamId) {
                analyzeCaptainOptions();
            }
        });
    });

    console.log('🚀 FPL Optimizer initialized');
});
