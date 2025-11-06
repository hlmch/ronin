// FPL Optimizer - Step 2: Transfer Optimizer Implementation
// Handles data fetching, caching, transfer analysis, and display

// Cache TTLs (in milliseconds)
const CACHE_TTL = {
    STATIC: 60 * 60 * 1000,  // 1 hour for static data
    LIVE: 5 * 60 * 1000       // 5 minutes for live data
};

// Mock team for testing (15 player IDs from FPL)
const MOCK_TEAM = {
    players: [
        // Goalkeepers (2)
        1,    // Ramsdale
        303,  // Pope
        // Defenders (5)
        102,  // TAA
        326,  // Trippier
        380,  // Gabriel
        387,  // Ben White
        4,    // Robertson
        // Midfielders (5)
        254,  // Salah
        401,  // Saka
        427,  // Martinelli
        337,  // Gordon
        302,  // Almiron
        // Forwards (3)
        427,  // Haaland
        408,  // Jesus
        56    // Mitrovic
    ],
    bank: 0.5  // £0.5m in the bank
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

        // Run transfer analysis if we have a team
        analyzeTransfers(bootstrapData, fixturesData, currentGW);

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

// ============================================================================
// TRANSFER ANALYSIS - Joshua Bull's "Remove Underperformers" Strategy
// ============================================================================

// Get player form (average points from last 4 gameweeks)
function getPlayerForm(player) {
    if (!player.form || player.form === null) return 0;
    return parseFloat(player.form);
}

// Get fixture difficulty for next N fixtures for a player's team
function getFixtureDifficulty(player, fixtures, teams, numFixtures = 3, currentGW) {
    const teamId = player.team;

    // Get next N fixtures for this team
    const teamFixtures = fixtures
        .filter(f => !f.finished && f.event >= (currentGW?.id || 1))
        .filter(f => f.team_h === teamId || f.team_a === teamId)
        .slice(0, numFixtures);

    if (teamFixtures.length === 0) return 3; // Default medium difficulty

    // Calculate average difficulty
    const totalDifficulty = teamFixtures.reduce((sum, fixture) => {
        const difficulty = fixture.team_h === teamId
            ? fixture.team_h_difficulty
            : fixture.team_a_difficulty;
        return sum + difficulty;
    }, 0);

    return totalDifficulty / teamFixtures.length;
}

// Get away game ratio for next N fixtures
function getAwayGameRatio(player, fixtures, numFixtures = 3, currentGW) {
    const teamId = player.team;

    const teamFixtures = fixtures
        .filter(f => !f.finished && f.event >= (currentGW?.id || 1))
        .filter(f => f.team_h === teamId || f.team_a === teamId)
        .slice(0, numFixtures);

    if (teamFixtures.length === 0) return 0.5; // Default 50%

    const awayGames = teamFixtures.filter(f => f.team_a === teamId).length;
    return awayGames / teamFixtures.length;
}

// Calculate expected points for next N gameweeks (simplified)
function calculateExpectedPoints(player, fixtures, numGW = 3, currentGW) {
    const form = getPlayerForm(player);
    const fixtureDifficulty = getFixtureDifficulty(player, fixtures, null, numGW, currentGW);
    const awayRatio = getAwayGameRatio(player, fixtures, numGW, currentGW);

    // Simple xP calculation: form adjusted by fixture difficulty
    // Lower difficulty = easier = more points expected
    const difficultyMultiplier = (6 - fixtureDifficulty) / 3; // Scale: 1-5 -> 0.33-1.67
    const awayPenalty = 1 - (awayRatio * 0.1); // 10% penalty for away games

    return form * difficultyMultiplier * awayPenalty * numGW;
}

// Calculate removal priority score (Joshua Bull's algorithm)
function calculateRemovalScore(player, fixtures, currentGW) {
    const weights = {
        form: -0.4,        // Recent points (negative = bad form increases score)
        fixtures: -0.3,    // Difficulty of next 3 fixtures
        availability: -0.2, // Injury/suspension risk
        away: -0.1         // Proportion of away games
    };

    const form = getPlayerForm(player);
    const fixtureDifficulty = getFixtureDifficulty(player, fixtures, null, 3, currentGW);
    const availability = player.chance_of_playing_next_round || 100;
    const awayRatio = getAwayGameRatio(player, fixtures, 3, currentGW);

    // Higher score = prioritize for removal
    const formScore = form * weights.form;
    const fixtureScore = fixtureDifficulty * weights.fixtures;
    const availabilityScore = (100 - availability) / 100 * weights.availability;
    const awayScore = awayRatio * weights.away;

    const totalScore = formScore + fixtureScore + availabilityScore + awayScore;

    return {
        score: totalScore,
        form,
        fixtureDifficulty,
        availability,
        awayRatio
    };
}

// Get current team players from mock data
function getCurrentTeam(bootstrapData) {
    const { elements } = bootstrapData;

    // Map player IDs to full player objects
    const teamPlayers = MOCK_TEAM.players.map(playerId => {
        return elements.find(p => p.id === playerId);
    }).filter(p => p !== undefined);

    return teamPlayers;
}

// Analyze transfers and suggest optimal moves
function analyzeTransfers(bootstrapData, fixtures, currentGW) {
    const transferAnalysis = document.getElementById('transferAnalysis');

    if (!transferAnalysis) {
        console.log('Transfer analysis section not found in DOM');
        return;
    }

    try {
        transferAnalysis.innerHTML = '<p class="loading">Analyzing transfers...</p>';

        const { elements, teams } = bootstrapData;
        const currentTeam = getCurrentTeam(bootstrapData);

        if (currentTeam.length === 0) {
            transferAnalysis.innerHTML = '<p class="placeholder">No team data available</p>';
            return;
        }

        // Create team lookup
        const teamLookup = {};
        teams.forEach(team => {
            teamLookup[team.id] = team.short_name;
        });

        // Calculate removal scores for all current team players
        const teamWithScores = currentTeam.map(player => {
            const removalAnalysis = calculateRemovalScore(player, fixtures, currentGW);
            const expectedPoints = calculateExpectedPoints(player, fixtures, 3, currentGW);

            return {
                player,
                ...removalAnalysis,
                expectedPoints
            };
        });

        // Sort by removal score (highest = worst performers)
        const worstPerformers = teamWithScores
            .sort((a, b) => b.score - a.score)
            .slice(0, 3); // Top 3 candidates for removal

        // Find best replacements for each position
        const transferSuggestions = worstPerformers.map(underperformer => {
            const position = underperformer.player.element_type;
            const sellingPrice = underperformer.player.now_cost;
            const budget = sellingPrice + (MOCK_TEAM.bank * 10); // Convert bank to FPL price format

            // Find best replacements in same position
            const replacements = elements
                .filter(p => p.element_type === position)
                .filter(p => p.now_cost <= budget)
                .filter(p => !MOCK_TEAM.players.includes(p.id)) // Not already in team
                .map(p => ({
                    player: p,
                    expectedPoints: calculateExpectedPoints(p, fixtures, 3, currentGW)
                }))
                .sort((a, b) => b.expectedPoints - a.expectedPoints)
                .slice(0, 3); // Top 3 replacements

            return {
                out: underperformer,
                replacements
            };
        });

        // Display transfer analysis
        displayTransferAnalysis(transferSuggestions, teamLookup);

    } catch (error) {
        console.error('Error analyzing transfers:', error);
        transferAnalysis.innerHTML = `<p class="error">Error analyzing transfers: ${error.message}</p>`;
    }
}

// Display transfer analysis results
function displayTransferAnalysis(suggestions, teamLookup) {
    const transferAnalysis = document.getElementById('transferAnalysis');

    if (suggestions.length === 0) {
        transferAnalysis.innerHTML = '<p class="placeholder">No transfer suggestions available</p>';
        return;
    }

    let html = '<div class="transfer-results">';

    // Header
    html += '<div class="transfer-header">';
    html += '<h3>TRANSFER ANALYSIS</h3>';
    html += '<p class="transfer-subtitle">Remove underperformers based on form, fixtures, and availability</p>';
    html += '</div>';

    suggestions.forEach((suggestion, index) => {
        const outPlayer = suggestion.out.player;
        const outTeam = teamLookup[outPlayer.team];
        const outPrice = (outPlayer.now_cost / 10).toFixed(1);
        const outScore = suggestion.out;

        html += '<div class="transfer-suggestion">';

        // Player to remove
        html += '<div class="transfer-out">';
        html += `<div class="transfer-label">REMOVE #${index + 1}</div>`;
        html += `<div class="player-name">${outPlayer.web_name} (${outTeam}) - £${outPrice}m</div>`;
        html += `<div class="player-stats">`;
        html += `Form: ${outScore.form.toFixed(1)} | `;
        html += `Fixtures: ${outScore.fixtureDifficulty.toFixed(1)} avg | `;
        html += `Away: ${(outScore.awayRatio * 100).toFixed(0)}% | `;
        html += `Score: ${outScore.score.toFixed(2)}`;
        html += `</div>`;
        html += `<div class="expected-points">Expected: ${outScore.expectedPoints.toFixed(1)}pts (next 3 GW)</div>`;
        html += '</div>';

        // Best replacements
        if (suggestion.replacements.length > 0) {
            html += '<div class="transfer-in">';
            html += '<div class="transfer-label">BRING IN (Best Options)</div>';

            suggestion.replacements.forEach((replacement, idx) => {
                const inPlayer = replacement.player;
                const inTeam = teamLookup[inPlayer.team];
                const inPrice = (inPlayer.now_cost / 10).toFixed(1);
                const gain = replacement.expectedPoints - outScore.expectedPoints - 4; // Account for -4 hit
                const gainClass = gain > 0 ? 'positive' : 'negative';

                html += `<div class="replacement-option ${idx === 0 ? 'best' : ''}">`;
                html += `<span class="option-number">${idx + 1}.</span> `;
                html += `${inPlayer.web_name} (${inTeam}) - £${inPrice}m - `;
                html += `Expected: ${replacement.expectedPoints.toFixed(1)}pts | `;
                html += `<span class="net-gain ${gainClass}">Net: ${gain > 0 ? '+' : ''}${gain.toFixed(1)}pts</span>`;
                html += '</div>';
            });

            html += '</div>';
        }

        html += '</div>'; // End transfer-suggestion
    });

    html += '</div>'; // End transfer-results

    transferAnalysis.innerHTML = html;
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
