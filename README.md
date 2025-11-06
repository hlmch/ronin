# FPL Optimizer - Step 2: Transfer Optimizer Implementation

A Fantasy Premier League optimizer with transfer analysis based on Joshua Bull's "remove underperformers" strategy.

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

### Expected Points Calculation:
```javascript
xP = form × difficulty_multiplier × away_penalty × num_gameweeks
```

## Usage

1. Click "Load FPL Data" to fetch and display data
2. View top 50 players sorted by total points
3. Check upcoming fixtures with difficulty ratings
4. **NEW:** Review transfer suggestions with:
   - Top 3 underperformers in your team
   - Best 3 replacements for each position
   - Expected points for next 3 gameweeks
   - Net gain/loss after -4 hit
5. Data is cached automatically (check footer for TTL info)
6. Click "Refresh Data" to force fetch
7. Click "Clear Cache" to remove cached data

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

## Next Steps (Step 3+)

- ✅ ~~Core API setup and caching~~
- ✅ ~~Transfer optimizer with underperformer removal~~
- 🔲 Team constraint validation (3 players per team max)
- 🔲 Formation optimizer (valid starting XI)
- 🔲 Captain selection algorithm
- 🔲 Wildcard team builder
- 🔲 Points projection with statistical models
- 🔲 Historical performance analysis

## License

MIT
