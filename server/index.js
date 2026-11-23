import express from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "local-development-only-change-me";
const { Pool } = pg;
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
    })
  : null;
const localFile = path.join(root, "data", "local-users.json");

app.use(express.json({ limit: "3mb" }));

async function initDb() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS app_states (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      state JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function readLocalUsers() {
  try { return JSON.parse(await fs.readFile(localFile, "utf8")); }
  catch { return []; }
}
async function writeLocalUsers(users) {
  await fs.mkdir(path.dirname(localFile), { recursive: true });
  await fs.writeFile(localFile, JSON.stringify(users, null, 2));
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "ログインしてください。" });
  }
}

function issueToken(user) {
  return jwt.sign({ id: String(user.id), email: user.email }, JWT_SECRET, { expiresIn: "30d" });
}

app.get("/api/health", (_req, res) => res.json({ ok: true, storage: pool ? "postgres" : "local-file" }));

app.post("/api/register", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "メールアドレスを確認してください。" });
  if (password.length < 8) return res.status(400).json({ error: "パスワードは8文字以上にしてください。" });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    let user;
    if (pool) {
      const result = await pool.query(
        "INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id,email",
        [email, passwordHash]
      );
      user = result.rows[0];
      await pool.query("INSERT INTO app_states(user_id,state) VALUES($1,$2::jsonb)", [user.id, JSON.stringify(req.body.state || {})]);
    } else {
      const users = await readLocalUsers();
      if (users.some(u => u.email === email)) return res.status(409).json({ error: "このメールアドレスは登録済みです。" });
      user = { id: String(Date.now()), email, passwordHash, state: req.body.state || {} };
      users.push(user);
      await writeLocalUsers(users);
    }
    res.json({ token: issueToken(user), user: { email: user.email }, state: req.body.state || {} });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "このメールアドレスは登録済みです。" });
    console.error(error);
    res.status(500).json({ error: "登録に失敗しました。" });
  }
});

app.post("/api/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  try {
    let user;
    if (pool) {
      const result = await pool.query("SELECT id,email,password_hash FROM users WHERE email=$1", [email]);
      user = result.rows[0];
    } else {
      const users = await readLocalUsers();
      user = users.find(u => u.email === email);
      if (user) user.password_hash = user.passwordHash;
    }
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: "メールアドレスまたはパスワードが違います。" });
    let state = {};
    if (pool) {
      const saved = await pool.query("SELECT state FROM app_states WHERE user_id=$1", [user.id]);
      state = saved.rows[0]?.state || {};
    } else {
      const users = await readLocalUsers();
      state = users.find(u => u.email === email)?.state || {};
    }
    res.json({ token: issueToken(user), user: { email: user.email }, state });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "ログインに失敗しました。" });
  }
});

app.get("/api/state", auth, async (req, res) => {
  try {
    if (pool) {
      const result = await pool.query("SELECT state FROM app_states WHERE user_id=$1", [req.user.id]);
      return res.json({ state: result.rows[0]?.state || {} });
    }
    const users = await readLocalUsers();
    const user = users.find(u => u.id === req.user.id);
    return res.json({ state: user?.state || {} });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "データを読み込めませんでした。" });
  }
});

app.put("/api/state", auth, async (req, res) => {
  const state = req.body.state;
  if (!state || typeof state !== "object" || Array.isArray(state)) return res.status(400).json({ error: "保存データが不正です。" });
  try {
    if (pool) {
      await pool.query(
        `INSERT INTO app_states(user_id,state,updated_at) VALUES($1,$2::jsonb,NOW())
         ON CONFLICT(user_id) DO UPDATE SET state=EXCLUDED.state, updated_at=NOW()`,
        [req.user.id, JSON.stringify(state)]
      );
    } else {
      const users = await readLocalUsers();
      const user = users.find(u => u.id === req.user.id);
      if (!user) return res.status(404).json({ error: "ユーザーが見つかりません。" });
      user.state = state;
      await writeLocalUsers(users);
    }
    res.json({ ok: true, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "保存に失敗しました。" });
  }
});

app.use(express.static(path.join(root, "client", "dist")));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(root, "client", "dist", "index.html"));
});

initDb().then(() => {
  app.listen(PORT, "0.0.0.0", () => console.log(`pet timer listening on ${PORT}`));
}).catch(error => {
  console.error("Database initialization failed:", error);
  process.exit(1);
});
