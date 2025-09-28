// Para comprobar si el usuario esta autenticado leyendo las cookies, 
// en app.js debe usar el middleware cookie-parser

import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";

export const isAuth = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({
      message: "No estas autorizado, no hay token",
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        message: "No estas autorizado, no e verifico",
      });
    }

    req.userId = decoded.id; // Guardar el id del usuario decodificado en la solicitud
    next();
  });
};
