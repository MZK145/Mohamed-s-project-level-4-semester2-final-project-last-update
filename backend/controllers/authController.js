const authService = require('../services/authService');

exports.login = async (req, res) => {
  try {
    const { token, role } = await authService.login(req.body);
    res.status(200).json({ token, role });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
};
