// Proxy for FPL picks endpoint
// Returns user's team picks for a specific gameweek

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { teamId, gw } = req.query;

  if (!teamId) {
    return res.status(400).json({ error: 'Team ID is required' });
  }

  try {
    // If no gameweek specified, get current picks
    const url = gw
      ? `https://fantasy.premierleague.com/api/entry/${teamId}/event/${gw}/picks/`
      : `https://fantasy.premierleague.com/api/entry/${teamId}/`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`FPL API responded with status: ${response.status}`);
    }

    const data = await response.json();

    // Cache for 5 minutes
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching picks:', error);
    return res.status(500).json({
      error: 'Failed to fetch picks',
      message: error.message
    });
  }
}
