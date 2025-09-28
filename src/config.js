import dotenv from "dotenv";
dotenv.config();

export const PORT = process.env.PORT || 3000;

export const PG_PORT = process.env.PG_PORT || 5432;
export const PG_HOST = process.env.PG_HOST || "localhost"; 
export const PG_USER = process.env.PG_USER || "postgres";
export const PG_PASSWORD = process.env.PG_PASSWORD || "password";
export const PG_DATABASE = process.env.PG_DATABASE || "petguard";

export const JWT_SECRET= process.env.JWT_SECRET

export const ORIGIN = process.env.ORIGIN || "http://localhost:5173"

export const AWS_REGION= process.env.AWS_REGION 
export const AWS_SECRET_ACCESS_KEY= process.env.AWS_SECRET_ACCESS_KEY
export const AWS_ACCESS_KEY= process.env.AWS_ACCESS_KEY 