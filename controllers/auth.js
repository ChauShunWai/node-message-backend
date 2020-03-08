const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/user');

exports.signup = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const err = new Error('Validation failed');
      err.statusCode = 422;
      err.data = errors.array();
      throw err;
    }

    const { email, name, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({ email, name, password: hashedPassword });

    res.status(201).json({ message: 'User created', userId: user._id });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      const err = new Error('No user found with this email');
      err.statusCode = 401;
      throw err;
    }

    const isPasswordEqual = await bcrypt.compare(password, user.password);

    if (!isPasswordEqual) {
      const err = new Error('Wrong password');
      err.statusCode = 401;
      throw err;
    }

    const token = jwt.sign(
      {
        userId: user._id.toString()
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '1h'
      }
    );

    res.status(200).json({ token, userId: user._id.toString() });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    res.status(200).json({ status: user.status });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updateUserStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const err = new Error('Validation failed');
      err.statusCode = 422;
      err.data = errors.array();
      throw err;
    }

    const { status } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    user.status = status;

    await user.save();

    res.status(200).json({ message: 'Status updated' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
