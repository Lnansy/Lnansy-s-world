const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // 获取音乐的所有评论
  router.get('/:musicId', async (req, res) => {
    try {
      const { musicId } = req.params;
      
      // 查询音乐评论
      const [rows] = await pool.query(`
        SELECT mc.id, mc.content, mc.created_at as timestamp, u.username, 
               u.username = 'Lnansy' as isOwner,
               (SELECT JSON_ARRAYAGG(ul.username) 
                FROM music_comment_likes mcl
                JOIN users ul ON mcl.user_id = ul.id
                WHERE mcl.comment_id = mc.id) as likes
        FROM music_comments mc
        JOIN users u ON mc.user_id = u.id
        WHERE mc.music_id = ?
        ORDER BY mc.created_at DESC
      `, [musicId]);
      
      // 处理查询结果，确保likes是数组
      const comments = rows.map(comment => {
        let likes = [];
        if (comment.likes) {
          try {
            likes = JSON.parse(comment.likes);
          } catch (e) {
            console.error('解析点赞列表失败:', e);
          }
        }
        return {
          ...comment,
          likes: likes || []
        };
      });
      
      res.json(comments);
    } catch (error) {
      console.error('获取音乐评论失败:', error);
      res.status(500).json({ message: '获取音乐评论失败', error: error.message });
    }
  });

  // 添加音乐评论
  router.post('/', async (req, res) => {
    try {
      const { musicId, username, content } = req.body;
      
      if (!musicId || !username || !content) {
        return res.status(400).json({ message: '缺少必要字段' });
      }
      
      // 获取用户ID
      const [userResult] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
      
      if (userResult.length === 0) {
        return res.status(404).json({ message: '用户不存在' });
      }
      
      const userId = userResult[0].id;
      
      // 插入评论
      const [result] = await pool.query(
        'INSERT INTO music_comments (music_id, user_id, content) VALUES (?, ?, ?)', 
        [musicId, userId, content]
      );
      
      // 返回新添加的评论
      const [newComment] = await pool.query(`
        SELECT mc.id, mc.content, mc.created_at as timestamp, u.username, u.username = 'Lnansy' as isOwner
        FROM music_comments mc
        JOIN users u ON mc.user_id = u.id
        WHERE mc.id = ?
      `, [result.insertId]);
      
      // 添加空的likes数组
      const comment = {
        ...newComment[0],
        likes: []
      };
      
      res.status(201).json(comment);
    } catch (error) {
      console.error('添加音乐评论失败:', error);
      res.status(500).json({ message: '添加音乐评论失败', error: error.message });
    }
  });

  // 删除音乐评论
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({ message: '缺少用户名' });
      }
      
      // 获取用户信息
      const [userResult] = await pool.query('SELECT id, is_admin FROM users WHERE username = ?', [username]);
      
      if (userResult.length === 0) {
        return res.status(404).json({ message: '用户不存在' });
      }
      
      const userId = userResult[0].id;
      const isAdmin = userResult[0].is_admin;
      
      // 验证权限（只有评论作者或管理员可以删除）
      const [commentResult] = await pool.query(
        'SELECT user_id FROM music_comments WHERE id = ?', 
        [id]
      );
      
      if (commentResult.length === 0) {
        return res.status(404).json({ message: '评论不存在' });
      }
      
      const commentUserId = commentResult[0].user_id;
      
      if (commentUserId !== userId && !isAdmin) {
        return res.status(403).json({ message: '无权删除此评论' });
      }
      
      // 删除评论
      await pool.query('DELETE FROM music_comments WHERE id = ?', [id]);
      
      res.json({ message: '评论已成功删除' });
    } catch (error) {
      console.error('删除音乐评论失败:', error);
      res.status(500).json({ message: '删除音乐评论失败', error: error.message });
    }
  });
  
  // 点赞/取消点赞评论
  router.post('/:id/like', async (req, res) => {
    try {
      const { id } = req.params;
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({ message: '缺少用户名' });
      }
      
      // 获取用户ID
      const [userResult] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
      
      if (userResult.length === 0) {
        return res.status(404).json({ message: '用户不存在' });
      }
      
      const userId = userResult[0].id;
      
      // 检查评论是否存在
      const [commentResult] = await pool.query('SELECT id FROM music_comments WHERE id = ?', [id]);
      
      if (commentResult.length === 0) {
        return res.status(404).json({ message: '评论不存在' });
      }
      
      // 检查用户是否已点赞
      const [likeResult] = await pool.query(
        'SELECT id FROM music_comment_likes WHERE comment_id = ? AND user_id = ?', 
        [id, userId]
      );
      
      let isLiked = false;
      
      if (likeResult.length > 0) {
        // 已点赞，取消点赞
        await pool.query('DELETE FROM music_comment_likes WHERE comment_id = ? AND user_id = ?', [id, userId]);
        isLiked = false;
      } else {
        // 未点赞，添加点赞
        await pool.query('INSERT INTO music_comment_likes (comment_id, user_id) VALUES (?, ?)', [id, userId]);
        isLiked = true;
      }
      
      // 获取最新点赞数据
      const [likesResult] = await pool.query(`
        SELECT u.username
        FROM music_comment_likes mcl
        JOIN users u ON mcl.user_id = u.id
        WHERE mcl.comment_id = ?
      `, [id]);
      
      const likes = likesResult.map(like => like.username);
      
      res.json({
        isLiked,
        likes,
        message: isLiked ? '点赞成功' : '已取消点赞'
      });
    } catch (error) {
      console.error('点赞评论失败:', error);
      res.status(500).json({ message: '点赞评论失败', error: error.message });
    }
  });

  return router;
}; 