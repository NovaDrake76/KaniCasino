const checkApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const expected = process.env.API_KEY;

  // with no key configured, `undefined === undefined` would wave everyone through
  if (!expected) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  if (apiKey === expected) {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden' });
  }
};

module.exports = checkApiKey;
