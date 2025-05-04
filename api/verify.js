const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// 存储验证码的临时对象（实际生产环境应该使用 Redis 等）
const verifyCodes = new Map();

// 创建邮件传输器
const transporter = nodemailer.createTransport({
    service: 'gmail',  // 或其他邮件服务
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// 生成6位数字验证码
function generateVerifyCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// 发送验证码
router.post('/send-verify-code', async (req, res) => {
    const { email } = req.body;
    
    try {
        // 生成验证码
        const code = generateVerifyCode();
        
        // 存储验证码（5分钟有效期）
        verifyCodes.set(email, {
            code,
            expires: Date.now() + 5 * 60 * 1000
        });
        
        // 发送邮件
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: '注册验证码',
            text: `您的注册验证码是：${code}，5分钟内有效。`
        });
        
        res.json({ message: '验证码已发送' });
    } catch (error) {
        console.error('发送验证码失败:', error);
        res.status(500).json({ error: '发送验证码失败' });
    }
});

// 验证验证码
router.post('/verify-code', (req, res) => {
    const { email, code } = req.body;
    
    const verifyInfo = verifyCodes.get(email);
    if (!verifyInfo) {
        return res.status(400).json({ error: '验证码已过期或不存在' });
    }
    
    if (Date.now() > verifyInfo.expires) {
        verifyCodes.delete(email);
        return res.status(400).json({ error: '验证码已过期' });
    }
    
    if (verifyInfo.code !== code) {
        return res.status(400).json({ error: '验证码错误' });
    }
    
    // 验证成功后删除验证码
    verifyCodes.delete(email);
    res.json({ message: '验证成功' });
});

module.exports = router; 