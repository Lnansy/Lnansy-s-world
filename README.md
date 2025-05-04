# Lnansy's Blog

一个现代化的个人博客系统，使用Node.js和MySQL提供后端支持。

## 功能特点

- 文章和随笔的发布与管理
- 用户注册和登录系统
- 评论和点赞功能
- 标签分类和搜索
- 访问统计和数据分析
- 响应式设计，适配移动端

## 技术栈

- 前端：HTML, CSS, JavaScript
- 后端：Node.js, Express
- 数据库：MySQL
- 认证：JWT (JSON Web Token)
- 密码加密：bcrypt

## 安装指南

### 前提条件

- Node.js (v12+)
- MySQL (v5.7+)

### 安装步骤

1. 克隆代码库：

```bash
git clone https://github.com/yourusername/lnansy-blog.git
cd lnansy-blog
   ```

2. 安装依赖：

```bash
npm install
   ```

3. 初始化数据库：

```bash
npm run init-db
```

4. 启动服务器：

```bash
npm run dev
```

### 配置

数据库配置可以在 `server.js` 文件中修改：

```javascript
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'lxm060905',  // 修改为你的MySQL密码
  database: 'blog_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
   ```

## 使用指南

### 管理员账户

系统会创建一个默认管理员账户：

- 用户名：Lnansy
- 密码：password

首次登录后请立即修改密码。

### 内容发布

1. 登录系统
2. 在首页点击"发布文章"或"发布随笔"按钮
3. 填写标题、内容和分类
4. 点击发布

### API接口

系统提供了完整的REST API，详情可查看：

- `/api/articles` - 文章和随笔相关
- `/api/users` - 用户相关
- `/api/stats` - 统计相关

## 开发指南

### 项目结构

```
|-- db/               # 数据库相关脚本
|-- routes/           # API路由
|-- js/               # 前端JavaScript
|-- styles.css        # 样式表
|-- index.html        # 首页
|-- server.js         # 服务器入口
|-- package.json      # 项目配置
|-- README.md         # 项目说明
```

### 主要实现

- `server.js` - Express服务器和数据库连接
- `db/init.js` - 数据库初始化
- `routes/*.js` - API端点实现
- `js/api.js` - 前端API调用模块

## 许可证

MIT 