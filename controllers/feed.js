const fs = require('fs');
const path = require('path');

const { validationResult } = require('express-validator');

const io = require('../socket');
const Post = require('../models/post');
const User = require('../models/user');
const { clearImage } = require('../util/file');

exports.getPosts = async (req, res, next) => {
  try {
    const page = +req.query.page || 1;
    const perPage = 2;
    const totalItems = await Post.countDocuments();

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate('creator')
      .skip((page - 1) * perPage)
      .limit(perPage);

    res.status(200).json({
      message: 'Posts fetched successfully',
      posts,
      totalItems
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.createPost = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const err = new Error('Validation failed, entered data is incorrect.');
      err.statusCode = 422;
      err.data = errors.array();
      throw err;
    }

    if (!req.file) {
      const err = new Error('No image provided');
      err.statusCode = 422;
      throw err;
    }

    const post = await Post.create({
      ...req.body,
      image: req.file.key,
      creator: req.userId
    });

    const user = await User.findById(req.userId, '-password');

    user.posts.push(post._id);

    await user.save();

    io.getIO().emit('posts', {
      action: 'create',
      post: { ...post._doc, creator: user._doc }
    });

    res.status(201).json({
      message: 'Post created successfully',
      post,
      creator: { _id: user._id, name: user.name }
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getPost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId).populate('creator');

    if (!post) {
      const err = new Error('Post not found');
      err.statusCode = 404;
      throw err;
    }

    res.status(200).json({ message: 'Post fetched successfully', post });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updatePost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { title, content } = req.body;
    let { image } = req.body;

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const err = new Error('Validation failed, entered data is incorrect.');
      err.statusCode = 422;
      err.data = errors.array();
      throw err;
    }
    if (req.file) {
      image = req.file.key;
    }

    if (!image || image === 'undefined') {
      const err = new Error('No file picked');
      err.statusCode = 422;
      throw err;
    }

    const post = await Post.findById(postId).populate('creator', 'name _id');

    if (!post) {
      const err = new Error('Post not found');
      err.statusCode = 404;
      throw err;
    }

    if (post.creator._id.toString() !== req.userId) {
      const err = new Error('Not authorized');
      err.statusCode = 403;
      throw err;
    }

    if (post.image !== image) {
      clearImage(post.image);
    }

    post.title = title;
    post.content = content;
    post.image = image;

    await post.save();

    io.getIO().emit('posts', {
      action: 'update',
      post
    });

    res.status(200).json({ message: 'Post updated', post });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.deletePost = async (req, res, next) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId);

    if (!post) {
      const err = new Error('Post not found');
      err.statusCode = 404;
      throw err;
    }

    if (post.creator.toString() !== req.userId) {
      const err = new Error('Not authorized');
      err.statusCode = 403;
      throw err;
    }

    clearImage(post.image);

    await Post.findByIdAndDelete(postId);

    const user = await User.findById(req.userId);

    user.posts.pull(post._id);

    await user.save();

    io.getIO().emit('posts', { action: 'delete', post: postId });

    res.status(200).json({ message: 'Post deleted' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
