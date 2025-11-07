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

        // Store data globally for wildcard builder
        window.fplData = {
            bootstrap: bootstrapData,
            fixtures: fixturesData,
            currentGW
        };

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

// ============================================================================
// ENHANCED EXPECTED POINTS MODEL - Step 3
// ============================================================================

// Fixture difficulty multipliers (FDR 1-5)
const DIFFICULTY_MULTIPLIERS = {
    1: 1.30,  // Very easy - 30% boost
    2: 1.15,  // Easy - 15% boost
    3: 1.00,  // Medium - no change
    4: 0.85,  // Hard - 15% penalty
    5: 0.70   // Very hard - 30% penalty
};

// Adjust a value based on fixture difficulty
function adjustForFixture(baseValue, difficulty) {
    return baseValue * (DIFFICULTY_MULTIPLIERS[difficulty] || 1.0);
}

// Calculate appearance points probability
function calculateAppearancePoints(player, fixtures, numGW, currentGW, teams) {
    const teamId = player.team;
    const chanceOfPlaying = player.chance_of_playing_next_round || 100;
    const playProbability = chanceOfPlaying / 100;

    // Get fixtures for this player's team
    const teamFixtures = fixtures
        .filter(f => !f.finished && f.event >= (currentGW?.id || 1))
        .filter(f => f.team_h === teamId || f.team_a === teamId)
        .slice(0, numGW);

    // Assume 2 points per game if likely to play 60+ minutes
    const minutesPercent = player.minutes / (player.starts * 90 || 1);
    const fullGameProbability = minutesPercent > 0.66 ? 0.9 : 0.6;

    const appearancePoints = teamFixtures.length * 2 * playProbability * fullGameProbability;

    return {
        points: appearancePoints,
        games: teamFixtures.length,
        probability: playProbability
    };
}

// Calculate expected goals points
function calculateExpectedGoals(player, fixtures, numGW, currentGW, teams) {
    const teamId = player.team;
    const position = player.element_type; // 1=GK, 2=DEF, 3=MID, 4=FWD

    // Points per goal by position
    const goalPoints = {1: 10, 2: 6, 3: 5, 4: 4};
    const pointsPerGoal = goalPoints[position] || 4;

    // Use expected goals per 90 minutes
    const xGPer90 = parseFloat(player.expected_goals_per_90) || 0;

    if (xGPer90 === 0) return {points: 0, xG: 0, breakdown: []};

    // Get fixtures and adjust for difficulty
    const teamFixtures = fixtures
        .filter(f => !f.finished && f.event >= (currentGW?.id || 1))
        .filter(f => f.team_h === teamId || f.team_a === teamId)
        .slice(0, numGW);

    let totalGoalPoints = 0;
    const breakdown = [];

    teamFixtures.forEach(fixture => {
        const isHome = fixture.team_h === teamId;
        const difficulty = isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty;

        // Expected goals for this fixture
        const fixtureXG = xGPer90 * 1.0; // Assume 90 minutes
        const adjustedXG = adjustForFixture(fixtureXG, difficulty);
        const fixturePoints = adjustedXG * pointsPerGoal;

        totalGoalPoints += fixturePoints;
        breakdown.push({fixture, xG: adjustedXG, points: fixturePoints});
    });

    return {
        points: totalGoalPoints,
        xG: totalGoalPoints / pointsPerGoal,
        breakdown
    };
}

// Calculate expected assists points
function calculateExpectedAssists(player, fixtures, numGW, currentGW, teams) {
    const teamId = player.team;
    const xAPer90 = parseFloat(player.expected_assists_per_90) || 0;

    if (xAPer90 === 0) return {points: 0, xA: 0, breakdown: []};

    // All positions get 3 points per assist
    const pointsPerAssist = 3;

    // Get fixtures and adjust for difficulty
    const teamFixtures = fixtures
        .filter(f => !f.finished && f.event >= (currentGW?.id || 1))
        .filter(f => f.team_h === teamId || f.team_a === teamId)
        .slice(0, numGW);

    let totalAssistPoints = 0;
    const breakdown = [];

    teamFixtures.forEach(fixture => {
        const isHome = fixture.team_h === teamId;
        const difficulty = isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty;

        // Expected assists for this fixture
        const fixtureXA = xAPer90 * 1.0; // Assume 90 minutes
        const adjustedXA = adjustForFixture(fixtureXA, difficulty);
        const fixturePoints = adjustedXA * pointsPerAssist;

        totalAssistPoints += fixturePoints;
        breakdown.push({fixture, xA: adjustedXA, points: fixturePoints});
    });

    return {
        points: totalAssistPoints,
        xA: totalAssistPoints / pointsPerAssist,
        breakdown
    };
}

