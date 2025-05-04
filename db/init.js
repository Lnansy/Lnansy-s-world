const mysql = require('mysql2/promise');

async function initializeDatabase() {
  // 创建连接
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'lxm060905'
  });

  try {
    // 创建数据库
    await connection.query('CREATE DATABASE IF NOT EXISTS blog_db');
    console.log('数据库创建成功或已存在');

    // 使用新创建的数据库
    await connection.query('USE blog_db');

    // 创建用户表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(100),
        is_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('用户表创建成功');

    // 创建内容表（文章和随笔）
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        type ENUM('article', 'essay') NOT NULL, 
        category VARCHAR(50),
        author_id INT,
        views INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES users(id)
      )
    `);
    console.log('内容表创建成功');

    // 创建评论表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        content_id INT NOT NULL,
        user_id INT NOT NULL,
        comment_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('评论表创建成功');

    // 创建点赞表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        content_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE KEY unique_like (content_id, user_id)
      )
    `);
    console.log('点赞表创建成功');

    // 创建标签表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE
      )
    `);
    console.log('标签表创建成功');

    // 创建内容标签关联表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS content_tags (
        content_id INT NOT NULL,
        tag_id INT NOT NULL,
        PRIMARY KEY (content_id, tag_id),
        FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `);
    console.log('内容标签关联表创建成功');

    // 创建访问统计表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS visit_stats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        visit_date DATE DEFAULT (CURRENT_DATE),
        count INT DEFAULT 1,
        UNIQUE KEY unique_date (visit_date)
      )
    `);
    console.log('访问统计表创建成功');

    // 添加默认管理员账户
    await connection.query(`
      INSERT IGNORE INTO users (username, password, email, is_admin)
      VALUES ('Lnansy', '$2b$10$XgMXmCm5xgEj2U5.mdSRZe2TV33A1WEdtjKm.166UHBzYvezGf8CW', 'admin@example.com', true)
    `);
    console.log('默认管理员账户已创建');

    // 添加一些默认标签
    await connection.query(`
      INSERT IGNORE INTO tags (name) VALUES 
      ('life'), ('tech'), ('reading'), ('travel'), ('music'), ('other');
    `);
    console.log('默认标签已创建');

    console.log('数据库初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
  } finally {
    await connection.end();
  }
}

// 执行初始化
initializeDatabase(); 