import { json } from "zod/v4";
import { pool } from "../db.js";
import {buildCommentTree} from "../libs/buildCommentTree.js"

export const getComments = async (req, res) => {

  const { postId } = req.params;
  const { offset, limit } = req.query

  try {
    const result = await pool.query(
      `
      SELECT 
        c.id AS comment_id,
        c.content,
        c.user_id,
        c.post_id,
        c.parent_comment_id,
        c.created_at,
        c.is_active,
        c.parent_comment_id,
        json_build_object(
                'id', u.id,
                'name', u.name,
                'last_name', u.last_name,
                'user_name', u.user_name,          
                'avatar_url', u.avatar_url
              ) AS users
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1 AND c.is_active = TRUE
      GROUP BY c.id, u.id
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3;`,
      [postId, limit, offset]
    );

    return res.json({
      content: buildCommentTree(result.rows)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createComments = async (req, res) => {
  const { id_user, id_post, content, parent_comment_id } = req.body;;
  
  if (typeof id_user === "undefined" || !id_user) {
    return res
      .status(401)
      .json({ error: "Debe iniciar sesion para comentar" });
  }

  if (!content || content.trim() === "") {
    return res
      .status(400)
      .json({ error: "El comentario no puede estar vació" });
  }

  try {

    const postExists = await pool.query(
      "SELECT 1 FROM posts WHERE id = $1 AND is_active = TRUE",
      [id_post]
    );
    if (postExists.rows.length === 0) {
      return res.status(404).send("Post no encontrado");
    }

    const userExists = await pool.query(
      "SELECT * FROM users WHERE id = $1 AND is_active = TRUE",
      [id_user]
    );
    if (userExists.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "El usuario no existe o debe iniciar sesion" });
    }

    const result = await pool.query(
      "INSERT INTO comments (content, post_id, user_id, parent_comment_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [content.trim(), id_post, id_user, parent_comment_id]
    );

    const resultComment = result.rows[0]
    
    const newComment = {
      comment_id: resultComment?.id, 
      content: resultComment?.content, 
      created_at: resultComment?.created_at,
      is_active: resultComment?.is_active,
      parent_comment_id: resultComment?.parent_comment_id,
      post_id: resultComment?.post_id,
      user_id: resultComment?.user_id,
      users: 
        {
          avatar_url: userExists?.rows[0].avatar_url,
        id: userExists?.rows[0].id,
        last_name: userExists?.rows[0].last_name, 
        name: userExists?.rows[0].name,
        user_name: userExists?.rows[0].user_name
        }
      }
   
    // emitir el evento en tiempo real
    const io = req.app.get("io")
    io.emit("update-comments", newComment)
    return res
      .status(201)
      .json({
        message: `Comentario agregado al post`,
        comment: buildCommentTree(newComment),
      });
  } catch (error) {
    res.status(500).json({ message: error.message });
    console.error("Error al crear el comentario:", error.message);
  }
};

export const deleteComments = async (req, res) => {
  const { comment_id } = req.params;
  const user_id = req.userId
  try {
    const commentExists = await pool.query(
      "SELECT * FROM comments WHERE id = $1 AND is_active = true",
      [comment_id]
    );

    if (commentExists.rows.length === 0) {
      console.log("Comentario no encontrado")
      return res.status(404).json({message:"Comentario no encontrado"});
    }

    // Actualizar el estado del comentario a inactivo
    const { rows } = await pool.query(`
      WITH RECURSIVE comment_tree AS (
        SELECT id FROM comments WHERE id = $1
        UNION ALL
        SELECT c.id
        FROM comments c
        INNER JOIN comment_tree ct ON c.parent_comment_id = ct.id
      )
      UPDATE comments
      SET is_active = false, deleted_at = NOW(), deleted_by = $2
      WHERE id IN (SELECT id FROM comment_tree)
      RETURNING id`, 
      [comment_id, user_id]);
    
    const deletedIds = rows.map(r => r.id);
    const io = req.app.get("io")
    io.to(`post_${commentExists.rows[0].post_id}`).emit("delete-comment", {deletedIds}) 

    return res.status(201).json({
      message: "Comentario eliminado",
      deletedIds
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
    console.error("Error al eliminar el comentario:", error.message);
  }
};