// Calculate clean sheet probability and points
function calculateCleanSheetPoints(player, fixtures, numGW, currentGW, teams) {
    const teamId = player.team;
    const position = player.element_type; // 1=GK, 2=DEF, 3=MID, 4=FWD

    // Only GK and DEF get clean sheet points
    const cleanSheetPoints = {1: 4, 2: 4, 3: 1, 4: 0};
    const pointsPerCS = cleanSheetPoints[position] || 0;

    if (pointsPerCS === 0) return {points: 0, probability: 0, breakdown: []};

    // Get team defensive strength
    const team = teams.find(t => t.id === teamId);
    if (!team) return {points: 0, probability: 0, breakdown: []};

    // Get fixtures
    const teamFixtures = fixtures
        .filter(f => !f.finished && f.event >= (currentGW?.id || 1))
        .filter(f => f.team_h === teamId || f.team_a === teamId)
        .slice(0, numGW);

    let totalCSPoints = 0;
    const breakdown = [];

    teamFixtures.forEach(fixture => {
        const isHome = fixture.team_h === teamId;
        const difficulty = isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty;

        // Base clean sheet probability (inverse of difficulty)
        // FDR 1 = 60%, FDR 2 = 50%, FDR 3 = 35%, FDR 4 = 25%, FDR 5 = 15%
        const baseProbability = {1: 0.60, 2: 0.50, 3: 0.35, 4: 0.25, 5: 0.15}[difficulty] || 0.35;

        // Adjust by team defensive strength (1-5 scale, normalize to 0.8-1.2)
        const defStrength = isHome ? team.strength_defence_home : team.strength_defence_away;
        const strengthMultiplier = 0.8 + (defStrength / 1000) * 0.4;

        const csProbability = Math.min(baseProbability * strengthMultiplier, 0.75); // Cap at 75%
        const fixturePoints = csProbability * pointsPerCS;

        totalCSPoints += fixturePoints;
        breakdown.push({fixture, probability: csProbability, points: fixturePoints});
    });

    return {
        points: totalCSPoints,
        probability: totalCSPoints / (teamFixtures.length * pointsPerCS),
        breakdown
    };
}

// Estimate bonus points based on ICT index
function estimateBonusPoints(player, fixtures, numGW, currentGW) {
    const teamId = player.team;
    const ictIndex = parseFloat(player.ict_index) || 0;

    if (ictIndex === 0) return {points: 0, ictIndex: 0};

    // Get number of fixtures
    const teamFixtures = fixtures
        .filter(f => !f.finished && f.event >= (currentGW?.id || 1))
        .filter(f => f.team_h === teamId || f.team_a === teamId)
        .slice(0, numGW);

    // Bonus probability based on ICT index
    // ICT > 50 = high chance (0.4 per game)
    // ICT 35-50 = medium chance (0.25 per game)
    // ICT 20-35 = low chance (0.1 per game)
    // ICT < 20 = very low (0.05 per game)
    let bonusPerGame = 0;
    if (ictIndex > 50) bonusPerGame = 0.4;
    else if (ictIndex > 35) bonusPerGame = 0.25;
    else if (ictIndex > 20) bonusPerGame = 0.1;
    else bonusPerGame = 0.05;

    // Average bonus points when achieved (usually 1-3, avg 2)
    const avgBonusValue = 2;

    const totalBonusPoints = teamFixtures.length * bonusPerGame * avgBonusValue;

    return {
        points: totalBonusPoints,
        ictIndex,
        probability: bonusPerGame
    };
}

