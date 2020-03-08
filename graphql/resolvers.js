const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');

const User = require('../models/user');
const Post = require('../models/post');
const { clearImage } = require('../util/file');

module.exports = {
  createUser: async function({ userInput }, req) {
    const { email, name, password } = userInput;

    const errors = [];

    if (!validator.isEmail(email)) {
      errors.push({ message: 'Invalid email. ' });
    }

    if (validator.isEmpty(name)) {
      errors.push({ message: 'Name must not be empty. ' });
    }

    if (
      !validator.isLength(password, { min: 5 }) ||
      !validator.isAlphanumeric(password)
    ) {
      errors.push({
        message:
          'Password must have a minimun length of 5 numbers or alphabets. '
      });
    }

    if (errors.length > 0) {
      const err = new Error('Invalid input. ');
      err.data = errors;
      err.code = 422;
      throw err;
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      const err = new Error('User exists. ');
      err.code = 409;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      email,
      name: validator.escape(name),
      password: hashedPassword
    });

    const createdUser = await user.save();

    return { ...createdUser._doc, _id: createdUser._id.toString() };
  },
  login: async function({ email, password }) {
    const errors = [];

    if (!validator.isEmail(email)) {
      errors.push({ message: 'Invalid email. ' });
    }

    if (
      !validator.isLength(password, { min: 5 }) ||
      !validator.isAlphanumeric(password)
    ) {
      errors.push({
        message:
          'Password must have a minimun length of 5 numbers or alphabets. '
      });
    }

    if (errors.length > 0) {
      const err = new Error('Invalid input. ');
      err.data = errors;
      err.code = 422;
      throw err;
    }

    const user = await User.findOne({ email });

    if (!user) {
      const err = new Error('User not found. ');
      err.code = 401;
      throw err;
    }

    const isEqual = await bcrypt.compare(password, user.password);

    if (!isEqual) {
      const err = new Error('Incorrect password');
      err.code = 401;
      throw err;
    }

    const token = jwt.sign(
      {
        userId: user._id.toString()
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return { token, userId: user._id.toString() };
  },
  createPost: async function({ postInput: { title, image, content } }, req) {
    if (!req.isAuth) {
      await clearImage(image);
      const err = new Error('Not authenticated. ');
      err.code = 401;
      throw err;
    }

    const errors = [];

    if (!validator.isLength(title, { min: 5 })) {
      errors.push({ message: 'Invalid title. ' });
    }

    if (!validator.isLength(content, { min: 5 })) {
      errors.push({ message: 'Invalid content. ' });
    }

    if (errors.length > 0) {
      await clearImage(image);
      const err = new Error('Invalid input. ');
      err.data = errors;
      err.code = 422;
      throw err;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      await clearImage(image);
      const err = new Error('Invalid user. ');
      err.code = 401;
      throw err;
    }

    const post = new Post({
      title: validator.escape(title),
      content: validator.escape(content),
      image,
      creator: user
    });

    const createdPost = await post.save();

    user.posts.push(createdPost._id);

    await user.save();

    return {
      ...createdPost._doc,
      _id: createdPost._id.toString(),
      createdAt: createdPost.createdAt.toString(),
      updatedAt: createdPost.updatedAt.toString()
    };
  },
  posts: async function({ page }, req) {
    if (!req.isAuth) {
      const err = new Error('Not authenticated. ');
      err.code = 401;
      throw err;
    }

    const itemsPerPage = 2;

    const totalPosts = await Post.countDocuments();
    const posts = await Post.find()
      .skip(page >= 1 ? (page - 1) * itemsPerPage : 0)
      .limit(itemsPerPage)
      .sort({ createdAt: -1 })
      .populate('creator');

    return {
      posts: posts.map(post => {
        return {
          ...post._doc,
          createdAt: post.createdAt.toString(),
          updatedAt: post.updatedAt.toString(),
          creator: post.creator ? post.creator : { name: 'DELETED USER' }
        };
      }),
      totalPosts
    };
  },
  post: async function({ postId }, req) {
    if (!req.isAuth) {
      const err = new Error('Not authenticated. ');
      err.code = 401;
      throw err;
    }

    const post = await Post.findById(postId).populate('creator');

    if (!post) {
      const err = new Error('Post not found. ');
      err.code = 404;
      throw err;
    }

    return {
      ...post._doc,
      createdAt: post.createdAt.toString(),
      updatedAt: post.updatedAt.toString(),
      creator: post.creator ? post.creator : { name: 'DELETED USER' }
    };
  },
  updatePost: async function(
    { postId, postInput: { title, image, content } },
    req
  ) {
    if (!req.isAuth) {
      await clearImage(image);
      const err = new Error('Not authenticated. ');
      err.code = 401;
      throw err;
    }

    const errors = [];

    if (!validator.isLength(title, { min: 5 })) {
      errors.push({ message: 'Invalid title. ' });
    }

    if (!validator.isLength(content, { min: 5 })) {
      errors.push({ message: 'Invalid content. ' });
    }

    if (errors.length > 0) {
      await clearImage(image);
      const err = new Error('Invalid input. ');
      err.data = errors;
      err.code = 422;
      throw err;
    }

    const post = await Post.findById(postId).populate('creator');

    if (!post) {
      await clearImage(image);
      const err = new Error('Post not found. ');
      err.code = 404;
      throw err;
    }

    if (!post.creator) {
      await clearImage(image);
      const err = new Error('Not authorized. ');
      err.code = 403;
      throw err;
    }

    if (post.creator._id.toString() !== req.userId.toString()) {
      await clearImage(image);
      const err = new Error('Not authorized. ');
      err.code = 403;
      throw err;
    }

    post.title = title;
    post.content = content;
    if (image !== 'undefined') {
      post.image = image;
    }

    const updatedPost = await post.save();

    return {
      ...updatedPost._doc,
      updatedAt: updatedPost.updatedAt.toString(),
      createdAt: updatedPost.createdAt.toString()
    };
  },
  deletePost: async function({ postId }, req) {
    if (!req.isAuth) {
      const err = new Error('Not authenticated. ');
      err.code = 401;
      throw err;
    }

    const post = await Post.findById(postId);

    if (!post) {
      const err = new Error('Post not found. ');
      err.code = 404;
      throw err;
    }

    if (!post.creator) {
      const err = new Error('Not authorized. ');
      err.code = 403;
      throw err;
    }

    if (post.creator.toString() !== req.userId.toString()) {
      const err = new Error('Not authorized. ');
      err.code = 403;
      throw err;
    }

    await clearImage(post.image);

    await Post.findByIdAndDelete(postId);

    const user = await User.findById(req.userId);

    user.posts.pull(postId);

    await user.save();

    return true;
  },
  user: async function(_, req) {
    if (!req.isAuth) {
      const err = new Error('Not authenticated. ');
      err.code = 401;
      throw err;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      const err = new Error('User not found. ');
      err.code = 404;
      throw err;
    }

    return { ...user._doc };
  },
  updateStatus: async function({ status }, req) {
    if (!req.isAuth) {
      const err = new Error('Not authenticated. ');
      err.code = 401;
      throw err;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      const err = new Error('User not found. ');
      err.code = 404;
      throw err;
    }

    user.status = status;

    await user.save();

    return { ...user._doc };
  }
};
