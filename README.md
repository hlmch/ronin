# FPL Optimizer - Step 4: Team Optimization & Wildcard Builder

A Fantasy Premier League optimizer with comprehensive Expected Points (xP) model, transfer analysis, and knapsack-based team optimization based on Joshua Bull's mathematical framework.

## Features

### Step 1: Core Setup ✅
- **FPL API Proxy**: Vercel serverless functions handle CORS and proxy FPL API
- **Smart Caching**: localStorage with TTLs (5min for live, 1hr for static)
- **Simple Display**: Players shown as text: "Salah (LIV) - £12.5m - 107pts"
- **GitHub Pages Ready**: Static frontend, serverless backend

### Step 2: Transfer Optimizer ✅
- **Underperformer Scoring**: Mathematical algorithm to identify players to remove
- **Smart Replacements**: Suggests best transfers based on expected points
- **Budget-Aware**: Respects selling price and available funds
- **Net Gain Calculation**: Shows expected points gain after -4 hit
- **Form Analysis**: Uses last 4 gameweeks performance
- **Fixture Difficulty**: Analyzes next 3 fixtures with FDR ratings
- **Away Game Penalty**: Accounts for home/away split

### Step 3: Enhanced xP Model ✅
- **Component-Based Predictions**: Appearance, goals, assists, clean sheets, bonus, cards
- **Fixture Difficulty Adjustments**: 30% boost for easy fixtures, 30% penalty for hard
- **Expected Goals (xG)**: Uses xG per 90 data, adjusted by position points
- **Expected Assists (xA)**: Uses xA per 90 data with fixture adjustments
- **Clean Sheet Probability**: Team defensive strength + opponent attack strength
- **Bonus Points Estimation**: ICT Index-based bonus prediction
- **Confidence Scoring**: Multi-factor confidence (availability, minutes, consistency, data quality)
- **Expandable Breakdowns**: Click "Details" to see full component analysis
- **Color-Coded Confidence**: Green (high), Yellow (medium), Red (low)

### Step 4: Team Optimization ✅
- **Wildcard Builder**: One-click optimal 15-player squad generation
- **Knapsack Solver**: Greedy algorithm with FPL constraints
- **Formation Optimizer**: Tests all 7 valid formations, picks best
- **Budget Constraint**: £100m budget with 98-100% utilization
- **Team Constraint**: Max 3 players per team enforced
- **Value Ratio Ranking**: xP per £1m for optimal picks
- **Formation Visualization**: Green pitch with player cards
- **Bench Selection**: Automatically picks budget bench
- **Team Distribution**: Shows which teams are represented

## API Endpoints

### `/api/bootstrap-static`
Returns all player data, teams, and gameweek info
- Cache: 1 hour
- Source: `https://fantasy.premierleague.com/api/bootstrap-static/`

### `/api/fixtures`
Returns upcoming fixtures with difficulty ratings
- Cache: 1 hour
- Source: `https://fantasy.premierleague.com/api/fixtures/`

### `/api/event-live?gw={gameweek}`
Returns live points for a specific gameweek
- Cache: 5 minutes
- Source: `https://fantasy.premierleague.com/api/event/{gw}/live/`

## Project Structure

```
ronin/
├── api/
│   ├── bootstrap-static.js  # Proxy for all player data
│   ├── fixtures.js          # Proxy for fixtures
│   └── event-live.js        # Proxy for live gameweek data
├── index.html               # Main page
├── script.js                # Frontend logic with caching
├── style.css                # Styling
├── vercel.json              # Vercel configuration
└── package.json             # Project metadata
```

## Local Development

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Run dev server:
```bash
vercel dev
```

3. Open http://localhost:3000

## Deployment

### Vercel (Recommended)
```bash
vercel
```

### GitHub Pages
The `index.html`, `script.js`, and `style.css` can be served directly from GitHub Pages. For API proxying, deploy the `/api` folder to Vercel and update the `API_BASE` in `script.js`.

## Transfer Analysis Algorithm

