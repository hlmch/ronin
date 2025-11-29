// Proxy for FPL bootstrap-static endpoint
// Returns all player data, teams, and gameweek information

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
    const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');

    if (!response.ok) {
      // Pass through the original status code from FPL API
      const status = response.status;
      let errorMessage = `FPL API responded with status: ${status}`;

      if (status === 503) {
        errorMessage = 'FPL API is temporarily unavailable. Please try again later.';
      }

      return res.status(status).json({
        error: 'Failed to fetch FPL data',
        message: errorMessage
      });
    }

    const data = await response.json();

    // Cache for 1 hour (static data)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching bootstrap-static:', error);
    return res.status(500).json({
      error: 'Failed to fetch FPL data',
      message: error.message || 'Network error - unable to connect to FPL API'
    });
  }
}
