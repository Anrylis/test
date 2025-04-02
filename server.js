const express = require('express');
const { Client } = require('pg'); // 引入 PostgreSQL 驅動
const app = express();
const port = process.env.PORT || 3000;
const path = require('path');

// 連接到 PostgreSQL 資料庫
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

client.connect()
  .then(() => console.log('PostgreSQL Connected'))
  .catch(err => console.log(err));

// 設定靜態檔案服務
app.use(express.static('public'));

// 解析 JSON 請求
app.use(express.json());

// 建立用戶資料表（如果資料表不存在）
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,-- id
    username VARCHAR(250) UNIQUE NOT NULL,-- 用戶名
    password VARCHAR(250) NOT NULL,-- 密碼
    petname VARCHAR(250) UNIQUE NOT NULL, --寵物名
    hp INT DEFAULT 100, -- 寵物HP 100
    score INT DEFAULT 0 -- 用戶分數 0
);
`;

client.query(createTableQuery)
  .then(() => console.log('Players table created or already exists'))
  .catch(err => console.log(err));

// 根目錄：訪問網站
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 唤醒接口，防止伺服器休眠
app.post('/wakeup', (req, res) => {
    res.send('"ok!"');
});

// 創建新帳號
app.post('/createAccount', async (req, res) => {
    const { username, password, petname, hp, score } = req.body;
    try {
        const result = await client.query(
            'INSERT INTO players (username, password, petname, hp, score) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [username, password, petname, hp, score]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.log(err);
       if (err.code === '23505') {  //NOT UNIQUE error
            res.status(400).json({ message: 'Username already exists' });
        }
        else res.status(500).json({ error: 'Error creating account' });
    }
});

// 獲取玩家分數
app.get('/getScore', async (req, res) => {
    const { username } = req.query;
    try {
        const result = await client.query(
            'SELECT score FROM players WHERE username = $1',
            [username]
        );
        if (result.rows.length > 0) {
            return res.json({ score: result.rows[0].score });
        }
        res.status(404).json({ error: 'Player not found' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 更新玩家分數
app.post('/updateScore', async (req, res) => {
    const { username, petname, score } = req.body;
    try {
        const result = await client.query(
            'UPDATE players SET score = score + $1 WHERE username = $2 AND petname = $3 RETURNING *',
            [score, username, petname]
        );
        if (result.rows.length > 0) {
            return res.json(result.rows[0]);
        }
        res.status(404).json({ error: 'Player not found' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 獲取排行榜
app.get('/leaderboard', async (req, res) => {
    try {
        const result = await client.query('SELECT * FROM players ORDER BY score DESC');
        res.json(result.rows);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 啟動伺服器
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
