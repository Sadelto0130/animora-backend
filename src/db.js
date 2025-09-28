import pg from "pg";
import { PG_USER, PG_HOST, PG_PASSWORD, PG_PORT, PG_DATABASE } from "./config.js";

export const pool = new pg.Pool({
  user: PG_USER,
  host: PG_HOST,
  password: PG_PASSWORD,
  port: PG_PORT,
  database: PG_DATABASE
});

pool.on("connect", () => {
  console.log("Connected to the database");
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
  process.exit(-1)
})