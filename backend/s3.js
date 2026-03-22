const { S3Client, CreateBucketCommand } = require('@aws-sdk/client-s3');

// ---------------------------------------------------------
// S3 CLIENT CONFIGURATION (LocalStack)
// ---------------------------------------------------------
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    // Important: We use the Docker container name 'localstack' as the host!
    endpoint: 'http://localstack:4566', 
    // forcePathStyle is absolutely required for LocalStack and MinIO
    forcePathStyle: true, 
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
    }
});

// ---------------------------------------------------------
// INITIALIZE BUCKET
// ---------------------------------------------------------
// This function checks if our bucket exists, and creates it if it doesn't.
async function initStorage() {
    const bucketName = process.env.S3_BUCKET_NAME || 'legal-documents';
    
    try {
        const command = new CreateBucketCommand({ Bucket: bucketName });
        await s3Client.send(command);
        console.log(`SUCCESS: Created S3 bucket '${bucketName}' in LocalStack!`);
    } catch (error) {
        // AWS throws a specific error if the bucket is already there. That's fine!
        if (error.name === 'BucketAlreadyExists' || error.name === 'BucketAlreadyOwnedByYou') {
            console.log(`READY: S3 bucket '${bucketName}' already exists.`);
        } else {
            console.error('ERROR: Could not connect to LocalStack S3:', error);
        }
    }
}

module.exports = { s3Client, initStorage };