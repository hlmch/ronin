const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Enable CORS
app.use(cors());

// Serve static files
app.use(express.static(__dirname));

// API Proxy Routes
app.get('/api/bootstrap-static', async (req, res) => {
  try {
    const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=7200, stale-while-revalidate');
    res.json(data);
  } catch (error) {
    console.error('Error fetching bootstrap data:', error);
    res.status(500).json({ error: 'Failed to fetch bootstrap data', message: error.message });
  }
});

app.get('/api/fixtures', async (req, res) => {
  try {
    const response = await fetch('https://fantasy.premierleague.com/api/fixtures/');
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=7200, stale-while-revalidate');
    res.json(data);
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    res.status(500).json({ error: 'Failed to fetch fixtures', message: error.message });
  }
});

app.get('/api/team', async (req, res) => {
  const { teamId } = req.query;

  if (!teamId) {
    return res.status(400).json({ error: 'Team ID is required' });
  }

  try {
    const response = await fetch(`https://fantasy.premierleague.com/api/entry/${teamId}/`);

    if (!response.ok) {
      throw new Error(`FPL API responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.json(data);
  } catch (error) {
    console.error('Error fetching team data:', error);
    res.status(500).json({ error: 'Failed to fetch team data', message: error.message });
  }
});

app.get('/api/picks', async (req, res) => {
  const { teamId, gw } = req.query;

  if (!teamId) {
    return res.status(400).json({ error: 'Team ID is required' });
  }

  try {
    const gwParam = gw ? `/${gw}` : '';
    const response = await fetch(`https://fantasy.premierleague.com/api/entry/${teamId}/event${gwParam}/picks/`);

    if (!response.ok) {
      throw new Error(`FPL API responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.json(data);
  } catch (error) {
    console.error('Error fetching picks data:', error);
    res.status(500).json({ error: 'Failed to fetch picks data', message: error.message });
  }
});

app.get('/api/event-live', async (req, res) => {
  const { gw } = req.query;

  if (!gw) {
    return res.status(400).json({ error: 'Gameweek is required' });
  }

  try {
    const response = await fetch(`https://fantasy.premierleague.com/api/event/${gw}/live/`);

    if (!response.ok) {
      throw new Error(`FPL API responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.json(data);
  } catch (error) {
    console.error('Error fetching live event data:', error);
    res.status(500).json({ error: 'Failed to fetch live event data', message: error.message });
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 FPL Optimizer running at http://localhost:${PORT}`);
  console.log(`\n📊 API endpoints available at http://localhost:${PORT}/api/*`);
  console.log(`\n✨ Futuristic Cyberpunk theme loaded!\n`);
});
