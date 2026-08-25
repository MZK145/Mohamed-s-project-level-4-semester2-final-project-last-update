module.exports = (err, req, res, next) => {
  console.error('Request error:', err.stack || err.message || err);

  const status = err.status || err.statusCode || 500;
  const message = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message || 'Something went wrong';

  res.status(status).json({ error: message });
};
