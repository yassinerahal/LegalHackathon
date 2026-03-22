const express = require('express');
const multer = require('multer');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client } = require('./s3'); // We created this file earlier

const router = express.Router();

// ---------------------------------------------------------
// MULTER CONFIGURATION
// ---------------------------------------------------------
// We store the uploaded file temporarily in the server's RAM (memory) 
// before sending it directly to LocalStack S3.
const upload = multer({ storage: multer.memoryStorage() });

// ---------------------------------------------------------
// UPLOAD ENDPOINT
// ---------------------------------------------------------
// The 'upload.single("document")' middleware expects the frontend 
// to send the file under the name "document".
router.post('/upload', upload.single('document'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Create a unique filename so files don't overwrite each other
        const uniqueFileName = `${Date.now()}-${file.originalname}`;
        const bucketName = process.env.S3_BUCKET_NAME || 'legal-documents';

        // Prepare the upload command for S3 / LocalStack
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: uniqueFileName,      // The name of the file in S3
            Body: file.buffer,        // The actual file content
            ContentType: file.mimetype // e.g., 'application/pdf'
        });

        // Send the file to LocalStack
        await s3Client.send(command);

        // Success! We return the file path so the frontend knows it worked.
        // Later, you will save this exact path into your PostgreSQL database!
        res.status(200).json({
            message: 'File uploaded successfully',
            filePath: uniqueFileName
        });

    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({ error: 'Failed to upload file to S3' });
    }
});

module.exports = router;