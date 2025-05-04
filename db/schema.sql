-- 创建数据库
CREATE DATABASE IF NOT EXISTS blog_db;
USE blog_db;

-- 文章表
CREATE TABLE IF NOT EXISTS articles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    excerpt VARCHAR(500),
    author VARCHAR(100) NOT NULL,
    image_url VARCHAR(255),
    views INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 评论表
CREATE TABLE IF NOT EXISTS comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    article_id INT NOT NULL,
    user_id INT NOT NULL,
    username VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    is_owner BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

-- 点赞表
CREATE TABLE IF NOT EXISTS likes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    article_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
    UNIQUE KEY unique_like (article_id, user_id)
);

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 添加索引
CREATE INDEX idx_article_created ON articles(created_at);
CREATE INDEX idx_comment_article ON comments(article_id);
CREATE INDEX idx_like_article ON likes(article_id);

-- 添加测试数据
INSERT INTO articles (title, content, excerpt, author, image_url) VALUES
('第一篇博客文章', '这是我的第一篇博客文章的内容...', '这是第一篇文章的摘要...', 'admin', '/images/article1.jpg'),
('技术分享', '这是一篇技术分享文章的内容...', '这是技术分享的摘要...', 'admin', '/images/article2.jpg');

-- 添加管理员用户
INSERT INTO users (username, password, email, is_admin) VALUES
('admin', '$2b$10$YOUR_HASHED_PASSWORD', 'admin@example.com', TRUE); 