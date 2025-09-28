import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';

import postRoutes from './routes/post.routes.js';
import authRoutes from './routes/auth.routes.js';
import commentsRoutes from './routes/comments.routes.js';
import savePostRoutes from './routes/savePost.routes.js';
import { pool } from './db.js';
import { fileURLToPath } from 'url';
import { ORIGIN } from './config.js';

// Necesario para __dirname en ESModules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta absoluta al dist del frontend
const frontendPath = path.join(__dirname, "..", "frontend", "dist");

const app = express();

// Activa el middleware CORS en Express
app.use(cors({
  origin: ORIGIN, // Solo permite peticiones desde la URL definida en ORIGIN 
  credentials: true // Permite enviar cookies, headers de autenticación o sesiones en las peticiones
}));


// Middleware personalizado para agregar headers CORS manualmente
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", ORIGIN); // Indica qué origen tiene permiso para acceder a la API
  res.header("Access-Control-Allow-Credentials", "true"); // Permite que el navegador envíe cookies/sesiones al backend
  next();
});

// Middleware 
app.use(morgan("dev"));
app.use(cookieParser()); // lee las cookies que se envian desde el frontend
app.use(express.json()); // convierte todo lo que llega en json a javascript
app.use(express.static(frontendPath)); // Servir archivos estáticos desde dist
//app.use(express.urlencoded({ extended: true })); // permite enviar formularios desde el frontend

// Routes
app.get('/', (req, res) => res.json({message: "Welcome to PETGUARD API"}));
app.get("/api/ping", async (req, res) => {
  const result = await pool.query('SELECT NOW()')
  return res.json(result.rows[0])
});
app.use("/api", postRoutes);
app.use("/api", authRoutes);
app.use("/api", commentsRoutes);
app.use("/api", savePostRoutes);

// Error handler
app.use((err, req, res, next) => {
  res.status(500).json({
    status: "error",
    message: err.message
  })
})

// Redirigir todo lo que no sea API a React
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});


export default app;