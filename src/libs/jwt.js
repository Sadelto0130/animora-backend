import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";

// Crear un token de acceso
// El token de acceso se utiliza para autenticar solicitudes a la API
export const createAccessToken = (payload) => {
  return new Promise((resolve, reject) => {
    jwt.sign(
      payload, 
      JWT_SECRET, 
      { 
        expiresIn: "1d" 
      }, 
      (err, token) => {
        if (err) reject(err);
        resolve(token);
      });
  });
};

export const createRefreshToken = (payload) => {
  return jwt.sign(payload, "xyz123", {
    expiresIn: "7d"
  })
}