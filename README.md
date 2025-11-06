# FPL Optimizer - Step 1: Core Setup & API Integration

A Fantasy Premier League data viewer with API proxy and caching.

## Features

- **FPL API Proxy**: Vercel serverless functions handle CORS and proxy FPL API
- **Smart Caching**: localStorage with TTLs (5min for live, 1hr for static)
- **Simple Display**: Players shown as text: "Salah (LIV) - £12.5m - 107pts"
- **GitHub Pages Ready**: Static frontend, serverless backend

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

## Usage

1. Click "Load FPL Data" to fetch and display data
2. Data is cached automatically (check footer for TTL info)
3. Click "Refresh Data" to force fetch
4. Click "Clear Cache" to remove cached data

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS
- **Backend**: Vercel Serverless Functions (Node.js)
- **Caching**: localStorage with TTL
- **API**: Fantasy Premier League official API

## Next Steps (Step 2+)

- Team optimization algorithm
- Points projection
- Transfer suggestions
- Budget management
- Formation builder

## License

MIT
