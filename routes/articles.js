const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // 获取所有内容（文章和随笔）
  router.get('/', async (req, res) => {
    try {
      // 获取查询参数
      const { type, category, limit = 10, page = 1 } = req.query;
      const offset = (page - 1) * limit;
      
      // 构建查询条件
      let conditions = [];
      let params = [];
      
      if (type) {
        conditions.push('c.type = ?');
        params.push(type);
      }
      
      if (category) {
        conditions.push('c.category = ?');
        params.push(category);
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      // 查询内容
      const [rows] = await pool.query(`
        SELECT 
          c.id, c.title, c.content, c.type, c.category, c.views, 
          c.created_at, c.updated_at, u.username as author
        FROM contents c
        LEFT JOIN users u ON c.author_id = u.id
        ${whereClause}
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), parseInt(offset)]);
      
      // 为每个内容项添加点赞和评论数
      const contentsWithStats = await Promise.all(rows.map(async (content) => {
        // 获取点赞数
        const [likesResult] = await pool.query(
          'SELECT COUNT(*) as likes_count FROM likes WHERE content_id = ?', 
          [content.id]
        );
        
        // 获取评论数
        const [commentsResult] = await pool.query(
          'SELECT COUNT(*) as comments_count FROM comments WHERE content_id = ?', 
          [content.id]
        );
        
        return {
          ...content,
          likes: likesResult[0].likes_count,
          comments_count: commentsResult[0].comments_count
        };
      }));
      
      res.json(contentsWithStats);
    } catch (error) {
      console.error('获取内容列表失败:', error);
      res.status(500).json({ message: '获取内容列表失败', error: error.message });
    }
  });

  // 获取单个内容（文章或随笔）
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      // 查询内容
      const [contentRows] = await pool.query(`
        SELECT 
          c.id, c.title, c.content, c.type, c.category, c.views, 
          c.created_at, c.updated_at, u.username as author
        FROM contents c
        LEFT JOIN users u ON c.author_id = u.id
        WHERE c.id = ?
      `, [id]);
      
      if (contentRows.length === 0) {
        return res.status(404).json({ message: '内容不存在' });
      }
      
      const content = contentRows[0];
      
      // 增加浏览量
      await pool.query('UPDATE contents SET views = views + 1 WHERE id = ?', [id]);
      content.views += 1;
      
      // 获取点赞数和点赞用户
      const [likesResult] = await pool.query(
        'SELECT u.username FROM likes l JOIN users u ON l.user_id = u.id WHERE l.content_id = ?', 
        [id]
      );
      
      // 获取评论
      const [commentsResult] = await pool.query(`
        SELECT 
          c.id, c.comment_text, c.created_at, 
          u.username, u.is_admin as is_owner
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.content_id = ?
        ORDER BY c.created_at DESC
      `, [id]);
      
      // 获取内容相关的标签
      const [tagsResult] = await pool.query(`
        SELECT t.name
        FROM content_tags ct
        JOIN tags t ON ct.tag_id = t.id
        WHERE ct.content_id = ?
      `, [id]);
      
      res.json({
        ...content,
        likes: likesResult.length,
        liked_by: likesResult.map(like => like.username),
        comments: commentsResult,
        tags: tagsResult.map(tag => tag.name)
      });
    } catch (error) {
      console.error('获取内容详情失败:', error);
      res.status(500).json({ message: '获取内容详情失败', error: error.message });
    }
  });

  // 创建新内容（文章或随笔）
  router.post('/', async (req, res) => {
    try {
      const { title, content, type, category, username, tags } = req.body;
      
      if (!title || !content || !type || !username) {
        return res.status(400).json({ message: '缺少必要字段' });
      }
      
      // 获取用户ID
      const [userResult] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
      if (userResult.length === 0) {
        return res.status(404).json({ message: '用户不存在' });
      }
      const authorId = userResult[0].id;
      
      // 开始事务
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      
      try {
        // 插入内容
        const [contentResult] = await connection.query(
          'INSERT INTO contents (title, content, type, category, author_id) VALUES (?, ?, ?, ?, ?)', 
          [title, content, type, category || null, authorId]
        );
        
        const contentId = contentResult.insertId;
        
        // 处理标签
        if (tags && tags.length > 0) {
          for (const tagName of tags) {
            // 检查标签是否存在，不存在则创建
            let tagId;
            const [tagResult] = await connection.query('SELECT id FROM tags WHERE name = ?', [tagName]);
            
            if (tagResult.length === 0) {
              const [newTagResult] = await connection.query('INSERT INTO tags (name) VALUES (?)', [tagName]);
              tagId = newTagResult.insertId;
            } else {
              tagId = tagResult[0].id;
            }
            
            // 关联内容和标签
            await connection.query('INSERT INTO content_tags (content_id, tag_id) VALUES (?, ?)', [contentId, tagId]);
          }
        }
        
        await connection.commit();
        
        res.status(201).json({
          id: contentId,
          title,
          content,
          type,
          category,
          author: username,
          created_at: new Date(),
          message: '内容创建成功'
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('创建内容失败:', error);
      res.status(500).json({ message: '创建内容失败', error: error.message });
    }
  });

  // 更新内容
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { title, content, category, tags, username } = req.body;
      
      // 验证用户权限 (只有作者或管理员可以更新)
      const [contentRow] = await pool.query(`
        SELECT c.author_id, u.username, u.is_admin
        FROM contents c
        JOIN users u ON c.author_id = u.id
        WHERE c.id = ?
      `, [id]);
      
      if (contentRow.length === 0) {
        return res.status(404).json({ message: '内容不存在' });
      }
      
      // 获取当前用户信息
      const [userRow] = await pool.query('SELECT id, is_admin FROM users WHERE username = ?', [username]);
      
      if (userRow.length === 0) {
        return res.status(404).json({ message: '用户不存在' });
      }
      
      const isAdmin = userRow[0].is_admin;
      const isAuthor = contentRow[0].author_id === userRow[0].id;
      
      if (!isAdmin && !isAuthor) {
        return res.status(403).json({ message: '无权执行此操作' });
      }
      
      // 开始事务
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      
      try {
        // 更新内容
        await connection.query(
          'UPDATE contents SET title = ?, content = ?, category = ?, updated_at = NOW() WHERE id = ?', 
          [title, content, category, id]
        );
        
        // 如果提供了新标签，则更新标签
        if (tags) {
          // 删除旧的标签关联
          await connection.query('DELETE FROM content_tags WHERE content_id = ?', [id]);
          
          // 添加新的标签关联
          for (const tagName of tags) {
            let tagId;
            const [tagResult] = await connection.query('SELECT id FROM tags WHERE name = ?', [tagName]);
            
            if (tagResult.length === 0) {
              const [newTagResult] = await connection.query('INSERT INTO tags (name) VALUES (?)', [tagName]);
              tagId = newTagResult.insertId;
            } else {
              tagId = tagResult[0].id;
            }
            
            await connection.query('INSERT INTO content_tags (content_id, tag_id) VALUES (?, ?)', [id, tagId]);
          }
        }
        
        await connection.commit();
        
        res.json({
          id,
          message: '内容更新成功'
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('更新内容失败:', error);
      res.status(500).json({ message: '更新内容失败', error: error.message });
    }
  });

  // 删除内容
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { username } = req.body;
      
      // 验证用户权限 (只有作者或管理员可以删除)
      const [contentRow] = await pool.query(`
        SELECT c.author_id, u.username, u.is_admin
        FROM contents c
        JOIN users u ON c.author_id = u.id
        WHERE c.id = ?
      `, [id]);
      
      if (contentRow.length === 0) {
        return res.status(404).json({ message: '内容不存在' });
      }
      
      // 获取当前用户信息
      const [userRow] = await pool.query('SELECT id, is_admin FROM users WHERE username = ?', [username]);
      
      if (userRow.length === 0) {
        return res.status(404).json({ message: '用户不存在' });
      }
      
      const isAdmin = userRow[0].is_admin;
      const isAuthor = contentRow[0].author_id === userRow[0].id;
      
      if (!isAdmin && !isAuthor) {
        return res.status(403).json({ message: '无权执行此操作' });
      }
      
      // 删除内容 (关联的评论、点赞和标签关联会通过外键约束自动删除)
      await pool.query('DELETE FROM contents WHERE id = ?', [id]);
      
      res.json({ message: '内容已成功删除' });
    } catch (error) {
      console.error('删除内容失败:', error);
      res.status(500).json({ message: '删除内容失败', error: error.message });
    }
  });

  // 添加评论
  router.post('/:id/comments', async (req, res) => {
    try {
      const { id } = req.params;
      const { username, comment_text } = req.body;
      
      if (!username || !comment_text) {
        return res.status(400).json({ message: '缺少必要字段' });
      }
      
      // 检查内容是否存在
      const [contentResult] = await pool.query('SELECT id FROM contents WHERE id = ?', [id]);
      if (contentResult.length === 0) {
        return res.status(404).json({ message: '内容不存在' });
      }
      
      // 获取用户ID
      const [userResult] = await pool.query('SELECT id, is_admin FROM users WHERE username = ?', [username]);
      if (userResult.length === 0) {
        return res.status(404).json({ message: '用户不存在' });
      }
      
      const userId = userResult[0].id;
      const isOwner = userResult[0].is_admin;
      
      // 插入评论
      const [result] = await pool.query(
        'INSERT INTO comments (content_id, user_id, comment_text) VALUES (?, ?, ?)', 
        [id, userId, comment_text]
      );
      
      res.status(201).json({
        id: result.insertId,
        content_id: id,
        username,
        comment_text,
        is_owner: isOwner,
        created_at: new Date(),
        message: '评论添加成功'
      });
    } catch (error) {
      console.error('添加评论失败:', error);
      res.status(500).json({ message: '添加评论失败', error: error.message });
    }
  });

  // 点赞/取消点赞
  router.post('/:id/like', async (req, res) => {
    try {
      const { id } = req.params;
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({ message: '缺少用户名' });
      }
      
      // 检查内容是否存在
      const [contentResult] = await pool.query('SELECT id FROM contents WHERE id = ?', [id]);
      if (contentResult.length === 0) {
        return res.status(404).json({ message: '内容不存在' });
      }
      
      // 获取用户ID
      const [userResult] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
      if (userResult.length === 0) {
        return res.status(404).json({ message: '用户不存在' });
      }
      const userId = userResult[0].id;
      
      // 检查用户是否已点赞
      const [likeResult] = await pool.query(
        'SELECT id FROM likes WHERE content_id = ? AND user_id = ?', 
        [id, userId]
      );
      
      let message;
      if (likeResult.length > 0) {
        // 已点赞，取消点赞
        await pool.query('DELETE FROM likes WHERE content_id = ? AND user_id = ?', [id, userId]);
        message = '已取消点赞';
      } else {
        // 未点赞，添加点赞
        await pool.query('INSERT INTO likes (content_id, user_id) VALUES (?, ?)', [id, userId]);
        message = '点赞成功';
      }
      
      // 获取最新点赞数
      const [likesCountResult] = await pool.query(
        'SELECT COUNT(*) as likes_count FROM likes WHERE content_id = ?', 
        [id]
      );
      
      res.json({
        content_id: id,
        liked: likeResult.length === 0, // 如果之前没有点赞，现在就是点赞状态
        likes_count: likesCountResult[0].likes_count,
        message
      });
    } catch (error) {
      console.error('处理点赞失败:', error);
      res.status(500).json({ message: '处理点赞失败', error: error.message });
    }
  });

  return router;
}; 