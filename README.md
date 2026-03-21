# LegalHackathon - Case Management System
This repository contains the source code and infrastructure setup for our Legal Tech Hackathon project. Our tech stack is built for scalability and security, utilizing Next.js/React for the frontend, Node.js for the backend API, PostgreSQL for relational data, and MinIO for secure document storage.

## Prerequisites
Before you begin, ensure you have the following installed on your machine:

- Docker Desktop (Must be running in the background)

- Node.js (v18 or higher)

- DBeaver (or any other PostgreSQL client)

- Git

### 1. Infrastructure Setup (Docker)
We use Docker Compose to spin up our database and local cloud storage in isolated containers. This ensures the environment is identical for every team member.

#### Step 1: Environment Variables
Create a .env file in the root directory and add the following credentials (ask a team member for the exact passwords if needed):

#### Database Credentials
```bash
DB_USER = (restricted)

DB_PASSWORD = (restricted)

DB_NAME = (restricted)
```

#### MinIO Storage Credentials
MINIO_BUCKET_NAME=legal-documents
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=SuperSecretMinioPass123!
Step 2: Start the Containers
Open your terminal in the project root and run:

#### Start all containers in the background
```bash
docker-compose up -d
```
To verify everything is running, check your Docker Desktop app. You should see nextact_db (PostgreSQL) and nextact_storage (MinIO) with a green "Running" status.

### 2. Database Connection (PostgreSQL & DBeaver)
Our relational database runs inside Docker on port 5432. To view and manage the data, use DBeaver.

How to connect via DBeaver:

1. Open DBeaver and click New Database Connection.

2. Select PostgreSQL.

3. Fill in the connection details:

    - Host: localhost

    - Port: 5432

    - Database: restricted

    - Username: restricted

    - Password: restricted

4. Click Test Connection to ensure it works, then click Finish.

Note: If you encounter a "Connection refused" error, make sure you do not have a local installation of PostgreSQL running on your machine blocking port 5432.

### 3. Document Storage (MinIO)
We use MinIO as an S3-compatible local cloud storage to store case files (PDFs, images) separately from our relational database.

#### How to access the MinIO Console:
1. Open your web browser and navigate to: http://localhost:9001

2. Log in using your MinIO credentials:

    - Username: admin

    - Password: SuperSecretMinioPass123!

Initial Setup (One-time only):

Once logged in, navigate to Buckets on the left sidebar and create a new bucket named legal-documents. Our Node.js backend uses this bucket to upload and retrieve files.

### 4. Starting the Application
(Add specific commands here once the backend and frontend scripts are finalized, e.g., npm run dev)
