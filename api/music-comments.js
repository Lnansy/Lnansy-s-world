const express = require('express');
const router = express.Router();

// 内存存储所有音乐评论（生产环境建议用数据库）
const musicComments = new Map(); // key: musicId, value: array of comments
let commentId = 1;

// 获取某首歌的所有评论
router.get('/music-comments/:musicId', (req, res) => {
    const { musicId } = req.params;
    const comments = musicComments.get(musicId) || [];
    res.json(comments);
});

// 提交评论
router.post('/music-comments', (req, res) => {
    const { music_id, content } = req.body;
    // 简单用户信息
    let currentUser = { username: '匿名', id: null };
    try {
        // 支持前端 localStorage 用户
        if (req.headers['authorization']) {
            const userStr = Buffer.from(req.headers['authorization'].replace('Bearer ', ''), 'base64').toString();
            const user = JSON.parse(userStr);
            if (user && user.username) {
                currentUser = user;
            }
        }
    } catch {}
    if (!music_id || !content) {
        return res.status(400).json({ error: '参数不完整' });
    }
    const newComment = {
        id: commentId++,
        music_id,
        username: currentUser.username,
        user_id: currentUser.id,
        content,
        created_at: new Date()
    };
    if (!musicComments.has(music_id)) {
        musicComments.set(music_id, []);
    }
    musicComments.get(music_id).push(newComment);
    res.json(newComment);
});

// 删除评论
router.delete('/music-comments/:commentId', (req, res) => {
    const { commentId } = req.params;
    let deleted = false;
    for (const [musicId, comments] of musicComments.entries()) {
        const idx = comments.findIndex(c => c.id == commentId);
        if (idx !== -1) {
            comments.splice(idx, 1);
            deleted = true;
            break;
        }
    }
    if (deleted) {
        res.json({ message: '删除成功' });
    } else {
        res.status(404).json({ error: '评论不存在' });
    }
});

module.exports = router; 