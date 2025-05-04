const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // 获取访问统计
  router.get('/visits', async (req, res) => {
    try {
      // 增加今日访问统计
      await pool.query(`
        INSERT INTO visit_stats (visit_date, count) 
        VALUES (CURRENT_DATE, 1) 
        ON DUPLICATE KEY UPDATE count = count + 1
      `);
      
      // 获取总访问量
      const [totalResult] = await pool.query('SELECT SUM(count) as total FROM visit_stats');
      
      // 获取过去7天的访问量
      const [weeklyResult] = await pool.query(`
        SELECT visit_date, count 
        FROM visit_stats
        WHERE visit_date >= DATE_SUB(CURRENT_DATE, INTERVAL 6 DAY)
        ORDER BY visit_date
      `);
      
      res.json({
        visitCount: totalResult[0].total || 0,
        weeklyStats: weeklyResult
      });
    } catch (error) {
      console.error('获取访问统计失败:', error);
      res.status(500).json({ message: '获取访问统计失败', error: error.message });
    }
  });

  // 获取内容统计
  router.get('/contents', async (req, res) => {
    try {
      // 获取文章总数
      const [articleResult] = await pool.query(
        "SELECT COUNT(*) as count FROM contents WHERE type = 'article'"
      );
      
      // 获取随笔总数
      const [essayResult] = await pool.query(
        "SELECT COUNT(*) as count FROM contents WHERE type = 'essay'"
      );
      
      // 获取总点赞数
      const [likesResult] = await pool.query('SELECT COUNT(*) as count FROM likes');
      
      // 获取总评论数
      const [commentsResult] = await pool.query('SELECT COUNT(*) as count FROM comments');
      
      // 获取标签统计 - 修改为获取所有标签，不只是已关联的
      const [tagsResult] = await pool.query(`
        SELECT 
          t.id, 
          t.name, 
          COUNT(ct.content_id) as count 
        FROM tags t 
        LEFT JOIN content_tags ct ON t.id = ct.tag_id 
        GROUP BY t.id, t.name 
        ORDER BY count DESC
      `);
      
      res.json({
        articles: parseInt(articleResult[0].count) || 0,
        essays: parseInt(essayResult[0].count) || 0,
        likes: parseInt(likesResult[0].count) || 0,
        comments: parseInt(commentsResult[0].count) || 0,
        tags: tagsResult
      });
    } catch (error) {
      console.error('获取内容统计失败:', error);
      res.status(500).json({ message: '获取内容统计失败', error: error.message });
    }
  });

  // 获取热门内容
  router.get('/popular', async (req, res) => {
    try {
      const { limit = 5 } = req.query;
      
      // 获取浏览量最高的内容
      const [popularByViews] = await pool.query(`
        SELECT 
          c.id, c.title, c.type, c.views, c.created_at, 
          u.username as author,
          (SELECT COUNT(*) FROM likes WHERE content_id = c.id) as likes,
          (SELECT COUNT(*) FROM comments WHERE content_id = c.id) as comments
        FROM contents c
        JOIN users u ON c.author_id = u.id
        ORDER BY c.views DESC
        LIMIT ?
      `, [parseInt(limit)]);
      
      // 获取点赞最多的内容
      const [popularByLikes] = await pool.query(`
        SELECT 
          c.id, c.title, c.type, c.views, c.created_at, 
          u.username as author,
          (SELECT COUNT(*) FROM likes WHERE content_id = c.id) as likes,
          (SELECT COUNT(*) FROM comments WHERE content_id = c.id) as comments
        FROM contents c
        JOIN users u ON c.author_id = u.id
        ORDER BY (SELECT COUNT(*) FROM likes WHERE content_id = c.id) DESC
        LIMIT ?
      `, [parseInt(limit)]);
      
      // 获取评论最多的内容
      const [popularByComments] = await pool.query(`
        SELECT 
          c.id, c.title, c.type, c.views, c.created_at, 
          u.username as author,
          (SELECT COUNT(*) FROM likes WHERE content_id = c.id) as likes,
          (SELECT COUNT(*) FROM comments WHERE content_id = c.id) as comments
        FROM contents c
        JOIN users u ON c.author_id = u.id
        ORDER BY (SELECT COUNT(*) FROM comments WHERE content_id = c.id) DESC
        LIMIT ?
      `, [parseInt(limit)]);
      
      res.json({
        mostViewed: popularByViews,
        mostLiked: popularByLikes,
        mostCommented: popularByComments
      });
    } catch (error) {
      console.error('获取热门内容失败:', error);
      res.status(500).json({ message: '获取热门内容失败', error: error.message });
    }
  });

  // 获取类别统计
  router.get('/categories', async (req, res) => {
    try {
      const [result] = await pool.query(`
        SELECT 
          category, 
          COUNT(*) as count,
          SUM(CASE WHEN type = 'article' THEN 1 ELSE 0 END) as articles,
          SUM(CASE WHEN type = 'essay' THEN 1 ELSE 0 END) as essays
        FROM contents
        WHERE category IS NOT NULL
        GROUP BY category
        ORDER BY count DESC
      `);
      
      res.json(result);
    } catch (error) {
      console.error('获取类别统计失败:', error);
      res.status(500).json({ message: '获取类别统计失败', error: error.message });
    }
  });

  // 获取每日发布统计
  router.get('/daily', async (req, res) => {
    try {
      const { days = 30 } = req.query;
      
      const [result] = await pool.query(`
        SELECT 
          DATE(created_at) as date, 
          COUNT(*) as count,
          SUM(CASE WHEN type = 'article' THEN 1 ELSE 0 END) as articles,
          SUM(CASE WHEN type = 'essay' THEN 1 ELSE 0 END) as essays
        FROM contents
        WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL ? DAY)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `, [parseInt(days)]);
      
      res.json(result);
    } catch (error) {
      console.error('获取每日发布统计失败:', error);
      res.status(500).json({ message: '获取每日发布统计失败', error: error.message });
    }
  });

  return router;
}; 