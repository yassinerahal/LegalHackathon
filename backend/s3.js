const fs = require("fs");
const { CreateBucketCommand, HeadBucketCommand, S3Client } = require("@aws-sdk/client-s3");

const bucketName = process.env.S3_BUCKET_NAME || "legal-documents";

function runningInDocker() {
  return fs.existsSync("/.dockerenv");
}

function getDefaultS3Endpoint() {
  return runningInDocker() ? "http://localstack:4566" : "http://localhost:4566";
}

const s3Endpoint = process.env.S3_ENDPOINT || getDefaultS3Endpoint();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: s3Endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test"
  }
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createBucketIfMissing() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return;
  } catch (error) {
    const notFoundCodes = new Set(["NotFound", "NoSuchBucket", "Unknown", "404"]);

    if (!notFoundCodes.has(error.name) && error.$metadata?.httpStatusCode !== 404) {
      throw error;
    }
  }

  await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
}

async function initStorage() {
  const maxAttempts = 6;
  const retryDelayMs = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await createBucketIfMissing();
      console.log(`S3 storage ready for bucket '${bucketName}'.`);
      return;
    } catch (error) {
      if (error.name === "BucketAlreadyExists" || error.name === "BucketAlreadyOwnedByYou") {
        console.log(`S3 storage ready for bucket '${bucketName}'.`);
        return;
      }

      const isConnectionRefused =
        error.code === "ECONNREFUSED" ||
        error.errno === "ECONNREFUSED" ||
        error.name === "TimeoutError" ||
        String(error.message || "").includes("ECONNREFUSED") ||
        String(error.cause?.message || "").includes("ECONNREFUSED");

      if (attempt < maxAttempts && isConnectionRefused) {
        console.log(
          `LocalStack not ready yet. Retrying in 2 seconds... (Attempt ${attempt}/${maxAttempts})`
        );
        await wait(retryDelayMs);
        continue;
      }

      if (attempt < maxAttempts) {
        console.log(
          `S3 initialization failed. Retrying in 2 seconds... (Attempt ${attempt}/${maxAttempts})`
        );
        await wait(retryDelayMs);
        continue;
      }

      console.error("Failed to initialize S3 storage after all retry attempts.");
      throw error;
    }
  }
}

async function ensureStorageReady() {
  await initStorage();
}

module.exports = { bucketName, ensureStorageReady, initStorage, s3Client };
