// Proxy for FPL live gameweek data
// Returns live points for a specific gameweek

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get gameweek from query parameter
    const { gw } = req.query;

    if (!gw) {
      return res.status(400).json({
        error: 'Missing gameweek parameter',
        message: 'Please provide a gameweek number using ?gw=X'
      });
    }

    const response = await fetch(`https://fantasy.premierleague.com/api/event/${gw}/live/`);

    if (!response.ok) {
      throw new Error(`FPL API responded with status: ${response.status}`);
    }

    const data = await response.json();

    // Cache for 5 minutes (live data)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching live event data:', error);
    return res.status(500).json({
      error: 'Failed to fetch live gameweek data',
      message: error.message
    });
  }
}
