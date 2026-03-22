const { Pool } = require("pg");
const fs = require("fs");
require("dotenv").config();

function runningInDocker() {
  return fs.existsSync("/.dockerenv");
}

function getDefaultDbHost() {
  return runningInDocker() ? "postgres" : "localhost";
}

const pool = new Pool({
  // Allow the backend to run both inside Docker Compose and directly on the host machine.
  host: process.env.DB_HOST || getDefaultDbHost(),
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

module.exports = pool;
