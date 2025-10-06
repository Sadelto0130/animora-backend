import express from "express"
import { createServer } from "http"
import { Server } from "socket.io";
import { PORT, ORIGIN } from "./config.js";
import app from "./app.js";

// con esta config se puede usar socket.io para eventos de actualizacion

// crea servidor HTTP
const server = createServer(app) 

// Inicia socket.io
export const io = new Server(server, {
  cors: {
    origin: ORIGIN,
    credentials: true
  }
})

app.set("io", io)

// da acceso a io
app.use((req, res, next) => {
  req.io = io;
  next()
})

// Eventos de conexión
io.on("connection", (socket) => {
  console.log("🟢 Cliente conectado:", socket.id);

  // El cliente se une a una sala específica del post
  socket.on("join-post", (postId) => {
    socket.join(`post_${postId}`);
    console.log(`📥 Usuario ${socket.id} se unió al post_${postId}`);
  });

  // El cliente sale del post al cerrar la vista
  socket.on("leave-post", (postId) => {
    socket.leave(`post_${postId}`);
    console.log(`📤 Usuario ${socket.id} salió del post_${postId}`);
  });

  // Desconexión
  socket.on("disconnect", () => {
    console.log("🔴 Cliente desconectado:", socket.id);
  });
})


// inicia server
server.listen(PORT, () => console.log(`Server iniciado en http://localhost:${PORT}`))

