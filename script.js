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

    // Get starting XI and bench
    const startingXI = picks.filter(p => p.position <= 11).sort((a, b) => a.position - b.position);
    const bench = picks.filter(p => p.position > 11).sort((a, b) => a.position - b.position);

    // Group starting XI by position
    const byPosition = {
        GK: [],
        DEF: [],
        MID: [],
        FWD: []
    };

    startingXI.forEach(pick => {
        const player = APP_STATE.playerData.find(p => p.id === pick.element);
        if (!player) return;

        const positionMap = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
        const pos = positionMap[player.element_type];

        byPosition[pos].push({
            ...player,
            pick
        });
    });

    // Detect formation
    const formation = `${byPosition.DEF.length}-${byPosition.MID.length}-${byPosition.FWD.length}`;

    let html = `
        <div class="my-team-display">
            <div class="team-header">
                <h3>Current Squad - GW${APP_STATE.currentGW}</h3>
                <span class="formation-badge">${formation}</span>
            </div>

            <div class="team-pitch">
    `;

    // Render formation on pitch
    ['FWD', 'MID', 'DEF', 'GK'].forEach(pos => {
        if (byPosition[pos].length === 0) return;

        html += `<div class="pitch-row pitch-row-${pos.toLowerCase()}">`;

        byPosition[pos].forEach(player => {
            const isCaptain = player.pick.is_captain;
            const isViceCaptain = player.pick.is_vice_captain;
            const fixtures = getUpcomingFixtures(player, 1);
            const nextFixture = fixtures[0];

            let fixtureHtml = '';
            if (nextFixture) {
                const bgColor = getDifficultyColor(nextFixture.difficulty);
                const prefix = nextFixture.isHome ? 'vs ' : '@ ';
                fixtureHtml = `<div class="player-fixture" style="background: ${bgColor};">${prefix}${nextFixture.opponent}</div>`;
            }

            html += `
                <div class="pitch-player">
                    ${isCaptain ? '<span class="captain-badge-pitch">C</span>' : ''}
                    ${isViceCaptain ? '<span class="vice-badge-pitch">VC</span>' : ''}
                    <div class="pitch-player-name">${player.web_name}</div>
                    <div class="pitch-player-team">${player.team_name}</div>
                    <div class="pitch-player-stats">
                        <span>£${(player.now_cost / 10).toFixed(1)}</span>
                        <span>${player.form} form</span>
                    </div>
                    ${fixtureHtml}
                </div>
            `;
        });

        html += '</div>';
    });

    html += '</div>'; // Close team-pitch

    // Bench
    html += '<div class="team-bench"><h4>Bench</h4><div class="bench-players">';

    bench.forEach(pick => {
        const player = APP_STATE.playerData.find(p => p.id === pick.element);
        if (!player) return;

        const positionMap = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

        html += `
            <div class="bench-player">
                <span class="bench-position">${positionMap[player.element_type]}</span>
                <span class="bench-name">${player.web_name}</span>
                <span class="bench-team">${player.team_name}</span>
                <span class="bench-price">£${(player.now_cost / 10).toFixed(1)}</span>
            </div>
        `;
    });

    html += '</div></div>'; // Close bench
    html += '</div>'; // Close my-team-display

    container.innerHTML = html;

    // Show sections
    document.getElementById('transferSection').style.display = 'block';
    document.getElementById('captainSection').style.display = 'block';
}

