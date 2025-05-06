const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const router = express.Router();
const db = require('../db/connection'); // 确保正确引入数据库连接
const articlesApi = require('../api/articles');

// 创建Express应用
const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, './')));

// 数据库连接池
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'lxm060905',
  database: 'blog_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 测试数据库连接
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('数据库连接成功');
    connection.release();
  } catch (error) {
    console.error('数据库连接失败:', error);
    process.exit(1);
  }
}

testConnection();

// 导入路由
const articlesRoutes = require('./routes/articles');
const usersRoutes = require('./routes/users');
const statsRoutes = require('./routes/stats');

// 使用路由
app.use('/api/articles', articlesRoutes(pool));
app.use('/api/users', usersRoutes(pool));
app.use('/api/stats', statsRoutes(pool));

// 使用API路由
router.use('/api/articles', articlesApi);

// 获取文章评论
router.get('/:id/comments', async (req, res) => {
    const articleId = req.params.id;
    const comments = await db.getCommentsForArticle(articleId); // 从数据库获取评论
    res.json(comments);
});

// 添加评论
router.post('/:id/comments', async (req, res) => {
    const articleId = req.params.id;
    const { comment } = req.body;
    await db.addCommentToArticle(articleId, comment); // 将评论添加到数据库
    res.status(201).send('评论已添加');
});

// 获取音乐评论
router.get('/:id/comments', async (req, res) => {
    const musicId = req.params.id;
    const comments = await db.getCommentsForMusic(musicId); // 从数据库获取评论
    res.json(comments);
});

// 添加评论
router.post('/:id/comments', async (req, res) => {
    const musicId = req.params.id;
    const { comment } = req.body;
    await db.addCommentToMusic(musicId, comment); // 将评论添加到数据库
    res.status(201).send('评论已添加');
});

// 首页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ message: '请求的资源不存在' });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: '服务器内部错误', error: err.message });
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器正在运行在 http://localhost:${port}`);
});

module.exports = router; 