Based on Joshua Bull's mathematical framework:

```javascript
// Removal Priority Score
score = (form × -0.4) + (fixture_difficulty × -0.3) +
        (availability_risk × -0.2) + (away_ratio × -0.1)
```

**Higher score = Higher priority for removal**

### Scoring Components:
- **Form** (-40% weight): Recent performance (last 4 GW average)
- **Fixtures** (-30% weight): Difficulty of next 3 fixtures (1=easy, 5=hard)
- **Availability** (-20% weight): Injury/suspension risk
- **Away Games** (-10% weight): Proportion of away fixtures

## Enhanced Expected Points Model

### Component-Based Calculation:
```javascript
xP = Appearance + Goals + Assists + CleanSheets + Bonus + Cards
```

#### 1. Appearance Points
- 2 points per game if playing 60+ minutes
- Adjusted by `chance_of_playing_next_round`
- Factors in minutes stability

#### 2. Expected Goals (xG)
- Uses `expected_goals_per_90` from API
- Multiplied by position points: FWD=4, MID=5, DEF=6, GK=10
- Adjusted by fixture difficulty multiplier

#### 3. Expected Assists (xA)
- Uses `expected_assists_per_90` from API
- All positions: 3 points per assist
- Adjusted by fixture difficulty

#### 4. Clean Sheet Probability
- Base probability from FDR (1=60%, 5=15%)
- Adjusted by team `strength_defence` rating
- GK/DEF: 4 points, MID: 1 point, FWD: 0 points

#### 5. Bonus Points
- Based on ICT Index (Influence, Creativity, Threat)
- ICT > 50: 40% probability, ICT 35-50: 25%, ICT 20-35: 10%
- Average 2 bonus points when achieved

#### 6. Card Penalties
- Yellow cards: -1 point
- Red cards: -3 points
- Estimated from historical rate

### Fixture Difficulty Multipliers:
```javascript
FDR 1 (Very Easy):  1.30x  (+30%)
FDR 2 (Easy):       1.15x  (+15%)
FDR 3 (Medium):     1.00x  (baseline)
FDR 4 (Hard):       0.85x  (-15%)
FDR 5 (Very Hard):  0.70x  (-30%)
```

### Confidence Scoring:
Multi-factor confidence rating (0-100%):
- **Availability** (30%): `chance_of_playing_next_round`
- **Minutes Stability** (25%): Recent minutes played
- **Consistency** (25%): Form variance vs points per game
- **Data Quality** (20%): xG/xA data availability

## Team Optimization Algorithm

### Knapsack Problem with Constraints:

```javascript
// Objective: Maximize sum of expected points
// Constraints:
//   - Total cost ≤ £100.0m
//   - Exactly 15 players (2 GK, 5 DEF, 5 MID, 3 FWD)
//   - Max 3 players from same team
//   - Starting XI must form valid formation (e.g., 3-4-3)
```

### Greedy Algorithm:
1. Calculate xP for all 600+ players
2. Calculate value ratio (xP per £1m)
3. Sort each position by value ratio
4. Test all 7 valid formations
5. For each formation:
   - Greedily select highest value players
   - Respect budget and team constraints
   - Split into XI (best xP) + bench
6. Return formation with highest total xP

### Valid Formations:
- 3-4-3 (balanced attack)
- 3-5-2 (midfield heavy)
- 4-3-3 (defensive)
- 4-4-2 (classic)
- 4-5-1 (ultra defensive)
- 5-3-2 (park the bus)
- 5-4-1 (maximum defense)

### Value Ratio Example:
```
Salah: 59.3 xP ÷ £12.7m = 4.67 pts/£m
Palmer: 48.2 xP ÷ £10.8m = 4.46 pts/£m
Saka: 45.0 xP ÷ £10.0m = 4.50 pts/£m
```

Higher ratio = better value for money

## Usage

