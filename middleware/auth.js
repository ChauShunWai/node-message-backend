const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const authHeader = req.get('Authorization');

    if (!authHeader) {
      req.isAuth = false;
      return next();
    }

    const token = req.get('Authorization').split(' ')[1];

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    if (!decodedToken) {
      req.isAuth = false;
      return next();
    }

    req.userId = decodedToken.userId;
    req.isAuth = true;

    next();
  } catch (err) {
    req.isAuth = false;
    return next();
  }
};