// Calculate penalty for cards (yellow/red)
function calculateCardPenalty(player, numGW) {
    const yellowCards = player.yellow_cards || 0;
    const redCards = player.red_cards || 0;

    // Estimate card rate per game
    const gamesPlayed = player.starts || 1;
    const yellowRate = yellowCards / gamesPlayed;
    const redRate = redCards / gamesPlayed;

    // Yellow = -1, Red = -3
    const expectedPenalty = (yellowRate * -1 + redRate * -3) * numGW;

    return {
        points: expectedPenalty,
        yellowRate,
        redRate
    };
}

// Calculate player consistency (standard deviation of recent scores)
function calculateConsistency(player) {
    // Use form and variance as proxy for consistency
    const form = getPlayerForm(player);
    const pointsPerGame = parseFloat(player.points_per_game) || 0;

    // Low variance = high consistency
    // If form is close to ppg, player is consistent
    const variance = Math.abs(form - pointsPerGame);
    const consistency = Math.max(0, 1 - (variance / 5)); // Scale 0-1

    return {
        score: consistency,
        rating: consistency > 0.7 ? 'High' : consistency > 0.4 ? 'Medium' : 'Low'
    };
}

// Calculate confidence score for prediction
function calculateConfidence(player, xPComponents) {
    let confidence = 0.5; // Base 50%

    // Factor 1: Availability (30% weight)
    const availability = (player.chance_of_playing_next_round || 100) / 100;
    confidence += (availability - 0.5) * 0.3;

    // Factor 2: Minutes stability (25% weight)
    const minutesPlayed = player.minutes || 0;
    const minutesStability = Math.min(minutesPlayed / 270, 1); // 270 = 3 full games
    confidence += (minutesStability - 0.5) * 0.25;

    // Factor 3: Consistency (25% weight)
    const consistency = calculateConsistency(player);
    confidence += (consistency.score - 0.5) * 0.25;

    // Factor 4: Data quality (20% weight)
    const hasXG = parseFloat(player.expected_goals_per_90) > 0;
    const hasXA = parseFloat(player.expected_assists_per_90) > 0;
    const dataQuality = (hasXG && hasXA) ? 1 : (hasXG || hasXA) ? 0.7 : 0.3;
    confidence += (dataQuality - 0.5) * 0.2;

    // Clamp to 0-1 range
    confidence = Math.max(0, Math.min(1, confidence));

    return {
        score: confidence,
        rating: confidence > 0.7 ? 'High' : confidence > 0.4 ? 'Medium' : 'Low',
        color: confidence > 0.7 ? 'green' : confidence > 0.4 ? 'yellow' : 'red'
    };
}

