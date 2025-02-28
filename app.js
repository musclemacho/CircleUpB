const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const path = require("path");
const multer = require('multer');
const mysql = require("mysql2");
const { getBuiltinModule } = require("process");
const nodemailer = require("nodemailer");
const session = require('express-session');
const nl2br = (str) => {
  if (!str) return "";
  return str.replace(/\n/g, "<br>");
};
const helmet = require("helmet");

app.use(
  helmet({
    contentSecurityPolicy: false, // ✅ 完全に無効化
  })
);



app.locals.nl2br = nl2br;  // EJS で使用できるようにする

app.get('/favicon.ico', (req, res) => res.status(204).end());


app.use(session({
    secret: "your_secret_key",  // 任意のシークレットキー
    resave: false,  // セッションが変更されたときのみ保存
    saveUninitialized: false,  // 未初期化のセッションは保存しない
    cookie: {
        secure: false,  // HTTPS 環境なら true
        httpOnly: true, // JavaScript からアクセス不可（XSS対策）
        sameSite: "lax",  // CSRF対策
        maxAge: 30 * 60 * 1000 // セッションの有効期限: 30分
    }
}));


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

// ✅ アップロードサイズ制限: 5MB
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// MySQL 接続設定
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "aaaa",
  // 俺のはaaaa、Hide_Nakai_2003
});



// ✅ 画像のみ許可する `fileFilter`
function fileFilter(req, file, cb) {
  const allowedExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext)) {
      cb(null, true); // ✅ 許可
  } else {
      cb(new Error("❌ 許可されていないファイル形式です (.png, .jpg, .jpeg, .gif, .webp のみ許可)"), false);
  }
}



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
  const { name, searchGenre, bigTag} = req.query;

  let query = `SELECT * FROM Circles WHERE 1=1`;
  const params = [];
  console.log("name:", name);
  console.log("searchGenre:", searchGenre);
  console.log("bigTag:", bigTag);

  if (name) {
    query += ` AND (circleName LIKE ? OR mainGenre LIKE ? OR subGenre LIKE ? OR other LIKE ? OR location LIKE ?)`;
    params.push(`%${name}%`, `%${name}%`, `%${name}%`, `%${name}%`, `%${name}%`);
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





  db.query(query, params, (err, rows) => {
    if (err) {
      return res.status(500).send("エラーが発生しました: " + err.message);
    }
    res.render("index", { circles: rows });
  });
});



// お気に入りサークルを取得

