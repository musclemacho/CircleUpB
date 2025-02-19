const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const path = require("path");
const multer = require('multer');
const mysql = require("mysql2");
const { getBuiltinModule } = require("process");
const nodemailer = require("nodemailer");


// リクエストをログに記録するミドルウェア
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// 静的ファイルの提供
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json()); // JSONリクエストを解析
app.use(express.urlencoded({ extended: true })); // URLエンコードされたデータも解析

const PORT = 3000;

// set ejs
app.set('view engine', 'ejs');



// アップロード先のディレクトリを指定
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/"); // ファイルを保存するフォルダ
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)); // ファイル名の指定
    }
});

const upload = multer({ storage: storage });

// MySQL 接続設定
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "aaaa",
});

db.connect((err) => {
  if (err) {
      console.error("❌ データベース接続エラー:", err.message);
      process.exit(1);
  }
  console.log("✅ MySQL に接続しました。");

  db.query("CREATE DATABASE IF NOT EXISTS Circles", (err) => {
      if (err) {
          console.error("❌ データベース作成エラー:", err.message);
          process.exit(1);
      }
      console.log("✅ データベース 'Circles' が確認されました。");

      // 📌 データベースを選択してからテーブル作成
      db.changeUser({ database: "Circles" }, (err) => {
          if (err) {
              console.error("❌ データベース選択エラー:", err.message);
              process.exit(1);
          }
          console.log("✅ データベース 'Circles' を使用しています。");

          // 🔹 Circles テーブル作成
          db.query(`
              CREATE TABLE IF NOT EXISTS Circles (
                  id INT AUTO_INCREMENT PRIMARY KEY,
                  circleName VARCHAR(255) NOT NULL,
                  comment VARCHAR(255),
                  mainGenre VARCHAR(255) NOT NULL,
                  subGenre VARCHAR(255),
                  other VARCHAR(255),
                  tag VARCHAR(255) DEFAULT '',
                  description TEXT,
                  admissionFee INT,
                  annualFee INT,
                  location VARCHAR(255),
                  instagram VARCHAR(255),
                  parsedSlider1 INT,
                  parsedSlider2 INT,
                  parsedSlider3 INT,
                  parsedSlider4 INT,
                  topPhoto VARCHAR(255),
                  subPhotos TEXT,
                  calendarPhotos TEXT,
                  password VARCHAR(255) NOT NULL
              );
          `, (err) => {
              if (err) {
                  console.error("❌ Circles テーブル作成エラー:", err);
                  process.exit(1);
              }
              console.log("✅ Circles テーブルが確認されました（または作成されました）");

              // 🔹 monthlyViews テーブル作成（ここで実行！）
              console.log("📌 monthlyViews テーブル作成クエリを実行します");
              db.query(`
                 CREATE TABLE IF NOT EXISTS dailyViews (
                      id INT AUTO_INCREMENT PRIMARY KEY,
                      circleId INT NOT NULL,
                      viewDate DATE NOT NULL, 
                      viewCount INT DEFAULT 0,
                      UNIQUE KEY (circleId, viewDate),
                      FOREIGN KEY (circleId) REFERENCES Circles(id) ON DELETE CASCADE
                  );
              `, (err) => {
                  if (err) {
                      console.error("❌ monthlyViews テーブル作成エラー:", err);
                      process.exit(1);
                  }
                  console.log("✅ monthlyViews テーブルが確認されました（または作成されました）");

                  // 🔹 サーバー起動はテーブル作成後
                  app.listen(3000, () => {
                      console.log('✅ Server is running on http://localhost:3000');
                  });
              });
          });
      });
  });
});


