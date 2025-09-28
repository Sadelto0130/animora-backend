/* Archivo para las rutas de publicaciones */
import { Router } from "express";
import { 
  getAllPosts, 
  getPostById,
  getPostByIdUser,
  createPost, 
  updatePost, 
  deletePost, 
  getUploadURL,
  getTrendingPosts,
  usedTags,
  getPostByTag,
  getSearchPosts,
  getSearchUSers,
  getComments,
  updatePostReadCount
} from "../controllers/posts.controllers.js";
import { isAuth } from "../middlewares/auth.middlewares.js";

const router = Router();

/* Rutas para las publicaciones */
router.get("/posts", getAllPosts);

router.get("/trending_blogs", getTrendingPosts)

router.get("/counter_tags", usedTags)

router.get("/posts_tag", getPostByTag)

router.get("/search_posts", getSearchPosts)

router.get("/search_users", getSearchUSers)

router.get("/post_user/:id_user", getPostByIdUser); 

router.get("/post/:post_slug", getPostById);

router.get("/comments/:post_id", getComments)

router.post("/read_count", updatePostReadCount)


// Rutas con auth
router.post("/post", isAuth, createPost);

router.get("/s3url", isAuth, getUploadURL);

router.put("/post/:id", isAuth, updatePost);

// rutas no usadas

router.put("/post_deleted/:id", isAuth, deletePost);

export default router;
