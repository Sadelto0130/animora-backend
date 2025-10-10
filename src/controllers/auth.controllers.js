import bcrypt from "bcrypt";
import { pool } from "../db.js";
import { createAccessToken, createRefreshToken } from "../libs/jwt.js";
import jwt from "jsonwebtoken";
import { createAvatar, generateUsername } from "../libs/functions.js";

let emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;

export const login = async (req, res) => {
  const { email, password } = req.body;
  let client;

  try {
    client = await pool.connect();

    // Obtener el usuario de la base de datos
    const result = await client.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Usuario no encontrado" });
    }

    const user = result.rows[0];

    // Verificar si el usuario esta activo
    if (!user.is_active) {
      return res.status(400).json({ message: "Usuario inactivo" });
    }

    // Verificar si el usuario registrado con google
    if (user.google_auth) {
      return res.status(400).json({ message: "Usuario registrado con Google" });
    }

    // Verificar si la contraseña proporcionada coincide con la almacenada que esta hasheada en la base de datos utilizando bcrypt
    const isMatch = await bcrypt.compare(password, user.password);

    // Verificar si la contraseña es correcta
    if (!isMatch) {
      return res.status(400).json({ message: "Contraseña incorrecta" });
    }

    // Crear un token de acceso para los usuarios autenticados
    const token = await createAccessToken({ id: user.id });
    const refreshToken = await createRefreshToken(user);

    // Agregar el token a las cookies
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" ? false : true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const userData = { ...result.rows[0] };
    delete userData.password;
    userData.avatar_url = userData.avatar_url.replace(/;/g, "");
    
    return res.json(userData);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error al iniciar sesión" });
  } finally {
    if (client) client.release();
  }
};

export const register = async (req, res, next) => {
  const { name, last_name, email, password } = req.body;

  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Email inválido" });
  }

  let client;

  try {
    client = await pool.connect();
    const hashedPassword = await bcrypt.hash(password, 10);

    let find_email = await client.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (find_email.rows.length > 0) {
      return res
        .status(400)
        .json({ message: "El correo electrónico ya está en uso" });
    }

    const user_name = await generateUsername(email);

    const avatar_url = await createAvatar(name, last_name);

    const result = await client.query(
      "INSERT INTO users (name, last_name, email, user_name, password, avatar_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [name, last_name, email, user_name, hashedPassword, avatar_url]
    );

    await client.query(`
      INSERT INTO social_links (user_id, platform, url) 
      values 
        ($1, 'facebook', ''),
        ($1, 'instagram', ''),
        ($1, 'youtube', ''),
        ($1, 'website', '')
      `, [result.rows[0].id])

    const tokenData = { idUser: result.rows[0].id };

    const token = await createAccessToken(tokenData);
    const refreshToken = await createRefreshToken(tokenData);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" ? false : true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const user = { ...result.rows[0] };
    delete user.password;
    return res.json(user);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({ message: error.detail });
    }
  } finally {
    if (client) client.release();
  }
};

export const logout = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  return res.json({ message: "Sesión cerrada correctamente" });
};
 
