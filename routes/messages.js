const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // 获取所有留言
  router.get('/', async (req, res) => {
    try {
      // 查询所有留言
      const [rows] = await pool.query(`
        SELECT m.id, m.content, m.created_at as timestamp, u.username as author
        FROM messages m
        JOIN users u ON m.user_id = u.id
        ORDER BY m.created_at DESC
      `);
      
      res.json(rows);
    } catch (error) {
      console.error('获取留言列表失败:', error);
      res.status(500).json({ message: '获取留言列表失败', error: error.message });
    }
  });

  // 添加留言
  router.post('/', async (req, res) => {
    try {
      const { username, content } = req.body;
      
      if (!username || !content) {
        return res.status(400).json({ message: '缺少必要字段' });
      }
      
      // 获取用户ID
      const [userResult] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
      
      if (userResult.length === 0) {
        return res.status(404).json({ message: '用户不存在' });
      }
      
      const userId = userResult[0].id;
      
      // 插入留言
      const [result] = await pool.query(
        'INSERT INTO messages (user_id, content) VALUES (?, ?)', 
        [userId, content]
      );
      
      // 返回新添加的留言
      const [newMessage] = await pool.query(`
        SELECT m.id, m.content, m.created_at as timestamp, u.username as author
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.id = ?
      `, [result.insertId]);
      
      res.status(201).json(newMessage[0]);
    } catch (error) {
      console.error('添加留言失败:', error);
      res.status(500).json({ message: '添加留言失败', error: error.message });
    }
  });

  // 删除留言
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
      
      // 验证权限（只有留言作者或管理员可以删除）
      const [messageResult] = await pool.query(
        'SELECT user_id FROM messages WHERE id = ?', 
        [id]
      );
      
      if (messageResult.length === 0) {
        return res.status(404).json({ message: '留言不存在' });
      }
      
      const messageUserId = messageResult[0].user_id;
      
      if (messageUserId !== userId && !isAdmin) {
        return res.status(403).json({ message: '无权删除此留言' });
      }
      
      // 删除留言
      await pool.query('DELETE FROM messages WHERE id = ?', [id]);
      
      res.json({ message: '留言已成功删除' });
    } catch (error) {
      console.error('删除留言失败:', error);
      res.status(500).json({ message: '删除留言失败', error: error.message });
    }
  });
  
  // 清空所有留言（仅管理员）
  router.delete('/clear', async (req, res) => {
    try {
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({ message: '缺少用户名' });
      }
      
      // 验证是否为管理员
      const [userResult] = await pool.query('SELECT is_admin FROM users WHERE username = ?', [username]);
      
      if (userResult.length === 0) {
        return res.status(404).json({ message: '用户不存在' });
      }
      
      if (!userResult[0].is_admin) {
        return res.status(403).json({ message: '只有管理员可以清空所有留言' });
      }
      
      // 清空所有留言
      await pool.query('DELETE FROM messages');
      
      res.json({ message: '所有留言已清空' });
    } catch (error) {
      console.error('清空留言失败:', error);
      res.status(500).json({ message: '清空留言失败', error: error.message });
    }
  });

  return router;
}; 