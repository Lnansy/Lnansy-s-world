const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');

// 创建Express应用
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 存储所有连接的客户端
const clients = new Set();

// WebSocket连接处理
wss.on('connection', (ws) => {
  // 添加新客户端
  clients.add(ws);
  console.log('新的WebSocket连接已建立');

  // 处理消息
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      // 广播消息给所有客户端
      broadcastMessage(data);
    } catch (error) {
      console.error('WebSocket消息处理错误:', error);
    }
  });

  // 处理连接关闭
  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket连接已关闭');
  });
});

// 广播消息给所有客户端
function broadcastMessage(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// CORS配置
const corsOptions = {
  origin: function (origin, callback) {
    // 允许的源列表
    const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5000', 'http://127.0.0.1:5000'];
    // 允许没有origin的请求（比如移动端APP）
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('不允许的跨域请求'));
    }
  },
  credentials: true, // 允许携带凭证
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// 中间件
app.use(cors(corsOptions));
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
app.use('/api/articles', articlesRoutes(pool, broadcastMessage));
app.use('/api/users', usersRoutes(pool, broadcastMessage));
app.use('/api/stats', statsRoutes(pool, broadcastMessage));

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
  
  // 处理CORS错误
  if (err.message === '不允许的跨域请求') {
    return res.status(403).json({ message: '不允许的跨域请求' });
  }
  
  // 处理其他错误
  res.status(500).json({ 
    message: '服务器内部错误', 
    error: process.env.NODE_ENV === 'development' ? err.message : '请稍后重试'
  });
});

// 启动服务器
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`服务器正在运行在 http://localhost:${port}`);
});

module.exports = { app, server, broadcastMessage }; 