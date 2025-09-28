import { pool } from "../db.js";

export const getComments = async (req, res) => {
  const { postId } = req.params;

  try {
    const result = await pool.query("SELECT * FROM comments WHERE post_id = $1 AND is_active = TRUE", [postId]);
    res.json({
      "content": result.rows[0].content,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createComments = async (req, res) => {
  const { comment, postId } = req.body;

  try {
    const postExists = await pool.query("SELECT * FROM posts WHERE id = $1 AND is_active = TRUE", [postId]);
    if (postExists.rows.length === 0) {
      return res.status(404).send("Post no encontrado");
    }

    const result = await pool.query(
      "INSERT INTO comments (content, post_id, user_id) VALUES ($1, $2, $3) RETURNING *",
      [comment, postId, req.userId]
    );

    res.status(201).send(`Comentario agregado al post ${postId} del usuario ${req.userId}`);
  } catch (error) {
    res.status(500).json({ message: error.message });
    console.error("Error al crear el comentario:", error.message);
  }
};

export const deleteComments = async (req, res) => {
  const { id } = req.params;
  
  try {

    const commentExists = await pool.query("SELECT * FROM comments WHERE id = $1 AND is_active = TRUE", [id]);
    if (commentExists.rows.length === 0) {
      return res.status(404).send("Comentario no encontrado");
    }
    if (commentExists.rows[0].user_id !== req.userId) {
      return res.status(403).send("No tienes permiso para eliminar este comentario");
    }

    // Actualizar el estado del comentario a inactivo
    await pool.query("UPDATE comments SET is_active = FALSE WHERE id = $1", [id]);
    res.send(`Comentario con ID ${id} eliminado`);
  } catch (error) {
    res.status(500).json({ message: error.message });
    console.error("Error al eliminar el comentario:", error.message);
    
  }
};
