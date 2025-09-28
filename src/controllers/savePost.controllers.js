import { pool } from "../db.js";

export const getAllSavePosts = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM saved_posts WHERE user_id = $1", [req.userId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export const savePosts = async (req, res) => {
  try {
    const postExists = await pool.query("SELECT * FROM posts WHERE id = $1 AND is_active = TRUE", [req.body.postId]);
    if (postExists.rows.length === 0) {
      return res.status(404).send("Post no encontrado");
    }
    const alreadySaved = await pool.query("SELECT * FROM saved_posts WHERE user_id = $1 AND post_id = $2", [req.userId, req.body.postId]);
    if (alreadySaved.rows.length > 0) {
      return res.status(409).send("Post ya guardado");
    }
    const result = await pool.query("INSERT INTO saved_posts (user_id, post_id) VALUES ($1, $2) RETURNING *", [req.userId, req.body.postId]);

    res.status(201).json("Publicación guardada correctamente");
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export const getSavePostById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM saved_posts WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).send("Publicación guardada no encontrada");
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export const deleteSavePostById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("DELETE FROM saved_posts WHERE id = $1 RETURNING *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).send("Publicación guardada no encontrada");
    }
    res.send(`Publicación con ID ${id} eliminada de los guardados.`);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}