// Main expected points calculation with full breakdown
function calculateExpectedPoints(player, fixtures, numGW = 3, currentGW, teams) {
    // Calculate all components
    const appearance = calculateAppearancePoints(player, fixtures, numGW, currentGW, teams);
    const goals = calculateExpectedGoals(player, fixtures, numGW, currentGW, teams);
    const assists = calculateExpectedAssists(player, fixtures, numGW, currentGW, teams);
    const cleanSheets = calculateCleanSheetPoints(player, fixtures, numGW, currentGW, teams);
    const bonus = estimateBonusPoints(player, fixtures, numGW, currentGW);
    const cards = calculateCardPenalty(player, numGW);

    // Sum all components
    const totalPoints = appearance.points + goals.points + assists.points +
                       cleanSheets.points + bonus.points + cards.points;

    // Calculate confidence
    const components = {appearance, goals, assists, cleanSheets, bonus, cards};
    const confidence = calculateConfidence(player, components);
    const consistency = calculateConsistency(player);

    return {
        total: totalPoints,
        components,
        confidence,
        consistency
    };
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
            const xPResult = calculateExpectedPoints(player, fixtures, 3, currentGW, teams);

            return {
                player,
                ...removalAnalysis,
                expectedPoints: xPResult.total,
                xPBreakdown: xPResult
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
                .map(p => {
                    const xPResult = calculateExpectedPoints(p, fixtures, 3, currentGW, teams);
                    return {
                        player: p,
                        expectedPoints: xPResult.total,
                        xPBreakdown: xPResult
                    };
                })
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

// Display transfer analysis results with enhanced xP breakdowns
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
    html += '<p class="transfer-subtitle">Enhanced Expected Points Model with Component Breakdown</p>';
    html += '</div>';

    suggestions.forEach((suggestion, index) => {
        const outPlayer = suggestion.out.player;
        const outTeam = teamLookup[outPlayer.team];
        const outPrice = (outPlayer.now_cost / 10).toFixed(1);
        const outScore = suggestion.out;
        const outXP = outScore.xPBreakdown;

        html += '<div class="transfer-suggestion">';

        // Player to remove
        html += '<div class="transfer-out">';
        html += `<div class="transfer-label">REMOVE #${index + 1}</div>`;
        html += `<div class="player-name">${outPlayer.web_name} (${outTeam}) - £${outPrice}m</div>`;

        // xP Breakdown for player to remove
        html += `<div class="xp-breakdown">`;
        html += `<div class="xp-total">Expected: ${outScore.expectedPoints.toFixed(1)}pts (next 3 GW)</div>`;
        html += `<div class="xp-components">`;
        html += `  Appearance: ${outXP.components.appearance.points.toFixed(1)} | `;
        html += `  Goals: ${outXP.components.goals.points.toFixed(1)} | `;
        html += `  Assists: ${outXP.components.assists.points.toFixed(1)} | `;
        html += `  CS: ${outXP.components.cleanSheets.points.toFixed(1)} | `;
        html += `  Bonus: ${outXP.components.bonus.points.toFixed(1)}`;
        html += `</div>`;
        html += `<div class="xp-confidence">`;
        html += `  Confidence: <span class="confidence-${outXP.confidence.color}">${outXP.confidence.rating}</span> `;
        html += `  | Consistency: ${outXP.consistency.rating}`;
        html += `</div>`;
        html += `</div>`;

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
                const inXP = replacement.xPBreakdown;

                html += `<div class="replacement-option ${idx === 0 ? 'best' : ''}" data-index="${index}-${idx}">`;

                // Main info
                html += `<div class="replacement-main">`;
                html += `<span class="option-number">${idx + 1}.</span> `;
                html += `${inPlayer.web_name} (${inTeam}) - £${inPrice}m - `;
                html += `Expected: ${replacement.expectedPoints.toFixed(1)}pts | `;
                html += `<span class="net-gain ${gainClass}">Net: ${gain > 0 ? '+' : ''}${gain.toFixed(1)}pts</span>`;
                html += ` <button class="toggle-breakdown" onclick="toggleBreakdown('${index}-${idx}')">▼ Details</button>`;
                html += `</div>`;

                // Detailed breakdown (hidden by default)
                html += `<div class="xp-detail" id="breakdown-${index}-${idx}" style="display: none;">`;
                html += `<div class="xp-detail-header">Expected Points Breakdown:</div>`;
                html += `<div class="xp-detail-row">`;
                html += `  <span class="xp-component">Appearance:</span> `;
                html += `  <span class="xp-value">${inXP.components.appearance.points.toFixed(1)}pts</span>`;
                html += `  <span class="xp-explain">(${(inXP.components.appearance.probability * 100).toFixed(0)}% to play ${inXP.components.appearance.games} games)</span>`;
                html += `</div>`;
                html += `<div class="xp-detail-row">`;
                html += `  <span class="xp-component">Goals:</span> `;
                html += `  <span class="xp-value">${inXP.components.goals.points.toFixed(1)}pts</span>`;
                html += `  <span class="xp-explain">(${inXP.components.goals.xG.toFixed(2)} xG)</span>`;
                html += `</div>`;
                html += `<div class="xp-detail-row">`;
                html += `  <span class="xp-component">Assists:</span> `;
                html += `  <span class="xp-value">${inXP.components.assists.points.toFixed(1)}pts</span>`;
                html += `  <span class="xp-explain">(${inXP.components.assists.xA.toFixed(2)} xA)</span>`;
                html += `</div>`;
                html += `<div class="xp-detail-row">`;
                html += `  <span class="xp-component">Clean Sheets:</span> `;
                html += `  <span class="xp-value">${inXP.components.cleanSheets.points.toFixed(1)}pts</span>`;
                html += `  <span class="xp-explain">(${(inXP.components.cleanSheets.probability * 100).toFixed(0)}% probability)</span>`;
                html += `</div>`;
                html += `<div class="xp-detail-row">`;
                html += `  <span class="xp-component">Bonus:</span> `;
                html += `  <span class="xp-value">${inXP.components.bonus.points.toFixed(1)}pts</span>`;
                html += `  <span class="xp-explain">(ICT: ${inXP.components.bonus.ictIndex.toFixed(1)})</span>`;
                html += `</div>`;
                if (inXP.components.cards.points !== 0) {
                    html += `<div class="xp-detail-row">`;
                    html += `  <span class="xp-component">Cards:</span> `;
                    html += `  <span class="xp-value">${inXP.components.cards.points.toFixed(1)}pts</span>`;
                    html += `  <span class="xp-explain">(penalty)</span>`;
                    html += `</div>`;
                }
                html += `<div class="xp-detail-footer">`;
                html += `  Confidence: <span class="confidence-${inXP.confidence.color}">${inXP.confidence.rating}</span> `;
                html += `  | Consistency: ${inXP.consistency.rating}`;
                html += `</div>`;
                html += `</div>`; // End xp-detail

                html += '</div>'; // End replacement-option
            });

            html += '</div>';
        }

        html += '</div>'; // End transfer-suggestion
    });

    html += '</div>'; // End transfer-results

    transferAnalysis.innerHTML = html;
}

