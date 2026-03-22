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

#### LocalStack S3 Storage Credentials (Standard AWS local testing keys)
```bash
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=us-east-1
S3_BUCKET_NAME=legal-documents
```
Step 2: Start the Containers
Open your terminal in the project root and run:

#### Start all containers in the background
```bash
docker-compose down -v
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

### 3. Document Storage (LocalStack S3)
We use LocalStack to simulate a real AWS S3 cloud environment locally. We specifically chose this over other alternatives (like MinIO) due to its Apache 2.0 license, which ensures full intellectual property (IP) protection and commercial viability for our Legal Tech product without Copyleft restrictions.

How it works:
- LocalStack runs headlessly (without a web UI) on port 4566.

- It perfectly mimics the real AWS S3 API, meaning our backend code is 100% production-ready for the real AWS cloud.

- Automatic Setup: You do not need to manually create any buckets. When you start the Node.js backend, it will automatically connect to LocalStack and initialize the legal-documents bucket for you.

Health Check:
To verify the S3 API is active and running, you can visit this diagnostic URL in your browser:

````bash
http://localhost:4566/_localstack/health
````

### 4. Starting the Application
(Add specific commands here once the backend and frontend scripts are finalized, e.g., npm run dev)