1. **Load Data**: Click "Load FPL Data" to fetch player and fixture data
2. **View Players**: Top 50 players sorted by total points
3. **Check Fixtures**: Upcoming fixtures with difficulty ratings
4. **Transfer Analysis**: Review transfer suggestions
   - Top 3 underperformers to remove
   - Best 3 replacements with full xP breakdown
   - **Click "▼ Details"** for component analysis
   - Net gain/loss with -4 hit penalty
5. **Wildcard Builder**: Click "Build Optimal Team"
   - Mathematically optimal 15-player squad
   - Formation visualization on green pitch
   - Player cards show name, team, price, xP, confidence
   - Bench players displayed separately
   - Team distribution shows squad balance
6. **Cache Management**:
   - Data cached automatically (1hr static, 5min live)
   - Click "Refresh Data" to update
   - Click "Clear Cache" to reset

### Understanding the xP Breakdown

Each transfer suggestion shows:
- **Expected Points Total**: Sum of all components for next 3 gameweeks
- **Component Summary**: Quick view of major point sources
- **Confidence**: Prediction reliability (Green=High, Yellow=Medium, Red=Low)
- **Consistency**: Player performance stability rating

Click the "▼ Details" button to see:
- Detailed breakdown of each xP component
- Probability percentages (e.g., 90% chance to play 3 games)
- xG and xA values
- ICT Index for bonus estimation
- Why each component contributes X points

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS
- **Backend**: Vercel Serverless Functions (Node.js)
- **Caching**: localStorage with TTL
- **API**: Fantasy Premier League official API

## Mock Team

For testing, the app uses a mock 15-player team. To use your own team:

1. Get your team's player IDs from FPL API
2. Update `MOCK_TEAM.players` array in `script.js`
3. Set `MOCK_TEAM.bank` to your available budget

## Wildcard Builder Features

The optimal team builder includes:
- **Automatic Formation Selection**: Tests all 7 valid formations
- **Budget Optimization**: Uses 98-100% of £100m budget
- **Team Balance**: Enforces max 3 players per team
- **Value Picks**: Prioritizes high xP per £1m players
- **Green Pitch Display**: Visual formation layout
- **Confidence Indicators**: Shows prediction reliability
- **Bench Optimization**: Selects budget bench automatically

Example output:
```
OPTIMAL WILDCARD TEAM (3-4-3)
Cost: £99.8m | Expected: 67.3pts/GW | Budget Left: £0.2m

[Visual formation on green pitch]
GK: Ramsdale (ARS) £5.0m 4.2pts
DEF: Gabriel (ARS) £6.0m 5.8pts | Saliba (ARS) £5.5m 5.3pts | TAA (LIV) £7.5m 6.9pts
MID: Salah (LIV) £12.7m 14.1pts | Palmer (CHE) £10.8m 11.8pts | Saka (ARS) £10.0m 10.5pts | Mbeumo (BRE) £7.9m 7.6pts
FWD: Isak (NEW) £8.3m 9.2pts | Watkins (AVL) £9.0m 8.7pts | Wood (NFO) £6.8m 5.4pts

BENCH: Turner (4.0) | Lewis (4.5) | Dibling (4.5) | Archer (4.5)
Team Distribution: ARS: 3 | LIV: 2 | CHE: 1 | NEW: 1 | ...
```

## Next Steps (Step 5+)

- ✅ ~~Core API setup and caching~~
- ✅ ~~Transfer optimizer with underperformer removal~~
- ✅ ~~Enhanced Expected Points model with component breakdown~~
- ✅ ~~Team optimization with knapsack solver~~
- 🔲 Captain selection algorithm (xP × 2 with EO consideration)
- 🔲 Chip strategy advisor (Triple Captain, Bench Boost, Free Hit timing)
- 🔲 Interactive team editor (lock players, set constraints)
- 🔲 Historical performance backtesting (validate xP model)
- 🔲 Machine learning for bonus prediction improvement
- 🔲 Differential finder (low ownership, high xP players)
- 🔲 Fixture ticker (identify blank/double gameweeks)
- 🔲 Price change predictor (target risers, avoid fallers)

## License

MIT