// Toggle breakdown visibility
function toggleBreakdown(id) {
    const breakdown = document.getElementById(`breakdown-${id}`);
    const button = event.target;

    if (breakdown.style.display === 'none') {
        breakdown.style.display = 'block';
        button.textContent = '▲ Details';
    } else {
        breakdown.style.display = 'none';
        button.textContent = '▼ Details';
    }
}

// ============================================================================
// TEAM OPTIMIZATION - Step 4: Knapsack Solver for Optimal Team
// ============================================================================

// Valid FPL formations (DEF, MID, FWD)
const VALID_FORMATIONS = [
    [3, 4, 3], [3, 5, 2], [4, 3, 3],
    [4, 4, 2], [4, 5, 1], [5, 3, 2], [5, 4, 1]
];

// Position requirements for a full 15-player squad
const SQUAD_REQUIREMENTS = {
    1: 2,  // Goalkeepers
    2: 5,  // Defenders
    3: 5,  // Midfielders
    4: 3   // Forwards
};

// Validate formation
function validateFormation(defenders, midfielders, forwards) {
    return VALID_FORMATIONS.some(f =>
        f[0] === defenders && f[1] === midfielders && f[2] === forwards
    );
}

// Calculate value ratio (xP per million)
function calculateValueRatio(player, xP) {
    const price = player.now_cost / 10; // Convert to actual price
    if (price === 0) return 0;
    return xP / price;
}

// Optimize team with greedy knapsack approach
function optimizeTeam(allPlayers, fixtures, currentGW, teams, budget = 100.0) {
    // Calculate xP for all players
    const playersWithXP = allPlayers.map(player => {
        const xPResult = calculateExpectedPoints(player, fixtures, 3, currentGW, teams);
        const valueRatio = calculateValueRatio(player, xPResult.total);

        return {
            player,
            xP: xPResult.total,
            xPBreakdown: xPResult,
            valueRatio,
            price: player.now_cost / 10,
            position: player.element_type,
            team: player.team
        };
    });

    // Sort by value ratio within each position
    const byPosition = {1: [], 2: [], 3: [], 4: []};
    playersWithXP.forEach(p => {
        byPosition[p.position].push(p);
    });

    // Sort each position by value ratio
    Object.keys(byPosition).forEach(pos => {
        byPosition[pos].sort((a, b) => b.valueRatio - a.valueRatio);
    });

    // Try all valid formations and find the best
    let bestTeam = null;
    let bestPoints = 0;

    VALID_FORMATIONS.forEach(formation => {
        const team = buildTeamForFormation(byPosition, formation, budget, teams);
        if (team && team.totalXP > bestPoints) {
            bestTeam = team;
            bestPoints = team.totalXP;
        }
    });

    return bestTeam;
}