app.get("/searchFav", (req, res) => {
  const {id} = req.query;
  console.log("id:", id);

  let query = `SELECT * FROM Circles WHERE 1=1`;
  const params = [];

 
if (id && id.length > 0) {
  const ids = Array.isArray(id) ? id : [id]; // `id` が単一の場合の対応
  query += ` AND id IN (${ids.map(() => '?').join(',')})`;
  ids.forEach(i => params.push(i));
}

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


app.get(`/contact`, (req, res) => {
    res.render(`contact`)
})

app.get("/", (req, res) => {
  db.query("SELECT * FROM Circles ORDER BY RAND()", [], (err, rows) => { 
    if (err) {
      return res.status(500).send("エラーが発生しました");
    }
    res.render("index", { circles: rows });
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
      console.error("無効な circleId:", req.params.id);
      return res.status(400).send("無効な ID です");
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  console.log(` [DEBUG] 閲覧数更新: circleId=${circleId}, date=${today}`);

  // 日別閲覧数を記録
  const updateDailyViews = `
      INSERT INTO dailyViews (circleId, viewDate, viewCount)
      VALUES (?, ?, 1)
      ON DUPLICATE KEY UPDATE viewCount = viewCount + 1;
  `;

  db.query(updateDailyViews, [circleId, today], (err, result) => {
      if (err) {
          console.error("[ERROR] dailyViews 更新エラー:", err);
      } else {
          console.log("[SUCCESS] 日別閲覧数データ更新:", result);
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

// パスワード認証（管理ページへのアクセス）
app.post("/circle/admin/:id/auth", (req, res) => {
  const circleId = parseInt(req.params.id, 10);
  const { password } = req.body;

  console.log("🛠 [DEBUG] 受け取った circleId:", req.params.id, " | parseInt 変換後:", circleId);

  if (isNaN(circleId) || !password) {
      return res.status(400).json({ error: "無効なリクエストです" });
  }

  const query = `SELECT * FROM Circles WHERE id = ?`;
  db.query(query, [circleId], (err, results) => {
      if (err) {
          console.error("エラー:", err.message);
          return res.status(500).json({ error: "エラーが発生しました" });
      }

      if (results.length === 0) {
          return res.status(404).json({ error: "サークルが見つかりません。" });
      }

      const circle = results[0];

      if (circle.password !== password) {
          console.log("❌ パスワードが一致しません");
          return res.status(403).json({ error: "パスワードが正しくありません。" });
      }

      // ✅ `authenticatedCircles` を初期化（未定義の場合）
      if (!req.session.authenticatedCircles) {
          req.session.authenticatedCircles = {};
      }

      // ✅ 認証済みのサークルIDを記録
      req.session.authenticatedCircles[circleId] = true;

      console.log("✅ 認証成功 - 認証済みサークル一覧:", req.session.authenticatedCircles);

      // 30分後に認証を削除
      setTimeout(() => {
          if (req.session.authenticatedCircles) {
              delete req.session.authenticatedCircles[circleId];
              console.log("⏳ 認証期限切れ:", circleId);
          }
      }, 30 * 60 * 1000); // 30分

      req.session.save((err) => {
          if (err) {
              console.error("❌ セッション保存エラー:", err);
              return res.status(500).json({ error: "セッション保存に失敗しました" });
          }
          res.json({ success: true, redirect: `/circle/admin/${circleId}` });
      });
  });
});

// 管理者ページの認証チェックミドルウェア
const requireAuth = (req, res, next) => {
  const circleId = parseInt(req.params.id, 10);

  console.log("セッション情報:", req.session);
  console.log("リクエストID:", circleId);

  // ✅ `authenticatedCircles` が未定義の場合は初期化
  if (!req.session.authenticatedCircles) {
      req.session.authenticatedCircles = {};
  }

  console.log("認証済みサークル:", req.session.authenticatedCircles);

  // ✅ ourpage からのアクセスの場合は認証スキップ
  if (req.session.fromOurPage) {
      console.log("🔹 ourpage からのアクセス -> 認証スキップ");
      req.session.fromOurPage = false; // フラグを削除
      req.session.save();
      return next();
  }

  // ✅ 通常の認証チェック
  if (!req.session.authenticatedCircles[circleId]) {
      console.log("❌ 認証されていないためアクセス拒否:", circleId);
      return res.status(403).json({ error: "認証が必要です。" });
  }

  console.log("✅ 認証成功 - アクセス許可:", circleId);
  next();
};
// 管理者ページのルート
app.get("/circle/admin/:id", requireAuth, (req, res) => {
  const circleId = parseInt(req.params.id, 10);
  if (isNaN(circleId)) {
      return res.status(400).json({ error: "無効な ID です" });
  }

  // ✅ 認証済みのサークルを記録
  if (!req.session.authenticatedCircles) {
      req.session.authenticatedCircles = {};
  }

  
//  パスワード認証→circleid取得、セッションに登録→requireAuthでadminページととID照合→入る→editページとセッションID照合
// ourpageからはrequireAuthをスキップ→adminページに入ってcircleidをセッションに保存
  req.session.authenticatedCircles[circleId] = true;

  console.log("✅ 認証成功 - 認証済みサークル:", req.session.authenticatedCircles);

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
          console.error("データ取得エラー:", err);
          return res.status(500).json({ error: "データ取得に失敗しました。" });
      }
      if (results.length === 0) {
          return res.status(404).json({ error: "サークルが見つかりません。" });
      }

      const circle = {
          id: results[0].id,
          circleName: results[0].circleName,
          description: results[0].description,
          tag: results[0].tag,
          instagram: results[0].instagram,
      };

      const stats = results.map(row => ({
          date: row.viewDate,
          count: row.viewCount
      }));

      res.render("admin", { circle, stats });
  });
});

// 編集ページのルート (adminページ経由 or 認証済みサークルのみ)
app.get("/circle/edit/:id", (req, res) => {
  const circleId = parseInt(req.params.id, 10);
  if (isNaN(circleId)) {
      return res.status(400).json({ error: "無効な ID です" });
  }

  console.log("🔹 セッション情報:", req.session);

  // ✅ `authenticatedCircles` が未定義の場合は初期化
  if (!req.session.authenticatedCircles) {
      req.session.authenticatedCircles = {};
  }

  // ✅ adminページからのアクセス or 既に認証済みのサークルのみ許可
  if (!req.session.authenticatedCircles[circleId]) {
      return res.status(403).json({ error: "アクセス権限がありません。" });
  }

  console.log("✅ 認証成功 - 編集ページへのアクセス許可:", circleId);

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
      res.render("editCircle", { circle });
  });
});



// 削除
app.delete("/circle/delete/:id", requireAuth, (req, res) => {
  const circleId = parseInt(req.params.id, 10);
  
  if (isNaN(circleId)) {
    return res.status(400).json({ error: "無効な ID です" });
}

  const deleteQuery = "DELETE FROM Circles WHERE id = ?";
  
  db.query(deleteQuery, [circleId], (err, result) => {
      if (err) {
          console.error("SQLエラー:", err.message);
          return res.status(500).json({ error: "削除に失敗しました。" });
      }

      res.status(200).json({ message: "サークルが削除されました。" });
  });
});






app.get("/starnightmuscle", (req, res) => {
  // ✅ 最初のアクセス時のみ `fromOurPage` を設定
  if (!req.session.fromOurPage) {
      req.session.fromOurPage = true;
  }

  const getCircleCountQuery = "SELECT COUNT(*) AS totalCircles FROM Circles";
  const getDailyViewsQuery = `
      SELECT viewDate, SUM(viewCount) AS totalViews
      FROM dailyViews
      GROUP BY viewDate
      ORDER BY viewDate ASC
  `;
  const getTotalViewsQuery = "SELECT SUM(viewCount) AS totalViews FROM dailyViews";

  // 🔹 各サークルの総閲覧数を取得するクエリ
  const getCirclesWithViewsQuery = `
      SELECT c.id, c.circleName, c.mainGenre, COALESCE(SUM(d.viewCount), 0) AS totalViews
      FROM Circles c
      LEFT JOIN dailyViews d ON c.id = d.circleId
      GROUP BY c.id, c.circleName, c.mainGenre
      ORDER BY totalViews DESC;
  `;

  db.query(getCircleCountQuery, (err, circleResults) => {
      if (err) {
          console.error("❌ エラー: サークル数の取得に失敗", err);
          return res.status(500).send("サークル数データ取得エラー");
      }

      const totalCircles = circleResults.length > 0 ? circleResults[0].totalCircles : 0;

      db.query(getDailyViewsQuery, (err, dailyViewsResults) => {
          if (err) {
              console.error("❌ エラー: 日別アクセス数の取得に失敗", err);
              return res.status(500).send("日別アクセス数データ取得エラー");
          }

          db.query(getTotalViewsQuery, (err, totalViewsResult) => {
              if (err) {
                  console.error("❌ エラー: 総アクセス数の取得に失敗", err);
                  return res.status(500).send("総アクセス数データ取得エラー");
              }

              const totalViews = totalViewsResult.length > 0 ? totalViewsResult[0].totalViews || 0 : 0;

              db.query(getCirclesWithViewsQuery, (err, circlesResults) => {
                  if (err) {
                      console.error("❌ エラー: サークルデータの取得に失敗", err);
                      return res.status(500).send("サークルデータ取得エラー");
                  }

                  res.render("ourpage", {
                      totalCircles: totalCircles,
                      dailyViews: dailyViewsResults || [],
                      totalViews: totalViews,
                      circles: circlesResults || []
                  });
              });
          });
      });
  });
});
