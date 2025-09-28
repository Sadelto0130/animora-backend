/* Archivo para las rutas de autenticación */
import Router from "express-promise-router"
import { 
  login, 
  register, 
  logout, 
  getProfile, 
  deleteUser, 
  me, 
  refreshToken, 
  googleLoginUser,
  googleRegisterUser
} from "../controllers/auth.controllers.js";
import { isAuth } from "../middlewares/auth.middlewares.js";

const router = Router();

router.post("/login", login);

router.post("/register", register);

router.post("/logout", logout);

router.post("/google_login_user", googleLoginUser);

router.post("/google_register_user", googleRegisterUser);

router.post("/deleteUSer", isAuth, deleteUser);

router.get("/profile/:user_name", isAuth, getProfile);

router.get('/me', isAuth, me);

router.get("/refresh_token", refreshToken)

export default router; 