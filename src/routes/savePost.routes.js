/* Archivo para guardar publicaciones */
import { Router } from "express";
import { savePosts, getSavePostById, deleteSavePostById, getAllSavePosts } from "../controllers/savePost.controllers.js";

const router = Router();

router.post("/save_post", savePosts);

router.get("/save_posts", getAllSavePosts);

router.get("/save_post/:id", getSavePostById);

router.delete("/save_post/:id", deleteSavePostById);

export default router;