function analyzeTransfers() {
    const container = document.getElementById('transferAnalysis');
    const picks = APP_STATE.teamPicks.picks;

    // Get user's players
    const myPlayers = picks.map(pick => {
        const player = APP_STATE.playerData.find(p => p.id === pick.element);
        return { ...player, pick };
    }).filter(p => p);

    // Count players per team
    const teamCounts = {};
    myPlayers.forEach(player => {
        teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
    });

    // Calculate removal score for each player
    const scoredPlayers = myPlayers.map(player => {
        const form = parseFloat(player.form) || 0;
        const fixtures = getUpcomingFixtures(player, 3);
        const avgFixtureDifficulty = fixtures.length > 0
            ? fixtures.reduce((sum, f) => sum + f.difficulty, 0) / fixtures.length
            : 3;

        const minutesPlayed = player.minutes || 0;
        const availability = player.chance_of_playing_next_round === null ? 100 : (player.chance_of_playing_next_round || 0);

        // Points per game (last 4 weeks)
        const pointsPerGame = minutesPlayed > 0 ? (parseFloat(player.form) * 4) / 4 : 0;

        // Removal score (higher = more likely to remove)
        // Bad form, hard fixtures, low availability = high removal score
        const removalScore =
            (5 - form) * 2 +  // Poor form
            (avgFixtureDifficulty - 1) * 1.5 + // Hard fixtures
            (100 - availability) * 0.02 + // Injury risk
            (minutesPlayed < 180 ? 2 : 0); // Not playing

        return {
            ...player,
            removalScore,
            form,
            avgFixtureDifficulty,
            availability,
            pointsPerGame
        };
    });

    // Sort by removal score (highest first = worst players)
    scoredPlayers.sort((a, b) => b.removalScore - a.removalScore);

    // Top 3 candidates for removal
    const transferOut = scoredPlayers.slice(0, 3);

    // For each player out, find best replacements
    const suggestions = transferOut.map(playerOut => {
        const positionMap = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
        const position = playerOut.element_type;

        // Available budget: player's selling price + bank
        const sellingPrice = playerOut.now_cost; // Simplified
        const bank = APP_STATE.teamData.last_deadline_bank || 0;
        const budget = sellingPrice + bank;

        // Find replacements in same position
        const replacements = APP_STATE.playerData.filter(p => {
            if (p.element_type !== position) return false;
            if (p.now_cost > budget) return false;
            if (p.id === playerOut.id) return false;

            // Check if already in team
            const alreadyInTeam = myPlayers.some(mp => mp.id === p.id);
            if (alreadyInTeam) return false;

            // Must be available
            if (p.chance_of_playing_next_round !== null && p.chance_of_playing_next_round < 75) return false;

            // FPL RULE: Max 3 players per team
            // If we're replacing a player from team X, we can bring in another from team X
            // Otherwise, check if we already have 3 from that team
            const currentTeamCount = teamCounts[p.team] || 0;
            if (p.team === playerOut.team) {
                // Replacing from same team is always OK (just swapping)
                return true;
            } else {
                // Different team - check if we already have 3
                if (currentTeamCount >= 3) {
                    return false;
                }
            }

            return true;
        });

        // Score replacements (higher = better)
        const scoredReplacements = replacements.map(p => {
            const form = parseFloat(p.form) || 0;
            const fixtures = getUpcomingFixtures(p, 3);
            const avgFixtureDifficulty = fixtures.length > 0
                ? fixtures.reduce((sum, f) => sum + f.difficulty, 0) / fixtures.length
                : 3;

            const xGI = (parseFloat(p.expected_goals || 0) + parseFloat(p.expected_assists || 0));

            // Replacement score (higher = better)
            const replacementScore =
                form * 3 + // Good form
                (5 - avgFixtureDifficulty) * 2 + // Easy fixtures
                xGI * 1.5 + // High xG involvement
                (p.minutes / 100); // Minutes played

            return {
                ...p,
                replacementScore,
                form,
                avgFixtureDifficulty,
                xGI,
                fixtures
            };
        });

        // Sort by replacement score
        scoredReplacements.sort((a, b) => b.replacementScore - a.replacementScore);

        return {
            out: playerOut,
            in: scoredReplacements.slice(0, 3) // Top 3 replacements
        };
    });

    // Render HTML
    let html = '<div class="transfer-suggestions">';

    suggestions.forEach((suggestion, index) => {
        const playerOut = suggestion.out;
        const positionMap = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

        html += `
            <div class="transfer-suggestion">
                <div class="suggestion-header">
                    <h4>Transfer ${index + 1}</h4>
                    <span class="position-badge">${positionMap[playerOut.element_type]}</span>
                </div>

                <div class="transfer-comparison">
                    <div class="transfer-out">
                        <div class="transfer-label">OUT</div>
                        <div class="transfer-player-card out">
                            <div class="transfer-player-name">${playerOut.web_name}</div>
                            <div class="transfer-player-team">${playerOut.team_name}</div>
                            <div class="transfer-player-stats">
                                <span>£${(playerOut.now_cost / 10).toFixed(1)}</span>
                                <span>${playerOut.form} form</span>
                                <span>${playerOut.total_points} pts</span>
                                <span>${playerOut.selected_by_percent}% owned</span>
                            </div>
                            <div class="transfer-reason">
                                ${playerOut.form < 2 ? '❌ Poor form' : ''}
                                ${playerOut.avgFixtureDifficulty > 3.5 ? '📅 Hard fixtures' : ''}
                                ${playerOut.availability < 100 ? '🏥 Injury risk' : ''}
                                ${playerOut.minutes < 180 ? '⏱️ Limited minutes' : ''}
                            </div>
                        </div>
                    </div>

                    <div class="transfer-arrow">→</div>

                    <div class="transfer-in">
                        <div class="transfer-label">IN (Top ${suggestion.in.length})</div>
                        ${suggestion.in.map((playerIn, idx) => {
                            const fixturesHtml = playerIn.fixtures.map(f => {
                                const bgColor = getDifficultyColor(f.difficulty);
                                const prefix = f.isHome ? '' : '@';
                                return `<span class="fixture-mini" style="background: ${bgColor};">${prefix}${f.opponent}</span>`;
                            }).join(' ');

                            return `
                                <div class="transfer-player-card in ${idx === 0 ? 'recommended' : ''}">
                                    ${idx === 0 ? '<span class="recommended-badge">⭐ Best</span>' : ''}
                                    <div class="transfer-player-name">${playerIn.web_name}</div>
                                    <div class="transfer-player-team">${playerIn.team_name}</div>
                                    <div class="transfer-player-stats">
                                        <span>£${(playerIn.now_cost / 10).toFixed(1)}</span>
                                        <span>${playerIn.form} form</span>
                                        <span>${playerIn.total_points} pts</span>
                                        <span>${playerIn.selected_by_percent}% owned</span>
                                    </div>
                                    <div class="transfer-reason positive">
                                        ${playerIn.form > 5 ? '✅ Hot form' : ''}
                                        ${playerIn.avgFixtureDifficulty < 2.5 ? '📅 Easy fixtures' : ''}
                                        ${playerIn.xGI > 1 ? '⚽ High xGI' : ''}
                                    </div>
                                    <div class="transfer-fixtures">${fixturesHtml}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';

    container.innerHTML = html;
}

function analyzeCaptainOptions() {
    const container = document.getElementById('captainAnalysis');
    const picks = APP_STATE.teamPicks.picks;

    // Only consider starting XI (positions 1-11)
    const startingXI = picks.filter(p => p.position <= 11);

    // Get player data for starting XI
    const captainCandidates = startingXI.map(pick => {
        const player = APP_STATE.playerData.find(p => p.id === pick.element);
        if (!player) return null;

        const form = parseFloat(player.form) || 0;
        const fixtures = getUpcomingFixtures(player, 1);
        const nextFixture = fixtures[0];
        const fixtureDifficulty = nextFixture ? nextFixture.difficulty : 3;

        // Basic captain score
        const fixtureBonus = (5 - fixtureDifficulty) * 2; // Easier fixtures get higher bonus
        const formScore = form * 2;
        const ownershipScore = parseFloat(player.selected_by_percent) || 0;

        // Strategy-based scoring
        const strategy = APP_STATE.currentCaptainStrategy;
        let captainScore = 0;

        if (strategy === 'SAFE') {
            // Template captain: High ownership + good form
            captainScore = formScore * 0.4 + fixtureBonus * 0.3 + (ownershipScore / 10) * 0.3;
        } else if (strategy === 'BALANCED') {
            // Balance between template and differential
            captainScore = formScore * 0.35 + fixtureBonus * 0.35 + (50 - Math.abs(50 - ownershipScore)) / 20;
        } else if (strategy === 'AGGRESSIVE') {
            // Differential captain: Lower ownership but good underlying stats
            captainScore = formScore * 0.3 + fixtureBonus * 0.4 + ((100 - ownershipScore) / 10) * 0.3;
        }

        // Bonus for attacking returns
        const xGI = (parseFloat(player.expected_goals || 0) + parseFloat(player.expected_assists || 0));
        captainScore += xGI * 0.5;

        return {
            ...player,
            pick,
            form,
            nextFixture,
            fixtureDifficulty,
            captainScore,
            xGI
        };
    }).filter(p => p);

    // Sort by captain score
    captainCandidates.sort((a, b) => b.captainScore - a.captainScore);

    // Top 5 options
    const topCaptains = captainCandidates.slice(0, 5);

    // Render HTML
    let html = `
        <div class="captain-results">
            <div class="captain-header">
                <h4>Top Captain Picks</h4>
                <p class="captain-subtitle">Strategy: ${APP_STATE.currentCaptainStrategy}</p>
            </div>
            <div class="captain-list">
    `;

    topCaptains.forEach((player, index) => {
        const positionMap = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
        const isCurrentCaptain = player.pick.is_captain;
        const ownership = parseFloat(player.selected_by_percent);

        let fixtureHtml = '';
        if (player.nextFixture) {
            const bgColor = getDifficultyColor(player.nextFixture.difficulty);
            const prefix = player.nextFixture.isHome ? 'vs ' : '@ ';
            fixtureHtml = `<span class="fixture-badge" style="background: ${bgColor};">${prefix}${player.nextFixture.opponent}</span>`;
        }

        // Determine badges
        let badges = '';
        if (index === 0) {
            badges += '<span class="captain-rec-badge">⭐ Recommended</span>';
        }
        if (isCurrentCaptain) {
            badges += '<span class="captain-current-badge">👑 Current Captain</span>';
        }
        if (ownership < 15) {
            badges += '<span class="captain-diff-badge">💎 Differential</span>';
        } else if (ownership > 50) {
            badges += '<span class="captain-template-badge">📋 Template</span>';
        }

        const captainPoints = (form * 2).toFixed(1); // Simplified captain points estimate

        html += `
            <div class="captain-option ${index === 0 ? 'recommended' : ''}">
                <div class="captain-main">
                    <div class="captain-player-info">
                        <span class="captain-rank">${index + 1}</span>
                        <div>
                            <div class="captain-name">${player.web_name}</div>
                            <div class="captain-team-pos">${player.team_name} • ${positionMap[player.element_type]}</div>
                        </div>
                    </div>
                    <div class="captain-points">
                        <div class="captain-score">${captainPoints}</div>
                        <div class="captain-score-label">Capt Pts (Est)</div>
                    </div>
                </div>

                ${badges ? `<div class="captain-badges">${badges}</div>` : ''}

                <div class="captain-stats-row">
                    <div class="captain-stat-item">
                        <span class="stat-label">Form</span>
                        <span class="stat-value">${player.form}</span>
                    </div>
                    <div class="captain-stat-item">
                        <span class="stat-label">Ownership</span>
                        <span class="stat-value">${ownership.toFixed(1)}%</span>
                    </div>
                    <div class="captain-stat-item">
                        <span class="stat-label">xGI</span>
                        <span class="stat-value">${player.xGI.toFixed(2)}</span>
                    </div>
                    <div class="captain-stat-item">
                        <span class="stat-label">Fixture</span>
                        <span class="stat-value">${fixtureHtml}</span>
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div></div>';

    container.innerHTML = html;
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