export const getProfile = async (req, res) => {
  const {user_name} = req.params
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.last_name,
        u.email,
        u.user_name,
        u.avatar_url,
        u.created_at,
        u.deleted_at,
        u.google_auth,
        u.bio,
        u.type_user,
        COALESCE(
            json_agg(
                json_build_object(
                    'id', s.id,
                    'user_id', s.user_id,
                    'platform_name', s.platform,
                    'url', s.url
                )
            ) FILTER (WHERE s.id IS NOT NULL),
            '[]'
        ) AS social_links
    FROM users u
    LEFT JOIN social_links s ON u.id = s.user_id
    WHERE u.user_name = $1 
    AND u.is_active = true
    GROUP BY u.id, u.name, u.last_name, u.email, u.user_name, 
    u.avatar_url, u.created_at, u.deleted_at, u.google_auth, u.bio, u.type_user`, 
    [user_name]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const userData = { ...result.rows[0] };
    delete userData.password;

    if (userData.avatar_url) {
      userData.avatar_url = userData.avatar_url.replace(/;/g, "");
    }
    return res.json(userData);

  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error al obtener el perfil" });
  }
};

export const deleteUser = async (req, res) => {
  const { id } = req.userId;
  try {
    const userActive = await pool.query("SELECT * FROM users WHERE id = $1", [
      id,
    ]);

    if (userActive.rowCount === 0) {
      return res.status(404).json({ message: "Usuario no existe" });
    }

    if (userActive.rows[0].is_active === false) {
      return res.status(404).json({ message: "Usuario eliminado" });
    }

    const result = await pool.query(
      "UPDATE users SET is_active = $1, deleted_at = NOW() WHERE id = $2 RETURNING *",
      [false, id]
    );

    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    res.status(200).json({
      message: "Usuario eliminado con éxito",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Error al eliminar el usuario:", error);
    res.status(500).json({ message: error.message });
  }
};

export const changePassword = async(req, res) => {
  const { newPassword, currentPassword, id } = req.body
  try {
    const userActive = await pool.query("SELECT * FROM users WHERE id = $1", [
      id,
    ]);

    if (userActive.rowCount === 0) {
      return res.status(404).json({ message: "Usuario no existe" });
    }

    if (userActive.rows[0].is_active === false) {
      return res.status(404).json({ message: "Usuario eliminado" });
    }

    const validatePassword = await pool.query("SELECT password FROM users WHERE id = $1", [id])

    const comparePassword = await bcrypt.compare(currentPassword, validatePassword.rows[0].password)
    if(!comparePassword) { return res.status(404).json({message: "La contraseña actual no es correcta"})}

    const compareNewPassword = await bcrypt.compare(newPassword, validatePassword.rows[0].password)
    if(compareNewPassword) { return res.status(404).json({message: "La contraseña nueva no puede ser igual a la anterior"})}

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const result = await pool.query(
      "UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [hashedPassword, id]
    );

    res.status(200).json({message: "Contraseña cambiada"})
  } catch (error) {
    console.error("Error al cambiar la contraseña:", error);
    res.status(500).json({ message: error.message });
  }
}

export const updateImgProfile = async(req, res) => {
  const { imgUrl, id_user} = req.body

  try {
    const userActive = await pool.query("SELECT * FROM users WHERE id = $1", [id_user]);

    if (userActive.rowCount === 0) {
      return res.status(404).json({ message: "Usuario no existe" });
    }

    if (userActive.rows[0].is_active === false) {
      return res.status(404).json({ message: "Usuario eliminado" });
    }

    const result = await pool.query(
      "UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [imgUrl, id_user]
    );
    const io = req.app.get("io")
    io.emit("update-img-profile", result.rows[0])
    return res.status(200).json(result.rows[0])

  } catch (error) {
    console.error("Error al cambiar la contraseña:", error);
    res.status(500).json({ message: error.message });
  }
}

export const googleRegisterUser = async (req, res) => {
  const google_token = req.body.google_token;

  const { email, name: name_google, user_id } = jwt.decode(google_token);

  const nombre_usuario = name_google.split(" ")

  const name = nombre_usuario[0]
  const last_name = nombre_usuario.slice(1).join(" ")
  const password = user_id

  let client;

  try {
    client = await pool.connect();
    const hashedPassword = await bcrypt.hash(password, 10);

    let find_email = await client.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (find_email.rows.length > 0) {
      return res
        .status(400)
        .json({ message: "El correo electrónico ya está en uso" });
    }

    const user_name = await generateUsername(email);

    const avatar_url = await createAvatar(name, last_name);

    const result = await client.query(
      "INSERT INTO users (name, last_name, email, user_name, password, avatar_url, google_auth) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [name, last_name, email, user_name, hashedPassword, avatar_url, true]
    );

    await client.query(`
      INSERT INTO social_links (user_id, platform, url) 
      values 
        ($1, 'facebook', ''),
        ($1, 'instagram', ''),
        ($1, 'youtube', ''),
        ($1, 'website', '')
      `, [result.rows[0].id])

    const tokenData = { idUser: result.rows[0].id };

    const token = await createAccessToken(tokenData);
    const refreshToken = await createRefreshToken(tokenData);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" ? false : true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const user = { ...result.rows[0] };
    delete user.password;
    return res.json(user);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({ message: error.detail });
    }
  } finally {
    if (client) client.release();
  }
};

export const googleLoginUser = async (req, res) => {
  const google_token = req.body.google_token;

  const { email, name } = jwt.decode(google_token);

  let client;

  try {
    client = await pool.connect();
    const result = await client.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Usuario no encontrado" });
    }

    const user = result.rows[0];

    if (!user.google_auth) {
      return res
        .status(400)
        .json({ message: "Debe ingresar con correo y contraseña" });
    }

    // Verificar si el usuario esta activo
    if (!user.is_active) {
      return res.status(400).json({ message: "Usuario inactivo" });
    }

    // Crear un token de acceso para los usuarios autenticados
    const token = await createAccessToken({ id: user.id });
    const refreshToken = await createRefreshToken(user);

    // Agregar el token a las cookies
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" ? false : true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const userData = { ...result.rows[0] };
    delete userData.password;
    if (userData.avatar_url) {
      userData.avatar_url = userData.avatar_url.replace(/;/g, "");
    }
    return res.json(userData);
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Error al iniciar sesión con Google" });
  } finally {
    if (client) client.release();
  }

  return res.json({ message: "Función en desarrollo", google_token_decode });
};

export const me = async (req, res) => {
  let client;

  try {
    client = await pool.connect();
    const result = await client.query("SELECT * FROM users WHERE id = $1", [
      req.userId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const user = { ...result.rows[0] };
    delete user.password;
    return res.json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error al obtener el usuario" });
  } finally {
    if (client) client.release();
  }
};

export const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;

    if (!token) {
      return res
        .status(401)
        .json({ message: "No se proporcionó un token de actualización" });
    }

    jwt.verify(token, "xyz123", (err, user) => {
      if (err) {
        return res
          .status(403)
          .json({ message: "Token de actualización inválido" });
      }

      const newAccessToken = createAccessToken({ id: user.id });

      res.cookie("token", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 24 * 60 * 60 * 1000, // 1 día
      });

      return res.json({ message: "Token actualizado" });
    });
  } catch (err) {
    console.error("Error en refreshToken:", err);
    return res.status(500).json({ message: "Error interno al renovar token" });
  }
};
