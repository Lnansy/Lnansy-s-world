const express = require('express');
const cors = require('cors');
const articlesRouter = require('./api/articles');
const verifyRouter = require('./api/verify');
const musicCommentsRouter = require('./api/music-comments');

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // 服务静态文件

// 路由
app.use('/api', articlesRouter);
app.use('/api', verifyRouter);
app.use('/api', musicCommentsRouter);

// 启动服务器
app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
}); 