// Build optimal team for a specific formation
function buildTeamForFormation(byPosition, formation, budget, teams) {
    const [defenders, midfielders, forwards] = formation;
    const selected = [];
    const teamCounts = {};
    let remainingBudget = budget;

    // Helper to check team constraint (max 3 per team)
    const canAddPlayer = (player) => {
        const count = teamCounts[player.team] || 0;
        return count < 3;
    };

    // Helper to add player
    const addPlayer = (player) => {
        selected.push(player);
        remainingBudget -= player.price;
        teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
    };

    // Select players by position
    // 1. Goalkeepers (2 needed - 1 starter + 1 bench)
    let gkCount = 0;
    for (const p of byPosition[1]) {
        if (gkCount >= 2) break;
        if (p.price <= remainingBudget && canAddPlayer(p.player)) {
            addPlayer(p);
            gkCount++;
        }
    }
    if (gkCount < 2) return null; // Can't build valid team

    // 2. Defenders (need formation[0] starters + more for bench up to 5 total)
    let defCount = 0;
    for (const p of byPosition[2]) {
        if (defCount >= 5) break;
        if (p.price <= remainingBudget && canAddPlayer(p.player)) {
            addPlayer(p);
            defCount++;
        }
    }
    if (defCount < defenders) return null; // Not enough for formation

    // 3. Midfielders (need formation[1] starters + more for bench up to 5 total)
    let midCount = 0;
    for (const p of byPosition[3]) {
        if (midCount >= 5) break;
        if (p.price <= remainingBudget && canAddPlayer(p.player)) {
            addPlayer(p);
            midCount++;
        }
    }
    if (midCount < midfielders) return null; // Not enough for formation

    // 4. Forwards (need formation[2] starters + more for bench up to 3 total)
    let fwdCount = 0;
    for (const p of byPosition[4]) {
        if (fwdCount >= 3) break;
        if (p.price <= remainingBudget && canAddPlayer(p.player)) {
            addPlayer(p);
            fwdCount++;
        }
    }
    if (fwdCount < forwards) return null; // Not enough for formation

    // Check if we have exactly 15 players
    if (selected.length !== 15) return null;

    // Split into starting XI and bench
    // Starting XI: 1 GK + formation defenders/mids/forwards (sorted by xP)
    const gks = selected.filter(p => p.position === 1).sort((a, b) => b.xP - a.xP);
    const defs = selected.filter(p => p.position === 2).sort((a, b) => b.xP - a.xP);
    const mids = selected.filter(p => p.position === 3).sort((a, b) => b.xP - a.xP);
    const fwds = selected.filter(p => p.position === 4).sort((a, b) => b.xP - a.xP);

    const startingXI = [
        gks[0],
        ...defs.slice(0, defenders),
        ...mids.slice(0, midfielders),
        ...fwds.slice(0, forwards)
    ];

    const bench = [
        gks[1],
        ...defs.slice(defenders),
        ...mids.slice(midfielders),
        ...fwds.slice(forwards)
    ];

    const totalCost = budget - remainingBudget;
    const totalXP = startingXI.reduce((sum, p) => sum + p.xP, 0);

    return {
        startingXI,
        bench,
        formation,
        totalCost,
        totalXP,
        teamCounts,
        remainingBudget
    };
}

// Optimize wildcard team (called when user clicks "Build Optimal Team")
function optimizeWildcard(bootstrapData, fixtures, currentGW) {
    const wildcardSection = document.getElementById('wildcardTeam');

    if (!wildcardSection) {
        console.log('Wildcard section not found in DOM');
        return;
    }

    try {
        wildcardSection.innerHTML = '<p class="loading">Optimizing team...</p>';

        const { elements, teams } = bootstrapData;

        // Run optimization
        const optimalTeam = optimizeTeam(elements, fixtures, currentGW, teams, 100.0);

        if (!optimalTeam) {
            wildcardSection.innerHTML = '<p class="error">Could not build optimal team within constraints</p>';
            return;
        }

        // Display optimal team
        displayOptimalTeam(optimalTeam, teams);

    } catch (error) {
        console.error('Error optimizing team:', error);
        wildcardSection.innerHTML = `<p class="error">Error: ${error.message}</p>`;
    }
}

