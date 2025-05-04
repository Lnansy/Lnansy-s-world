const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const path = require('path');

// 获取文章列表
router.get('/articles', async (req, res) => {
    try {
        const articles = await db.query('SELECT * FROM articles ORDER BY created_at DESC');
        // 处理文章内容中的图片路径
        const processedArticles = articles.map(article => ({
            ...article,
            content: article.content.replace(/images\\suibi\\/g, 'images/suibi/')
        }));
        res.json(processedArticles);
    } catch (error) {
        res.status(500).json({ error: '获取文章列表失败' });
    }
});

// 获取单篇文章详情
router.get('/articles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [article] = await db.query('SELECT * FROM articles WHERE id = ?', [id]);
        
        if (!article) {
            return res.status(404).json({ error: '文章不存在' });
        }

        // 处理文章内容中的图片路径
        article.content = article.content.replace(/images\\suibi\\/g, 'images/suibi/');

        // 获取评论
        const comments = await db.query(`
            SELECT c.*, u.username, u.is_admin as is_owner 
            FROM comments c 
            LEFT JOIN users u ON c.user_id = u.id 
            WHERE c.article_id = ? 
            ORDER BY c.created_at DESC
        `, [id]);

        // 获取点赞数
        const [likesCount] = await db.query('SELECT COUNT(*) as count FROM likes WHERE article_id = ?', [id]);

        // 检查当前用户是否点赞（如果用户已登录）
        let isLiked = false;
        if (req.user) {
            const [userLike] = await db.query(
                'SELECT * FROM likes WHERE article_id = ? AND user_id = ?',
                [id, req.user.id]
            );
            isLiked = !!userLike;
        }

        // 返回完整的文章信息
        res.json({
            ...article,
            comments,
            likes: likesCount.count,
            is_liked: isLiked
        });
    } catch (error) {
        console.error('获取文章详情失败:', error);
        res.status(500).json({ error: '获取文章详情失败' });
    }
});

// 添加评论
router.post('/articles/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const { content, userId, username } = req.body;
        
        const result = await db.query(
            'INSERT INTO comments (article_id, user_id, username, content) VALUES (?, ?, ?, ?)',
            [id, userId, username, content]
        );
        
        const newComment = {
            id: result.insertId,
            article_id: id,
            user_id: userId,
            username,
            content,
            created_at: new Date()
        };
        
        res.json(newComment);
    } catch (error) {
        res.status(500).json({ error: '添加评论失败' });
    }
});

// 点赞/取消点赞
router.post('/articles/:id/like', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;
        
        // 检查是否已经点赞
        const existingLike = await db.query(
            'SELECT * FROM likes WHERE article_id = ? AND user_id = ?',
            [id, userId]
        );
        
        if (existingLike.length > 0) {
            // 取消点赞
            await db.query(
                'DELETE FROM likes WHERE article_id = ? AND user_id = ?',
                [id, userId]
            );
            res.json({ liked: false });
        } else {
            // 添加点赞
            await db.query(
                'INSERT INTO likes (article_id, user_id) VALUES (?, ?)',
                [id, userId]
            );
            res.json({ liked: true });
        }
    } catch (error) {
        res.status(500).json({ error: '操作点赞失败' });
    }
});

// 更新浏览量
router.post('/articles/:id/view', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query(
            'UPDATE articles SET views = views + 1 WHERE id = ?',
            [id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: '更新浏览量失败' });
    }
});

// 获取文章归档数据
router.get('/archives', async (req, res) => {
    try {
        // 使用 MySQL 的 DATE_FORMAT 来按年月分组统计文章数量
        const archives = await db.query(`
            SELECT 
                DATE_FORMAT(created_at, '%Y-%m') as yearMonth,
                DATE_FORMAT(created_at, '%Y年%m月') as displayDate,
                COUNT(*) as count
            FROM articles 
            GROUP BY yearMonth 
            ORDER BY yearMonth DESC
        `);
        
        res.json(archives);
    } catch (error) {
        console.error('获取文章归档失败:', error);
        res.status(500).json({ error: '获取文章归档失败' });
    }
});

module.exports = router; 