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

// da acceso a io
app.use((req, res, next) => {
  req.io = io;
  next()
})

io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id)
  socket.on("disconnect", () => console.log("Cliente desconectado:", socket.id))
})

app.set("io", io)

// inicia server
server.listen(PORT, () => console.log(`Server iniciado en http://localhost:${PORT}`))

