export const buildCommentTree = (comments) => {
  if (!Array.isArray(comments)) return []

  const map = {}
  const roots = []

   // Indexar los comentarios por ID
  comments.forEach(c => {
    map[c.comment_id] = {...c, replies: [], level: 0}
  })

  // construye el arbol de comentarios
  comments.forEach(c => {
    if(c.parent_comment_id === null || c.parent_comment_id === undefined) {
      roots.push(map[c.comment_id])
    } else {
      const parent = map[c.parent_comment_id]
      if(parent) {
        map[c.parent_comment_id].replies.push(map[c.comment_id])
        map[c.comment_id].level = (parent.level || 0) + 1
      }
    }
  })

  return roots
}