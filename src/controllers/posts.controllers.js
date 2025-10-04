import { json } from "express";
import { pool } from "../db.js";
import { generateUploadURL } from "../libs/aws.js";

export const getAllPosts = async (req, res) => {
  try {
    const { offset = 0, limit = 10 } = req.query;

    const result = await pool.query(
      `SELECT 
        p.id AS post_id,
        p.title,
        p.content,
        p.banner,
        p.country,
        p.state,
        p.city,
        p.slug,
        p.created_at,
        p.updated_at,
        p.read_count,
        p.is_active,
        p.draft,
        
        -- Usuario dueño del post
        json_build_object(
          'id', u.id,
          'name', u.name,
          'last_name', u.last_name,
          'user_name', u.user_name,          
          'avatar_url', u.avatar_url
        ) AS users,

        -- Tags como array
        COALESCE(json_agg(DISTINCT t.tag) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,

        -- Imágenes como array de objetos
        COALESCE(json_agg(DISTINCT jsonb_build_object(
          'id', bi.id,
          'url', bi.image_url,
          'alt', bi.alt_text
        )) FILTER (WHERE bi.id IS NOT NULL), '[]') AS blog_images,

        -- Cantidad de likes
        COUNT(DISTINCT l.id) AS total_likes,

        -- Usuarios que dieron like
        COALESCE(json_agg(DISTINCT jsonb_build_object(
          'id', lu.id,
          'name', lu.name,
          'last_name', lu.last_name
        )) FILTER (WHERE lu.id IS NOT NULL), '[]') AS liked_by

      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN post_tags pt ON p.id = pt.post_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      LEFT JOIN blog_images bi ON p.id = bi.blog_id
      LEFT JOIN likes l ON p.id = l.post_id
      LEFT JOIN users lu ON l.user_id = lu.id
      GROUP BY p.id, u.id
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2;`,
      [limit, offset]
    );

    if (result.rows.length === 0) {
      return res.status(200).json([]);
    }

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error al obtener las publicaciones:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getPostByTag = async (req, res) => {
  const { tag } = req.query;

  try {
    const result = await pool.query(
      `SELECT 
      p.id AS post_id,
      p.title,
      p.content,
      p.banner,
      p.country,
      p.state,
      p.city,
      p.slug,
      p.created_at,
      p.updated_at,
      p.read_count,
      
      -- Usuario dueño del post
      json_build_object(
        'id', u.id,
        'name', u.name,
        'last_name', u.last_name,
        'user_name', u.user_name,          
        'avatar_url', u.avatar_url
      ) AS users,

      -- Tags como array
      COALESCE(json_agg(DISTINCT t.tag) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,

      -- Imágenes como array de objetos
      COALESCE(json_agg(DISTINCT jsonb_build_object(
        'id', bi.id,
        'url', bi.image_url,
        'alt', bi.alt_text
      )) FILTER (WHERE bi.id IS NOT NULL), '[]') AS blog_images,

      -- Cantidad de likes
      COUNT(DISTINCT l.id) AS total_likes,

      -- Usuarios que dieron like
      COALESCE(json_agg(DISTINCT jsonb_build_object(
        'id', lu.id,
        'name', lu.name,
        'last_name', lu.last_name
      )) FILTER (WHERE lu.id IS NOT NULL), '[]') AS liked_by
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN post_tags pt ON p.id = pt.post_id
    LEFT JOIN tags t ON pt.tag_id = t.id
    LEFT JOIN blog_images bi ON p.id = bi.blog_id
    LEFT JOIN likes l ON p.id = l.post_id
    LEFT JOIN users lu ON l.user_id = lu.id
    WHERE EXISTS (
      SELECT 1 
      FROM post_tags pt2 
      JOIN tags t2 ON pt2.tag_id = t2.id
      WHERE pt2.post_id = p.id
        AND t2.tag = $1
    )
    GROUP BY p.id, u.id
    ORDER BY p.created_at DESC`,
      [tag]
    );

    if (result.rows.length === 0) {
      return res.status(200).json([]);
    }
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error al obtener la publicación:", error);
    res.status(500).json({ message: error.message });
  }
};

export const createPost = async (req, res) => {
  try {
    const {
      title,
      banner,
      content,
      country,
      state,
      city,
      slug,
      draft,
      postTags,
      description,
    } = req.body;

    if (!title || !content) {
      return res
        .status(400)
        .json({ message: "Titulo y Contenido son necesarios" });
    }

    await pool.query("BEGIN"); // pausa todas las operaciones hasta que se confirme el envio

    const postResult = await pool.query(
      "INSERT INTO posts (title, content, banner, country, state, city, slug, user_id, draft, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *",
      [
        title,
        JSON.stringify(content),
        banner,
        country,
        state,
        city,
        slug,
        req.userId,
        draft,
        description,
      ]
    );

    const postId = postResult.rows[0].id;

    // Agregar Tags
    let addTags = [];
    for (let tag of postTags) {
      const tagCorregido = tag.trim().toLowerCase();

      const tagResult = await pool.query(
        `INSERT INTO tags (tag)
        VALUES ($1)
        ON CONFLICT (tag) DO NOTHING
        RETURNING *`,
        [tagCorregido]
      );

      let tagId;
      let tagName;

      if (tagResult.rows.length > 0) {
        tagId = tagResult.rows[0].id;
        tagName = tagResult.rows[0].tag;
      } else {
        const existTag = await pool.query(
          `SELECT id, tag FROM tags WHERE tag = $1`,
          [tagCorregido]
        );
        if (existTag.rows.length === 0) {
          throw new Error(
            `No se pudo encontrar o insertar el tag: ${tagCorregido}`
          );
        }
        tagId = existTag.rows[0].id;
        tagName = existTag.rows[0].tag;
      }

      await pool.query(
        `INSERT INTO post_tags (post_id, tag_id)
        VALUES ($1, $2)
        ON CONFLICT (post_id, tag_id) DO NOTHING`,
        [postId, tagId]
      );
      addTags.push({ id: tagId, tag: tagName });
    }

    await pool.query("COMMIT"); // confirma las operaciones para enviar

    return res.status(201).json({
      message: "Post creado con exito",
      data: postResult.rows[0],
      images: insertedImages,
      tags: addTags,
    });
  } catch (error) {
    await pool.query("ROLLBACK"); // deshace las operaciones
    console.log("Error al crear el posts:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const getTrendingPosts = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        p.id AS post_id, 
        p.title, 
        p.created_at, 
        p.slug,
        p.read_count,
      json_build_object(
        'id', u.id,
        'name', u.name,
        'last_name', u.last_name,
        'user_name', u.user_name,          
        'avatar_url', u.avatar_url
        ) AS users
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ORDER BY read_count DESC LIMIT 5`
    );

    if (result.rows.length === 0) {
      return res.status(200).json([]);
    }

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error al obtener la publicación:", error);
    res.status(500).json({ message: error.message });
  }
};

export const usedTags = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.id AS tag_id,
        t.tag,
        COUNT(*) AS veces_usado
      FROM post_tags pt
      JOIN tags t ON pt.tag_id = t.id 
      GROUP BY t.id, t.tag
      ORDER BY veces_usado DESC
    `);

    if (result.rows.length === 0) {
      return res.status(200).json([]);
    }

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error al contar los tags:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getUploadURL = async (req, res) => {
  try {
    const url = await generateUploadURL();
    res.json({ uploadURL: url });
  } catch (err) {
    console.error("Error al generar la URL de la imagen:", err);
    res.status(500).json({ message: "Error al generar la URL de la imagen" });
  }
};

export const getSearchPosts = async (req, res) => {
  const { search, offset = 0, limit = 10 } = req.query;

  try {
    const result = await pool.query(
      `SELECT 
      p.id AS post_id,
      p.title,
      p.content,
      p.banner,
      p.country,
      p.state,
      p.city,
      p.slug,
      p.created_at,
      p.updated_at,
      p.read_count,
      p.is_active,
      p.draft,
      
      -- Usuario dueño del post
      json_build_object(
        'id', u.id,
        'name', u.name,
        'last_name', u.last_name,
        'user_name', u.user_name,          
        'avatar_url', u.avatar_url
      ) AS users,

      -- Tags como array
      COALESCE(json_agg(DISTINCT t.tag) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,

      -- Imágenes como array de objetos
      COALESCE(json_agg(DISTINCT jsonb_build_object(
        'id', bi.id,
        'url', bi.image_url,
        'alt', bi.alt_text
      )) FILTER (WHERE bi.id IS NOT NULL), '[]') AS blog_images,

      -- Cantidad de likes
      COUNT(DISTINCT l.id) AS total_likes,

      -- Usuarios que dieron like
      COALESCE(json_agg(DISTINCT jsonb_build_object(
        'id', lu.id,
        'name', lu.name,
        'last_name', lu.last_name
      )) FILTER (WHERE lu.id IS NOT NULL), '[]') AS liked_by
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN post_tags pt ON p.id = pt.post_id
    LEFT JOIN tags t ON pt.tag_id = t.id
    LEFT JOIN blog_images bi ON p.id = bi.blog_id
    LEFT JOIN likes l ON p.id = l.post_id
    LEFT JOIN users lu ON l.user_id = lu.id
    WHERE EXISTS (
      SELECT 1 
      FROM post_tags pt2 
      JOIN tags t2 ON pt2.tag_id = t2.id
      WHERE pt2.post_id = p.id
        AND p.title ILIKE $1
    )
    GROUP BY p.id, u.id
    ORDER BY p.created_at DESC
    LIMIT $2 OFFSET $3;`,
      [search, limit, offset]
    );
    if (result.rows.length === 0) {
      return res.status(200).json([]);
    }
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error al buscar las publicaciones:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getSearchUSers = async (req, res) => {
  const { search, offset = 0, limit = 10 } = req.query;

  try {
    const result = await pool.query(
      `SELECT 
        u.id AS user_id,
        u.name,
        u.last_name,
        u.user_name,
        u.email,
        u.avatar_url,
        u.is_active
      FROM users u
      WHERE u.name ILIKE $1 
      OR u.last_name ILIKE $1
      OR u.user_name ILIKE $1
      OR u.email ILIKE $1
      LIMIT $2 OFFSET $3`,
      [`%${search}%`, limit, offset]
    );

    if (result.rows.length === 0) {
      return res.status(200).json([]);
    }
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error al buscar usuarios:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getPostByIdUser = async (req, res, next) => {
  const { id_user } = req.params;
  const { offset = 0, limit = 10 } = req.query;

  try {
    const result = await pool.query(
      `SELECT 
      p.id AS post_id,
      p.title,
      p.content,
      p.banner,
      p.country,
      p.state,
      p.city,
	    p.user_id,
      p.slug,
      p.created_at,
      p.updated_at,
      p.read_count,
      p.draft,

      -- Tags como array
      COALESCE(json_agg(DISTINCT t.tag) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,

      -- Imágenes como array de objetos
      COALESCE(json_agg(DISTINCT jsonb_build_object(
        'id', bi.id,
        'url', bi.image_url,
        'alt', bi.alt_text
      )) FILTER (WHERE bi.id IS NOT NULL), '[]') AS blog_images,

      -- Cantidad de likes
      COUNT(DISTINCT l.id) AS total_likes
	  
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN post_tags pt ON p.id = pt.post_id
    LEFT JOIN tags t ON pt.tag_id = t.id
    LEFT JOIN blog_images bi ON p.id = bi.blog_id
    LEFT JOIN likes l ON p.id = l.post_id
    LEFT JOIN users lu ON l.user_id = lu.id
    WHERE p.user_id = $1
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT $2 OFFSET $3;`,
      [id_user, limit, offset]
    );

    if (result.rows.length === 0) {
      return res.status(200).json([]);
    }
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error al obtener la publicación:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getPostById = async (req, res, next) => {
  const { post_slug } = req.params;
  try {
    const result = await pool.query(
      `SELECT 
        p.id AS post_id,
        p.title,
        p.content,
        p.banner,
        p.country,
        p.state,
        p.city,
        p.user_id,
        p.slug,
        p.created_at,
        p.updated_at,
        p.read_count,
        p.is_active,
        p.draft,
        p.description,

        -- Usuario dueño del post
        json_build_object(
          'id', u.id,
          'name', u.name,
          'last_name', u.last_name,
          'user_name', u.user_name,          
          'avatar_url', u.avatar_url
        ) AS users,

        -- Tags como array
        COALESCE(json_agg(DISTINCT t.tag) FILTER (WHERE t.id IS NOT NULL), '[]') AS tags,

        -- Imágenes como array de objetos
        COALESCE(json_agg(DISTINCT jsonb_build_object(
        'id', bi.id,
        'url', bi.image_url,
        'alt', bi.alt_text
        )) FILTER (WHERE bi.id IS NOT NULL), '[]') AS blog_images,

        -- Cantidad de likes
        COUNT(DISTINCT l.id) AS total_likes,

        -- Cantidad de comentarios
        COUNT(DISTINCT c.id) AS total_comments,

        -- Usuarios que dieron like
        COALESCE(json_agg(DISTINCT jsonb_build_object(
          'id', lu.id,
          'name', lu.name,
          'last_name', lu.last_name
        )) FILTER (WHERE lu.id IS NOT NULL), '[]') AS liked_by

      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN post_tags pt ON p.id = pt.post_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      LEFT JOIN blog_images bi ON p.id = bi.blog_id
      LEFT JOIN likes l ON p.id = l.post_id
      LEFT JOIN users lu ON l.user_id = lu.id
      LEFT JOIN comments c ON p.id = c.post_id
      WHERE p.slug = $1
      GROUP BY p.id, u.id`,
      [post_slug]
    );

    if (result.rows.length === 0) {
      return res.status(200).json([]);
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error al obtener la publicación:", error);
    res.status(500).json({ message: error.message });
  }
};

export const updatePostReadCount = async (req, res) => {
  const { post_id, user_id, user_uuid } = req.body;

  if (!post_id || (!user_id && !user_uuid)) {
    return res.status(400).json({ message: "Faltan datos necesarios" });
  }

  try {
    const existRead = await pool.query(
      `SELECT * FROM post_reads 
      WHERE post_id = $1 
      AND (user_id = $2 OR user_uuid = $3)`,
      [post_id, user_id, user_uuid]
    );

    if (existRead.rowCount > 0) {
      return res
        .status(200)
        .json({ message: "El usuario ya ha leído este post" });
    }

    const result = await pool.query(
      `INSERT INTO post_reads (post_id, user_id, user_uuid) 
      VALUES ($1, $2, $3)
      ON CONFLICT (post_id, user_id) DO NOTHING
      RETURNING *`,
      [post_id, user_id, user_uuid]
    );
    if (result.rowCount === 0) {
      return res
        .status(200)
        .json({ message: "El usuario ya ha leído este post" });
    }
  } catch (error) {
    console.error("Error al actualizar el contador de lecturas:", error);
    res
      .status(500)
      .json({ message: "Error al actualizar el contador de lecturas" });
  }
};

export const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const postUpdate = req.body;
    const {
      title,
      banner,
      content,
      country,
      state,
      city,
      draft,
      tags,
      description,
    } = req.body;

    await pool.query("BEGIN"); // pausa todas las operaciones hasta que se confirme el envio

    const postResult = await pool.query(
      `UPDATE posts SET 
        title = $1, 
        content = $2, 
        banner = $3, 
        country = $4, 
        state = $5, 
        city = $6, 
        draft = $7, 
        description = $8
      WHERE id = $9 
      RETURNING *`,
      [
        title,
        JSON.stringify(content),
        banner,
        country,
        state,
        city,
        draft,
        description,
        id,
      ]
    );

    const tagsMinuscula = tags.map((tag) => tag.trim().toLowerCase());

    const tagsDelPostRes = await pool.query(
      `SELECT t.id, t.tag
        FROM post_tags pt
        JOIN tags t ON pt.tag_id = t.id
        WHERE pt.post_id = $1`,
      [id]
    );

    const tagsDelPost = tagsDelPostRes.rows.map((row) => row.tag);

    // Tags que ya no estan en el post
    const eliminaTags = tagsDelPost.filter(
      (tag)=> !tagsMinuscula.includes(tag)
    )

    for (let tag of eliminaTags) {
      const tagResult = await pool.query(`SELECT id FROM tags WHERE tag = $1`, [tag])
      if ( tagResult.rows.length > 0) {
        const tagId = tagResult.rows[0].id;
  
        await pool.query(`DELETE FROM post_tags WHERE post_id = $1 AND tag_id = $2`, [id, tagId])
      }
    }

    for (let tag of tagsMinuscula) {
      // insertar los tag en la tabla tag, si existen no pasa nada
      const tagResult = await pool.query(
        `INSERT INTO tags (tag)
        VALUES ($1)
        ON CONFLICT (tag) DO NOTHING
        RETURNING *`,
        [tag]
      )
      let tagId
      if (tagResult.rows.length > 0) {
        // si no existe en la tabla y lo crea, guarda id
        tagId = tagResult.rows[0].id
      } else {
        // si existe se consulta el id
        const existeTag = await pool.query(`SELECT id FROM tags WHERE tag = $1`, [tag])
        tagId = existeTag.rows[0].id
      }
      
      // insertar los post_tags en la tabla tag, si existen no pasa nada
      await pool.query(`
        INSERT INTO post_tags (post_id, tag_id)
        VALUES ($1, $2)
        ON CONFLICT (post_id, tag_id) DO NOTHING`,
      [id, tagId])
    }

    await pool.query("COMMIT"); // confirma las operaciones para enviar

    return res.status(201).json({
      message: "Post actualizado con exito",
    });
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("Error al actualizar el post:", error);
    res.status(500).json({ message: "Error al actualizar el post" });
  }
};

export const likePost = async (req, res) =>  {
  const {post_id, user_id} = req.body

  try {
      await pool.query(`
      INSERT INTO likes (post_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (post_id, user_id) DO NOTHING
      RETURNING *`,
    [post_id, user_id])

    const result = await pool.query(`
      SELECT id, likes_count
      FROM posts 
      WHERE id = $1`, 
      [post_id])

    return res.status(201).json(result.rows[0])
  } catch (error) {
    console.error("Error al actualizar el post:", error);
    res.status(500).json({ message: "Error al actualizar el post" });
  }
}

export const dislikePost = async (req, res) => {
  const {post_id, user_id} = req.body

  try {
    await pool.query(`
      DELETE FROM likes
      WHERE post_id = $1 
      AND user_id = $2`, [post_id, user_id])

    const result = await pool.query(`
      SELECT id, likes_count
      FROM posts 
      WHERE id = $1`, 
      [post_id])

    return res.status(201).json(result.rows[0])
  } catch (error) {
    console.error("Error al actualizar el post:", error);
    res.status(500).json({ message: "Error al actualizar el post" });
  }
}


export const deletePost = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("SELECT * FROM posts WHERE id = $1", [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Post no existe" });
    }

    const postActive = result.rows[0];

    if (Number(postActive.user_id) !== Number(req.userId)) {
      return res
        .status(403)
        .json({ message: "No tienes permiso para eliminar este post" });
    }

    if (postActive.is_active === false) {
      return res.status(404).json({ message: "Post eliminado" });
    }

    const delete_post = await pool.query(
      "UPDATE posts SET is_active = $1, deleted_at = NOW() WHERE id = $2 RETURNING *",
      [false, id]
    );
    res.status(200).json({
      message: "Post eliminado con éxito",
      post: delete_post.rows[0],
    });
  } catch (error) {
    console.error("Error al eliminar el post:", error);
    res.status(500).json({ message: error.message });
  }
};
