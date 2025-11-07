# FPL Optimizer - Step 3: Enhanced Expected Points Model

A Fantasy Premier League optimizer with comprehensive Expected Points (xP) model and transfer analysis based on Joshua Bull's mathematical framework.

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

## Usage

1. Click "Load FPL Data" to fetch and display data
2. View top 50 players sorted by total points
3. Check upcoming fixtures with difficulty ratings
4. **NEW:** Review enhanced transfer suggestions with:
   - Top 3 underperformers identified by removal score
   - Best 3 replacements with full xP breakdown
   - Component analysis: Appearance, Goals, Assists, CS, Bonus
   - Confidence rating (High/Medium/Low) with color coding
   - Consistency rating based on form variance
   - **Click "▼ Details"** to expand full xP breakdown
   - Net gain/loss calculation including -4 hit penalty
5. Data is cached automatically (check footer for TTL info)
6. Click "Refresh Data" to force fetch
7. Click "Clear Cache" to remove cached data

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

## Next Steps (Step 4+)

- ✅ ~~Core API setup and caching~~
- ✅ ~~Transfer optimizer with underperformer removal~~
- ✅ ~~Enhanced Expected Points model with component breakdown~~
- 🔲 Team constraint validation (3 players per team max)
- 🔲 Formation optimizer (valid starting XI + bench)
- 🔲 Captain selection algorithm with EO consideration
- 🔲 Wildcard team builder with budget optimization
- 🔲 Chip strategy advisor (Triple Captain, Bench Boost, Free Hit)
- 🔲 Historical performance backtesting
- 🔲 Machine learning for bonus prediction
- 🔲 Differential identification (low ownership, high xP)

## License

MIT
