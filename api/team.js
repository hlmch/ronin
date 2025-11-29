// Proxy for FPL team endpoint
// Returns user's team data

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { teamId } = req.query;

  if (!teamId) {
    return res.status(400).json({ error: 'Team ID is required' });
  }

  try {
    const response = await fetch(`https://fantasy.premierleague.com/api/entry/${teamId}/`);

    if (!response.ok) {
      // Pass through the original status code from FPL API
      const status = response.status;
      let errorMessage = `FPL API responded with status: ${status}`;

      if (status === 404) {
        errorMessage = `Team ID ${teamId} not found. Please check your Team ID is correct.`;
      } else if (status === 503) {
        errorMessage = 'FPL API is temporarily unavailable. Please try again later.';
      }

      return res.status(status).json({
        error: 'Failed to fetch team data',
        message: errorMessage
      });
    }

    const data = await response.json();

    // Cache for 5 minutes (team data changes frequently)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching team data:', error);
    return res.status(500).json({
      error: 'Failed to fetch team data',
      message: error.message || 'Network error - unable to connect to FPL API'
    });
  }
}
