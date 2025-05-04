const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

module.exports = (pool) => {
  // 用户注册
  router.post('/register', async (req, res) => {
    try {
      const { username, password, email } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: '用户名和密码不能为空' });
      }
      
      // 检查用户名是否已存在
      const [existingUsers] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
      if (existingUsers.length > 0) {
        return res.status(409).json({ message: '用户名已存在' });
      }
      
      // 哈希密码
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // 插入新用户
      const [result] = await pool.query(
        'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
        [username, hashedPassword, email || null]
      );
      
      // 生成JWT
      const token = jwt.sign(
        { id: result.insertId, username },
        JWT_SECRET,
        { expiresIn: '1d' }
      );
      
      res.status(201).json({
        message: '用户注册成功',
        user: {
          id: result.insertId,
          username,
          email: email || null
        },
        token
      });
    } catch (error) {
      console.error('用户注册失败:', error);
      res.status(500).json({ message: '用户注册失败', error: error.message });
    }
  });

  // 用户登录
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: '用户名和密码不能为空' });
      }
      
      // 获取用户信息
      const [users] = await pool.query('SELECT id, username, password, is_admin FROM users WHERE username = ?', [username]);
      
      if (users.length === 0) {
        return res.status(401).json({ message: '用户名或密码错误' });
      }
      
      const user = users[0];
      
      // 验证密码
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: '用户名或密码错误' });
      }
      
      // 生成JWT
      const token = jwt.sign(
        { id: user.id, username: user.username, isAdmin: user.is_admin },
        JWT_SECRET,
        { expiresIn: '1d' }
      );
      
      res.json({
        message: '登录成功',
        user: {
          id: user.id,
          username: user.username,
          is_admin: user.is_admin
        },
        token
      });
    } catch (error) {
      console.error('用户登录失败:', error);
      res.status(500).json({ message: '用户登录失败', error: error.message });
    }
  });

  // 获取当前用户信息
  router.get('/me', async (req, res) => {
    try {
      // 从请求头获取Token
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ message: '未提供认证Token' });
      }
      
      // 验证Token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // 从数据库获取最新的用户信息
      const [users] = await pool.query('SELECT id, username, email, is_admin, created_at FROM users WHERE id = ?', [decoded.id]);
      
      if (users.length === 0) {
        return res.status(404).json({ message: '用户不存在' });
      }
      
      const user = users[0];
      
      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          is_admin: user.is_admin,
          created_at: user.created_at
        }
      });
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: '无效的Token或Token已过期' });
      }
      console.error('获取用户信息失败:', error);
      res.status(500).json({ message: '获取用户信息失败', error: error.message });
    }
  });

  // 获取用户创建的内容
  router.get('/:username/contents', async (req, res) => {
    try {
      const { username } = req.params;
      const { type, limit = 10, page = 1 } = req.query;
      const offset = (page - 1) * limit;
      
      // 获取用户ID
      const [userResult] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
      
      if (userResult.length === 0) {
        return res.status(404).json({ message: '用户不存在' });
      }
      
      const userId = userResult[0].id;
      
      // 构建查询条件
      let conditions = ['c.author_id = ?'];
      let params = [userId];
      
      if (type) {
        conditions.push('c.type = ?');
        params.push(type);
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      // 查询内容
      const [contentRows] = await pool.query(`
        SELECT 
          c.id, c.title, c.content, c.type, c.category, c.views, 
          c.created_at, c.updated_at, u.username as author
        FROM contents c
        JOIN users u ON c.author_id = u.id
        ${whereClause}
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), parseInt(offset)]);
      
      // 为每个内容项添加点赞和评论数据
      const contentsWithStats = await Promise.all(contentRows.map(async (content) => {
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
      console.error('获取用户内容失败:', error);
      res.status(500).json({ message: '获取用户内容失败', error: error.message });
    }
  });

  // 更新用户信息
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { username, email, currentPassword, newPassword } = req.body;
      
      // 验证Token
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ message: '未提供认证Token' });
      }
      
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // 只允许用户更新自己的信息，或管理员更新任何用户
      if (decoded.id != id && !decoded.isAdmin) {
        return res.status(403).json({ message: '无权更新其他用户的信息' });
      }
      
      // 检查用户是否存在
      const [userResult] = await pool.query('SELECT id, password FROM users WHERE id = ?', [id]);
      
      if (userResult.length === 0) {
        return res.status(404).json({ message: '用户不存在' });
      }
      
      const user = userResult[0];
      
      // 如果要更改密码，验证当前密码
      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({ message: '更改密码需要提供当前密码' });
        }
        
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
          return res.status(401).json({ message: '当前密码错误' });
        }
        
        // 哈希新密码
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // 更新密码
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
      }
      
      // 更新其他信息
      if (username || email) {
        // 如果更新用户名，检查是否已存在
        if (username) {
          const [existingUser] = await pool.query('SELECT id FROM users WHERE username = ? AND id != ?', [username, id]);
          if (existingUser.length > 0) {
            return res.status(409).json({ message: '用户名已存在' });
          }
        }
        
        const updateFields = [];
        const updateValues = [];
        
        if (username) {
          updateFields.push('username = ?');
          updateValues.push(username);
        }
        
        if (email) {
          updateFields.push('email = ?');
          updateValues.push(email);
        }
        
        if (updateFields.length > 0) {
          await pool.query(
            `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
            [...updateValues, id]
          );
        }
      }
      
      // 获取更新后的用户信息
      const [updatedUser] = await pool.query(
        'SELECT id, username, email, is_admin, created_at FROM users WHERE id = ?',
        [id]
      );
      
      res.json({
        message: '用户信息更新成功',
        user: updatedUser[0]
      });
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: '无效的Token或Token已过期' });
      }
      console.error('更新用户信息失败:', error);
      res.status(500).json({ message: '更新用户信息失败', error: error.message });
    }
  });

  return router;
}; 