// サークルの登録処理
app.post('/circles', upload.fields([
  { name: 'topPhoto', maxCount: 1 },
  { name: 'subPhotos', maxCount: 5 },
  { name: 'calendarPhotos', maxCount: 3 }
]), (req, res) => {
  console.log("=== Request Body ===");
  console.log(req.body);
  
  console.log("=== Uploaded Files ===");
  console.log(req.files);
  const {
      circleName, mainGenre, subGenre, comment, other, tag, description, password,
      admissionFee, annualFee, location, instagram, slider1, slider2, slider3, slider4
  } = req.body;

  if (!circleName || !mainGenre || !password) {
      return res.status(400).json({ error: '必須フィールドが不足しています。' });
  }

  const parsedAdmissionFee = parseInt(admissionFee, 10) || null;
  const parsedAnnualFee = parseInt(annualFee, 10) || null;
  const parsedSlider1 = parseInt(slider1, 10) || 0;
  const parsedSlider2 = parseInt(slider2, 10) || 0;
  const parsedSlider3 = parseInt(slider3, 10) || 0;
  const parsedSlider4 = parseInt(slider4, 10) || 0;

  const topPhoto = req.files?.topPhoto?.[0]?.filename || null;
  const subPhotos = req.files?.subPhotos?.map(file => file.filename).join(',') || null;
  const calendarPhotos = req.files?.calendarPhotos?.map(file => file.filename).join(',') || null;

  const tagString = typeof tag === "string" ? tag : Array.isArray(tag) ? tag.join(",") : "";


  const query = `
      INSERT INTO Circles (
          circleName, mainGenre, subGenre, comment, other, tag, description, password,
          admissionFee, annualFee, location, instagram,
          parsedSlider1, parsedSlider2, parsedSlider3, parsedSlider4,
          topPhoto, subPhotos, calendarPhotos
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    query,
    [
      circleName, mainGenre, subGenre, comment, other, tagString,
      description, password,
      parsedAdmissionFee, parsedAnnualFee, location, instagram,
      parsedSlider1, parsedSlider2, parsedSlider3, parsedSlider4,
      topPhoto, subPhotos, calendarPhotos
    ],
    (err, result) => {
      if (err) {
          console.error('SQLエラー:', err.message);
          return res.status(500).json({ error: 'データベースへの保存に失敗しました。' });
      }
      res.status(201).json({ id: result.insertId });
    }
  
  );
});

// 編集データ
app.post('/circles/edit/:id', upload.fields([
  { name: 'topPhoto', maxCount: 1 },
  { name: 'subPhotos', maxCount: 5 },
  { name: 'calendarPhotos', maxCount: 3 }

]), (req, res) => {
  let circleId = req.body.circleId; // `FormData` から取得

  console.log("=== [DEBUG] Circle ID ===");
  console.log(circleId);

  // `circleId` を数値に変換
  if (Array.isArray(circleId)) {
      circleId = circleId[0]; // 配列の場合、最初の要素を使用
  }
  circleId = parseInt(circleId, 10);
  
  if (isNaN(circleId)) {
      console.error("🛑 IDがNaNです。リクエストの `id` が適切か確認してください。");
      return res.status(400).json({ error: "無効な ID です。" });
  }

  const {
      circleName, mainGenre, subGenre, comment, other, tag, description, password,
      admissionFee, annualFee, location, instagram, slider1, slider2, slider3, slider4
  } = req.body;

  const parsedAdmissionFee = admissionFee ? parseInt(admissionFee, 10) : null;
  const parsedAnnualFee = annualFee ? parseInt(annualFee, 10) : null;
  const parsedSlider1 = slider1 ? parseInt(slider1, 10) : 0;
  const parsedSlider2 = slider2 ? parseInt(slider2, 10) : 0;
  const parsedSlider3 = slider3 ? parseInt(slider3, 10) : 0;
  const parsedSlider4 = slider4 ? parseInt(slider4, 10) : 0;

  const topPhoto = req.files?.topPhoto?.[0]?.filename || null;
  const subPhotos = req.files?.subPhotos?.map(file => file.filename).join(',') || null;
  const calendarPhotos = req.files?.calendarPhotos?.map(file => file.filename).join(',') || null;


  const tagString = Array.isArray(tag) ? tag.join(",") : (tag || "");

  // `UPDATE` クエリを作成（不要なカンマ削除）
  let updateQuery = `
      UPDATE Circles SET
          circleName = ?, mainGenre = ?, subGenre = ?, comment = ?, other = ?, tag = ?, 
          description = ?, admissionFee = ?, annualFee = ?, location = ?, instagram = ?, 
          parsedSlider1 = ?, parsedSlider2 = ?, parsedSlider3 = ?, parsedSlider4 = ?
  `;

  let updateParams = [
      circleName, mainGenre, subGenre, comment, other, tagString, description,
      parsedAdmissionFee, parsedAnnualFee, location, instagram,
      parsedSlider1, parsedSlider2, parsedSlider3, parsedSlider4
  ];

  // トップ画像がアップロードされた場合のみ更新
  if (topPhoto) {
      updateQuery += `, topPhoto = ?`;
      updateParams.push(topPhoto);
  }

  // サブ画像がアップロードされた場合のみ更新
  if (subPhotos) {
      updateQuery += `, subPhotos = ?`;
      updateParams.push(subPhotos);
  }

  
  // サブ画像がアップロードされた場合のみ更新
  if (calendarPhotos) {
    updateQuery += `, calendarPhotos = ?`;
    updateParams.push(calendarPhotos);
}

  // パスワードが入力された場合のみ更新
  if (password) {
      updateQuery += `, password = ?`;
      updateParams.push(password);
  }

  // `WHERE id = ?` を適切に追加
  updateQuery += ` WHERE id = ?`;
  updateParams.push(circleId);

  console.log("=== [DEBUG] UPDATE Query ===");
  console.log(updateQuery);
  console.log("=== [DEBUG] Parameters ===");
  console.log(updateParams);

  // クエリを実行
  db.query(updateQuery, updateParams, (err, result) => {
      if (err) {
          console.error("🛑 SQLエラー:", err.message);
          return res.status(500).json({ 
              error: "データベースの更新に失敗しました。",
              details: err.sqlMessage // **詳細エラーメッセージをフロントエンドに送信**
          });
      }
      console.log("✅ データベース更新成功:", result);
      res.json({ success: true, message: "データベース更新成功", id: circleId });
  });
});






// 検索処理
app.get("/search", (req, res) => {
  const { name, searchGenre, bigTag, id} = req.query;

  let query = `SELECT * FROM Circles WHERE 1=1`;
  const params = [];
  console.log("name:", name);
  console.log("searchGenre:", searchGenre);
  console.log("bigTag:", bigTag);
  console.log("id:", id);

  if (name) {
    query += ` AND (circleName LIKE ? OR mainGenre LIKE ? OR subGenre LIKE ? OR other LIKE ?)`;
    params.push(`%${name}%`, `%${name}%`, `%${name}%`, `%${name}%`);
  }

  if (searchGenre && searchGenre.length > 0) {
    const genres = Array.isArray(searchGenre) ? searchGenre : [searchGenre];
    const genreConditions = genres.map(() => `(mainGenre LIKE ? OR subGenre LIKE ?)`).join(' OR ');
    query += ` AND (${genreConditions})`;
    genres.forEach(g => {
      params.push(`%${g}%`, `%${g}%`);
    });
  }
  
  if (bigTag && bigTag.length > 0) {
    const tags = Array.isArray(bigTag) ? bigTag : [bigTag];

    // `FIND_IN_SET()` を使って、該当するタグの数をカウント
    const matchCountQuery = tags.map(() => `IF(FIND_IN_SET(?, tag) > 0, 1, 0)`).join(' + ');

    query += ` ORDER BY (${matchCountQuery}) DESC, id ASC`;

    // `bigTag` の値を SQL のプレースホルダーとして設定
    tags.forEach(tag => params.push(tag));
}

// お気に入りサークルを取得
 
 if (id && id.length > 0) {
  const ids = Array.isArray(id) ? id : [id]; // `id` が単一の場合の対応
  query += ` AND id IN (${ids.map(() => '?').join(',')})`;
  ids.forEach(i => params.push(i));
}



//  if (bigTag && bigTag.length > 0) {
//     const tags = Array.isArray(bigTag) ? bigTag : [bigTag];
    
//     // `tag` に 1つでも該当する場合を `CASE` 文で優先表示
//     const caseStatements = tags.map(() => `WHEN tag LIKE ? THEN 0`).join(' ');
//     query += ` ORDER BY CASE ${caseStatements} ELSE 1 END`;
    
//     tags.forEach(tag => params.push(`%${tag}%`));
//   }

  db.query(query, params, (err, rows) => {
    if (err) {
      return res.status(500).send("エラーが発生しました: " + err.message);
    }
    res.render("index", { circles: rows });
  });
});

// 各ページのルート
app.get('/newCircle', (req, res) => {
  res.render('newCircle', { title: '新しいサークル掲載' });
});
app.get('/schedule', (req, res) => {
  res.render('schedule');
});

app.get("/", (req, res) => {
  db.query("SELECT * FROM Circles ORDER BY RAND()", [], (err, rows) => { 
    if (err) {
      return res.status(500).send("エラーが発生しました");
    }
    res.render("index", { circles: rows });
  });
});

// パスワード認証（編集ページ）
app.post("/circle/edit/:id/auth", (req, res) => {
  const circleId = req.params.id;
  const { password } = req.body;

  console.log("受け取った circleId:", circleId);
  console.log("受け取ったパスワード:", password);

  if (!circleId) {
      return res.status(400).json({ error: "サークルIDが不正です" });
  }

  const query = `SELECT * FROM Circles WHERE id = ?`;
  db.query(query, [circleId], (err, results) => {
      if (err) {
          console.error("エラー:", err.message);
          return res.status(500).json({ error: "エラーが発生しました" });
      }

      if (results.length === 0) {
          return res.status(404).json({ error: "サークルが見つかりません" });
      }

      const circle = results[0];
      console.log("データベースのパスワード:", circle.password);

      if ((circle.password || '') !== password) {
          console.log("パスワードが一致しません！");
          return res.status(403).json({ error: "パスワードが正しくありません" });
      }

      // 認証成功 → `editCircle.ejs` にリダイレクト
      res.redirect(`/circle/admin/${circleId}`);
  });
});



// 削除
app.delete("/circle/delete/:id", (req, res) => {
  const circleId = req.params.id;
  
  const deleteQuery = "DELETE FROM Circles WHERE id = ?";
  
  db.query(deleteQuery, [circleId], (err, result) => {
      if (err) {
          console.error("SQLエラー:", err.message);
          return res.status(500).json({ error: "削除に失敗しました。" });
      }

      res.status(200).json({ message: "サークルが削除されました。" });
  });
});


// 編集ページのルート
app.get("/circle/edit/:id", (req, res) => {
  const circleId = req.params.id;

  const query = `SELECT * FROM Circles WHERE id = ?`;
  db.query(query, [circleId], (err, results) => {
      if (err) {
          console.error("エラー:", err.message);
          return res.status(500).send("エラーが発生しました");
      }

      if (results.length === 0) {
          return res.status(404).send("サークルが見つかりません");
      }

      const circle = results[0];
      res.render("editCircle", { circle }); // `editCircle.ejs` をレンダリング
  });
});




// 📌 お問い合わせページを表示
app.get("/contact", (req, res) => {
  res.render("contact");
});

app.get("/policy", (req, res) => {
  res.render("policy");
});



// 閲覧数
app.get("/circle/:id", (req, res) => {
  const circleId = parseInt(req.params.id, 10);
  if (isNaN(circleId)) {
      console.error("❌ 無効な circleId:", req.params.id);
      return res.status(400).send("無効な ID です");
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  console.log(`📌 [DEBUG] 閲覧数更新: circleId=${circleId}, date=${today}`);

  // 日別閲覧数を記録
  const updateDailyViews = `
      INSERT INTO dailyViews (circleId, viewDate, viewCount)
      VALUES (?, ?, 1)
      ON DUPLICATE KEY UPDATE viewCount = viewCount + 1;
  `;

  db.query(updateDailyViews, [circleId, today], (err, result) => {
      if (err) {
          console.error("❌ [ERROR] dailyViews 更新エラー:", err);
      } else {
          console.log("✅ [SUCCESS] 日別閲覧数データ更新:", result);
      }

      // サークル情報を取得
      const query = `SELECT * FROM Circles WHERE id = ?`;
      db.query(query, [circleId], (err, results) => {
          if (err) {
              console.error("エラー:", err.message);
              return res.status(500).send("エラーが発生しました");
          }

          if (results.length === 0) {
              return res.status(404).send("サークルが見つかりません");
          }

          const circle = results[0];
          res.render("circle", { circle });
      });
  });
});
app.get("/circle/admin/:id", (req, res) => {
  const circleId = parseInt(req.params.id, 10);

  if (isNaN(circleId)) {
      console.error("❌ 無効な circleId:", req.params.id);
      return res.status(400).json({ error: "無効な ID です" });
  }

  console.log(`📌 [DEBUG] 管理者ページにアクセス: circleId=${circleId}`);

  // 過去15日間の日別閲覧数を取得
  const query = `
      SELECT c.id, c.circleName, c.description, c.tag, c.instagram, 
             dv.viewDate, dv.viewCount
      FROM Circles c
      LEFT JOIN dailyViews dv ON c.id = dv.circleId
      WHERE c.id = ? AND dv.viewDate >= DATE_SUB(CURDATE(), INTERVAL 15 DAY)
      ORDER BY dv.viewDate ASC;
  `;

  db.query(query, [circleId], (err, results) => {
      if (err) {
          console.error("❌ [ERROR] データ取得エラー:", err);
          return res.status(500).json({ error: "データ取得に失敗しました。" });
      }

      if (results.length === 0) {
          return res.status(404).json({ error: "サークルが見つかりません。" });
      }

      // サークル情報
      const circle = {
          id: results[0].id,
          circleName: results[0].circleName,
          description: results[0].description,
          tag: results[0].tag,
          instagram: results[0].instagram,
      };

      // 日別閲覧数データをリストに整形
      const stats = results.map(row => ({
          date: row.viewDate,
          count: row.viewCount
      }));

      console.log("✅ [SUCCESS] 管理ページデータ取得成功:", circle, stats);

      res.render("admin", { circle, stats });
  });
});


app.get("/api/getCircles", (req, res) => {
  const ids = req.query.id;
  if (!ids || ids.length === 0) {
      return res.json([]);
  }

  const query = "SELECT * FROM Circles WHERE id IN (?)";
  db.query(query, [ids], (err, rows) => {
      if (err) {
          console.error("エラー:", err);
          return res.status(500).json({ error: "データ取得に失敗しました。" });
      }
      res.json(rows);
  });
});
