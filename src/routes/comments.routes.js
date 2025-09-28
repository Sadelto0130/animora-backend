/* Archivo para las rutas de comentarios */
import { Router } from "express"; 
import { 
  getComments, 
  createComments, 
  deleteComments 
} from "../controllers/comments.controllers.js";
import { isAuth } from "../middlewares/auth.middlewares.js";

const router = Router();

router.get("/comments/:postId", getComments);

router.post('/comments', isAuth, createComments);

router.put('/comments_delete/:id', isAuth, deleteComments);

export default router;