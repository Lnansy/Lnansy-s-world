# Lnansy's Blog

一个使用MongoDB数据库的个人博客系统，支持文章发布、随笔记录、评论和点赞功能。

## 技术栈

- **前端**：HTML、CSS、JavaScript
- **后端**：Node.js、Express
- **数据库**：MongoDB
- **用户认证**：bcryptjs

## 功能特点

- 用户注册与登录
- 文章和随笔的发布、编辑和删除
- 文章评论和点赞
- 文章归档和标签分类
- 访问统计

## 系统要求

- Node.js >= 14.0.0
- MongoDB >= 4.4

## 安装步骤

1. 克隆代码库：

```bash
git clone <repository-url>
cd blog
```

2. 安装依赖：

```bash
npm install
```

3. 创建环境变量文件：

创建一个名为`.env`的文件在项目根目录下，添加以下内容：

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/blog_db
```

4. 启动MongoDB：

确保MongoDB服务已经启动。

5. 启动应用：

```bash
npm start
```

或者使用开发模式（自动重启）：

```bash
npm run dev
```

6. 访问网站：

打开浏览器，访问 `http://localhost:3000`

## 初始化管理员账户

首次使用时，需要创建一个管理员账户。可以通过注册页面注册普通用户，然后在MongoDB中手动将用户角色更改为管理员：

```javascript
db.users.updateOne(
  { username: "Lnansy" },
  { $set: { isAdmin: true } }
)
```

## 目录结构

```
/
|-- README.md           # 项目说明文档
|-- server.js           # 服务器入口文件
|-- models.js           # 数据库模型
|-- package.json        # 项目依赖描述
|-- .env                # 环境变量配置
|-- index.html          # 网站首页
|-- login.html          # 登录页面
|-- register.html       # 注册页面
|-- js/
|   |-- api.js          # API接口适配器
|   |-- archives.js     # 归档功能脚本
|-- styles.css          # 全局样式
```

## 开发建议

1. 数据库备份：定期备份MongoDB数据库
2. 安全性：考虑添加JWT认证以增强安全性
3. 图片上传：可以考虑集成云存储服务来处理文章图片上传

## 许可证

[MIT](LICENSE) 