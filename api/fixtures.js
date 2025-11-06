// Proxy for FPL fixtures endpoint
// Returns upcoming fixtures with difficulty ratings

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
    const response = await fetch('https://fantasy.premierleague.com/api/fixtures/');

    if (!response.ok) {
      throw new Error(`FPL API responded with status: ${response.status}`);
    }

    const data = await response.json();

    // Cache for 1 hour (static data)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    return res.status(500).json({
      error: 'Failed to fetch fixtures data',
      message: error.message
    });
  }
}
