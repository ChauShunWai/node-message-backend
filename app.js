const path = require('path');

const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const multer = require('multer');
const graphqlHttp = require('express-graphql');
const AWS = require('aws-sdk');
const multerS3 = require('multer-s3');
const s3Proxy = require('s3-proxy');
const { v4 } = require('uuid');

const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/auth');
const { clearImage } = require('./util/file');

const app = express();
const s3 = new AWS.S3({ apiVersion: '2006-03-01' });

const storage = multerS3({
  s3: s3,
  bucket: process.env.BUCKET_NAME,
  metadata: function(req, file, cb) {
    cb(null, {
      fieldName: file.fieldname,
      extension: file.mimetype.split('/')[1]
    });
  },
  key: function(req, file, cb) {
    cb(null, Date.now().toString() + '-' + v4());
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.includes('image')) {
    return cb(null, true);
  }
  cb(null, false);
};

app.use(require('body-parser').json());
app.use(
  multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 1048576 / 2
    }
  }).single('image')
);
app.use('/images', express.static(path.join(__dirname, 'images')));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(auth);
const s3router = express.Router();
app.use(
  '/media',
  (req, res, next) => {
    if (!req.isAuth) {
      return res.status(401).json('not authorized to access image');
    }
    next();
  },
  s3router.get(
    '/*',
    s3Proxy({
      bucket: process.env.BUCKET_NAME,
      accessKeyId: s3.config.credentials.accessKeyId,
      secretAccessKey: s3.config.credentials.secretAccessKey,
      overrideCacheControl: 'max-age=100000',
      defaultKey: false
    })
  )
);
app.put('/post-image', async (req, res, next) => {
  try {
    if (!req.isAuth) {
      throw new Error('Not authenticated');
    }

    if (!req.file) {
      return res.status(200).json({ message: 'No file uploaded. ' });
    }

    if (req.body.oldPath) {
      await clearImage(req.body.oldPath);
    }

    return res
      .status(201)
      .json({ message: 'File stored. ', filePath: req.file.key });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res
        .status(201)
        .json({ message: 'File stored. ', filePath: req.file.key });
    }
    next(err);
  }
});

app.use(
  '/graphql',
  graphqlHttp({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    customFormatErrorFn(err) {
      if (!err.originalError) {
        return err;
      }
      const { data, code } = err.originalError;
      const message = err.message || 'Error occurred';
      return { message, status: code || 500, data };
    }
  })
);

app.use(function(err, req, res, next) {
  if (err.code !== 'LIMIT_FILE_SIZE') return next(err);
  return res.status(409).json({ message: 'Image should be 512KB or less' });
});

app.use((err, req, res, next) => {
  if (err && err.code === 'ENOENT') return next();
  console.log(err);
  const { statusCode, message, data } = err;
  res.status(statusCode || 500).json({ message, data });
});

if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static('build'));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'build', 'index.html'));
  });
}

mongoose
  .connect(process.env.DB_HOST, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    app.listen(process.env.PORT || 8080);
  })
  .catch(err => console.log(err));
