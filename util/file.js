const AWS = require('aws-sdk');
const s3 = new AWS.S3({ apiVersion: '2006-03-01' });

exports.clearImage = filePath => {
  const deleteOldPic = s3
    .deleteObject({ Bucket: process.env.BUCKET_NAME, Key: filePath })
    .promise();
  deleteOldPic.then(function(data) {
    console.log('Successfully deleted');
  });
};