// Display optimal team in formation layout
function displayOptimalTeam(team, teams) {
    const wildcardSection = document.getElementById('wildcardTeam');

    // Create team lookup
    const teamLookup = {};
    teams.forEach(t => {
        teamLookup[t.id] = t.short_name;
    });

    const [defs, mids, fwds] = team.formation;

    let html = '<div class="wildcard-results">';

    // Header
    html += '<div class="wildcard-header">';
    html += `<h3>OPTIMAL WILDCARD TEAM (${defs}-${mids}-${fwds})</h3>`;
    html += `<div class="team-summary">`;
    html += `<span class="summary-item">Cost: £${team.totalCost.toFixed(1)}m</span>`;
    html += `<span class="summary-item">Expected: ${team.totalXP.toFixed(1)}pts/GW</span>`;
    html += `<span class="summary-item">Budget Left: £${team.remainingBudget.toFixed(1)}m</span>`;
    html += `</div>`;
    html += '</div>';

    // Formation display
    html += '<div class="formation-pitch">';

    // Goalkeeper
    const gk = team.startingXI.filter(p => p.position === 1)[0];
    html += '<div class="formation-row gk-row">';
    html += formatPlayerCard(gk, teamLookup);
    html += '</div>';

    // Defenders
    const defenders = team.startingXI.filter(p => p.position === 2);
    html += '<div class="formation-row def-row">';
    defenders.forEach(p => html += formatPlayerCard(p, teamLookup));
    html += '</div>';

    // Midfielders
    const midfielders = team.startingXI.filter(p => p.position === 3);
    html += '<div class="formation-row mid-row">';
    midfielders.forEach(p => html += formatPlayerCard(p, teamLookup));
    html += '</div>';

    // Forwards
    const forwards = team.startingXI.filter(p => p.position === 4);
    html += '<div class="formation-row fwd-row">';
    forwards.forEach(p => html += formatPlayerCard(p, teamLookup));
    html += '</div>';

    html += '</div>'; // End formation-pitch

    // Bench
    html += '<div class="bench-section">';
    html += '<div class="bench-label">BENCH</div>';
    html += '<div class="bench-players">';
    team.bench.forEach(p => html += formatPlayerCard(p, teamLookup, true));
    html += '</div>';
    html += '</div>';

    // Team counts (3 per team check)
    html += '<div class="team-distribution">';
    html += '<div class="dist-label">Team Distribution:</div>';
    Object.entries(team.teamCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([teamId, count]) => {
            html += `<span class="team-count">${teamLookup[teamId]}: ${count}</span>`;
        });
    html += '</div>';

    html += '</div>'; // End wildcard-results

    wildcardSection.innerHTML = html;
}

// Format player card for display
function formatPlayerCard(playerData, teamLookup, isBench = false) {
    const player = playerData.player;
    const teamCode = teamLookup[player.team];
    const price = playerData.price.toFixed(1);
    const xP = playerData.xP.toFixed(1);
    const confidence = playerData.xPBreakdown.confidence;

    let html = `<div class="player-card ${isBench ? 'bench-card' : ''}">`;
    html += `<div class="player-card-name">${player.web_name}</div>`;
    html += `<div class="player-card-team">(${teamCode})</div>`;
    html += `<div class="player-card-price">£${price}m</div>`;
    html += `<div class="player-card-xp">${xP}pts</div>`;
    html += `<div class="player-card-conf confidence-${confidence.color}">${confidence.rating[0]}</div>`;
    html += `</div>`;

    return html;
}

// Build optimal wildcard team (called when user clicks the button)
function buildWildcard() {
    if (!window.fplData) {
        alert('Please load FPL data first');
        return;
    }

    const { bootstrap, fixtures, currentGW } = window.fplData;
    optimizeWildcard(bootstrap, fixtures, currentGW);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loadDataBtn').addEventListener('click', loadFPLData);
    document.getElementById('clearCacheBtn').addEventListener('click', clearCache);

    // Wildcard builder button (if exists)
    const wildcardBtn = document.getElementById('buildWildcardBtn');
    if (wildcardBtn) {
        wildcardBtn.addEventListener('click', buildWildcard);
    }

    // Update cache status on load
    updateCacheStatus();

    // Auto-load data if cache exists
    if (CacheManager.isValid('fpl_bootstrap', CACHE_TTL.STATIC)) {
        console.log('Loading from cache on page load');
        loadFPLData();
    }
});
