import React, { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_TAGS = [
  { name: "勉強", color: "#b8dff4" }, { name: "仕事", color: "#d9c5f2" },
  { name: "家事", color: "#ffd7aa" }, { name: "PTA", color: "#cde8b9" },
  { name: "TAC", color: "#d9c5f2" }, { name: "健康", color: "#f7c8d5" },
  { name: "プライベート", color: "#c9e2eb" }, { name: "その他", color: "#e5e2df" }
];
const INITIAL = {
  pet: { type: "cat", name: "みるく", level: 1, xp: 0, coins: 0, affection: 12, hunger: 92, energy: 88, mood: 92, sleepingUntil: 0, image: "" },
  tasks: [
    { id: "t1", title: "簿記論 講義2-3の視聴", tags: ["勉強", "TAC"], due: "", priority: "高", minutes: 150, done: false, project: "TAC" },
    { id: "t2", title: "財務諸表論 演習", tags: ["勉強", "TAC"], due: "", priority: "中", minutes: 120, done: false, project: "TAC" },
    { id: "t3", title: "PTA 引継ぎ資料作成", tags: ["PTA", "仕事"], due: "", priority: "中", minutes: 60, done: false, project: "PTA" },
    { id: "t4", title: "夕食の準備", tags: ["家事", "プライベート"], due: "", priority: "低", minutes: 30, done: false, project: "" }
  ],
  tags: DEFAULT_TAGS,
  sessions: [], alarms: [], selectedTaskId: "t1", view: "list", filter: "today"
};

const petLabels = { cat: "ねこ", dog: "いぬ", rabbit: "うさぎ", hamster: "ハムスター" };
const petEmoji = { cat: "🐈", dog: "🐕", rabbit: "🐇", hamster: "🐹" };
const petDefaultPhotos = {
  cat: "https://images.pexels.com/photos/36249904/pexels-photo-36249904/free-photo-of-adorable-orange-and-white-kitten-portrait.jpeg?auto=compress&cs=tinysrgb&w=1400",
  dog: "https://images.pexels.com/photos/22212544/pexels-photo-22212544/free-photo-of-close-up-of-a-cute-golden-retriever-puppy.jpeg?auto=compress&cs=tinysrgb&w=1400",
  rabbit: "https://images.pexels.com/photos/35891686/pexels-photo-35891686/free-photo-of-adorable-black-and-white-lop-eared-rabbit-portrait.jpeg?auto=compress&cs=tinysrgb&w=1400",
  hamster: "https://images.pexels.com/photos/33914110/pexels-photo-33914110/free-photo-of-adorable-golden-syrian-hamster-portrait-close-up.jpeg?auto=compress&cs=tinysrgb&w=1400"
};
const petDisplayModes = { illustration: "イラスト", photo: "写真" };

function readLocal() {
  try { return { ...INITIAL, ...JSON.parse(localStorage.getItem("pet-timer-state") || "{}") }; }
  catch { return INITIAL; }
}
function beep(times = 3, volume = 0.75) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    let t = ctx.currentTime;
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 660 + (i % 2) * 110;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.02, volume * 0.22), t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.34);
      t += 0.55;
    }
    setTimeout(() => ctx.close(), times * 600 + 500);
  } catch {}
}
function fmt(seconds) {
  const h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = seconds % 60;
  return h ? `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` : `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
function todayKey() { return new Date().toISOString().slice(0,10); }

export default function App() {
  const [data, setData] = useState(readLocal);
  const [page, setPage] = useState("ホーム");
  const [account, setAccount] = useState(() => localStorage.getItem("pet-timer-user") || "");
  const [token, setToken] = useState(() => localStorage.getItem("pet-timer-token") || "");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [syncLabel, setSyncLabel] = useState("この端末に保存中");
  const [taskModal, setTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskTags, setTaskTags] = useState(["勉強"]);
  const [taskPriority, setTaskPriority] = useState("中");
  const [taskDue, setTaskDue] = useState("");
  const [taskMinutes, setTaskMinutes] = useState("30");
  const [newTag, setNewTag] = useState("");
  const [search, setSearch] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [timerMode, setTimerMode] = useState("集中");
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("25");
  const [seconds, setSeconds] = useState("0");
  const [remaining, setRemaining] = useState(1500);
  const [elapsed, setElapsed] = useState(0);
  const [timerStatus, setTimerStatus] = useState("idle");
  const [pomodoro, setPomodoro] = useState(true);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [volume, setVolume] = useState(80);
  const [soundRepeats, setSoundRepeats] = useState(3);
  const [petPicker, setPetPicker] = useState(false);
  const [petName, setPetName] = useState(data.pet.name);
  const [alarmTime, setAlarmTime] = useState("07:00");
  const [alarmSound, setAlarmSound] = useState("ベル");
  const [showTagManager, setShowTagManager] = useState(false);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#f7c8d5");
  const [toast, setToast] = useState("");
  const [sleepTick, setSleepTick] = useState(Date.now());
  const timerRef = useRef(null);
  const saveRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem("pet-timer-state", JSON.stringify(data)); } catch (e) { console.warn("local save failed", e); }
    if (token) {
      clearTimeout(saveRef.current);
      setSyncLabel("同期中…");
      saveRef.current = setTimeout(async () => {
        try {
          const r = await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ state: data }) });
          if (!r.ok) throw new Error("sync");
          setSyncLabel("クラウド同期済み");
        } catch { setSyncLabel("同期できません（端末保存済み）"); }
      }, 700);
    } else setSyncLabel("この端末に保存済み");
    return () => clearTimeout(saveRef.current);
  }, [data, token]);

  useEffect(() => {
    if (timerStatus !== "running") return;
    timerRef.current = setInterval(() => {
      setRemaining(v => {
        if (v <= 1) {
          clearInterval(timerRef.current);
          setTimerStatus("overtime");
          setElapsed(0);
          beep(Number(soundRepeats), volume / 100);
          setToast(`${timerMode}の時間だよ！ ${data.pet.name}が応援しているよ🐾`);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timerStatus, soundRepeats, volume, timerMode, data.pet.name]);

  useEffect(() => {
    if (timerStatus !== "overtime") return;
    const id = setInterval(() => setElapsed(v => v + 1), 1000);
    return () => clearInterval(id);
  }, [timerStatus]);

  useEffect(() => {
    const id = setInterval(() => setSleepTick(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  // アプリを開いている間は、登録した毎日アラームを確認する。
  const firedAlarmsRef = useRef({});
  useEffect(() => {
    const checkAlarms = () => {
      const now = new Date();
      const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const keyDate = todayKey();
      data.alarms.forEach(alarm => {
        const firedKey = `${alarm.id}:${keyDate}`;
        if (alarm.enabled && alarm.time === current && !firedAlarmsRef.current[firedKey]) {
          firedAlarmsRef.current[firedKey] = true;
          beep(5, volume / 100);
          notify(`⏰ アラームだよ！ ${data.pet.name}からのお知らせ🐾`);
        }
      });
    };
    const id = setInterval(checkAlarms, 10000);
    checkAlarms();
    return () => clearInterval(id);
  }, [data.alarms, data.pet.name, volume]);

  const isSleeping = data.pet.sleepingUntil > sleepTick;
  const todaySessions = data.sessions.filter(s => s.date === todayKey());
  const focusSeconds = todaySessions.filter(s => s.mode === "集中").reduce((n,s) => n + s.seconds, 0);
  const restSeconds = todaySessions.filter(s => s.mode === "休憩").reduce((n,s) => n + s.seconds, 0);
  const doneCount = data.tasks.filter(t => t.done).length;
  const openTasks = data.tasks.filter(t => !t.done);
  const visibleTasks = useMemo(() => {
    let rows = data.tasks.filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.tags.some(x => x.includes(search)));
    if (data.filter === "today") rows = rows.filter(t => !t.due || t.due.slice(0,10) <= todayKey());
    if (data.filter === "week") rows = rows.filter(t => !t.due || t.due.slice(0,10) <= new Date(Date.now()+7*86400000).toISOString().slice(0,10));
    if (data.filter === "project") rows = rows.filter(t => t.project);
    return rows;
  }, [data.tasks, data.filter, search]);

  function patch(patch) { setData(d => ({ ...d, ...patch })); }
  function updatePet(patch) { setData(d => ({ ...d, pet: { ...d.pet, ...patch } })); }
  function notify(message) { setToast(message); setTimeout(() => setToast(""), 2800); }
  function startTimer() {
    if (timerStatus === "overtime") { setElapsed(0); setTimerStatus("idle"); return; }
    const total = Math.max(1, Number(hours || 0)*3600 + Number(minutes || 0)*60 + Number(seconds || 0));
    if (timerStatus === "paused") { setTimerStatus("running"); return; }
    setRemaining(total); setElapsed(0); setTimerStatus("running");
  }
  function stopTimer() {
    if (timerStatus === "running" || timerStatus === "overtime") {
      const elapsedSeconds = timerStatus === "overtime" ? Math.max(0, (Number(hours||0)*3600+Number(minutes||0)*60+Number(seconds||0))) : Math.max(0, Number(hours||0)*3600+Number(minutes||0)*60+Number(seconds||0)-remaining);
      const selected = data.tasks.find(t => t.id === data.selectedTaskId);
      const session = { id: crypto.randomUUID(), date: todayKey(), mode: timerMode, seconds: elapsedSeconds, taskTitle: selected?.title || "" };
      setData(d => ({ ...d, sessions: [...d.sessions, session], pet: { ...d.pet, xp: d.pet.xp + Math.floor(elapsedSeconds/300), coins: d.pet.coins + (timerMode === "集中" ? 3 : 1), affection: Math.min(100, d.pet.affection+2) } }));
      setTimerStatus("idle"); setElapsed(0); setRemaining(0);
      notify("おつかれさま！コインと経験値を獲得したよ✨");
    }
  }
  function deleteTask(task) {
    if (!window.confirm(`「${task.title}」を削除しますか？\\nこの操作は取り消せません。`)) return;
    setData(d => ({ ...d, tasks: d.tasks.filter(t => t.id !== task.id), selectedTaskId: d.selectedTaskId === task.id ? "" : d.selectedTaskId }));
    notify("タスクを削除したよ");
  }
  function toggleDone(task) {
    setData(d => ({ ...d, tasks: d.tasks.map(t => t.id === task.id ? { ...t, done: !t.done } : t), pet: task.done ? d.pet : { ...d.pet, coins: d.pet.coins+2, xp: d.pet.xp+5, affection: Math.min(100,d.pet.affection+1) } }));
    if (!task.done) notify("タスク完了！ペットが喜んでいるよ🐾");
  }
  function openNewTask(task = null) {
    setEditingTask(task);
    setTaskTitle(task?.title || "");
    setTaskTags(task?.tags || ["勉強"]);
    setTaskPriority(task?.priority || "中");
    setTaskDue(task?.due || "");
    setTaskMinutes(String(task?.minutes || 30));
    setTaskModal(true);
  }
  function saveTask(e) {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    const task = { id: editingTask?.id || crypto.randomUUID(), title: taskTitle.trim(), tags: taskTags, priority: taskPriority, due: taskDue, minutes: Number(taskMinutes)||0, done: editingTask?.done || false, project: editingTask?.project || (taskTags.includes("TAC") ? "TAC" : "") };
    setData(d => ({ ...d, tasks: editingTask ? d.tasks.map(t => t.id === task.id ? task : t) : [task, ...d.tasks] }));
    setTaskModal(false); notify(editingTask ? "タスクを更新したよ" : "タスクを追加したよ");
  }
  function feedPet() {
    if (data.pet.coins < 2) return notify("コインが足りないよ");
    updatePet({ hunger: Math.min(100,data.pet.hunger+22), coins: data.pet.coins-2, mood: Math.min(100,data.pet.mood+3) });
    notify(`${data.pet.name}にごはんをあげたよ🍚`);
  }
  function playPet() {
    if (isSleeping) return notify(`${data.pet.name}はお昼寝中だよ…`);
    updatePet({ affection: Math.min(100,data.pet.affection+5), energy: Math.max(15,data.pet.energy-12), mood: Math.min(100,data.pet.mood+8), coins: data.pet.coins+1 });
    if (Math.random() < 0.35) {
      updatePet({ sleepingUntil: Date.now()+60000, energy: Math.min(100,data.pet.energy+8) });
      notify(`${data.pet.name}は遊び疲れて眠っちゃった… Zzz`);
    } else notify(`${data.pet.name}と遊んだよ！`);
  }
  function addTag(e) {
    e.preventDefault();
    if (!tagName.trim() || data.tags.some(t => t.name === tagName.trim())) return;
    patch({ tags: [...data.tags, { name: tagName.trim(), color: tagColor }] });
    setTagName(""); notify("タグを追加したよ");
  }
  async function submitAuth(e) {
    e.preventDefault(); setAuthError("");
    const path = authMode === "register" ? "/api/register" : "/api/login";
    try {
      const r = await fetch(path, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email, password, state: data }) });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || "認証に失敗しました");
      setToken(result.token); setAccount(result.user.email);
      localStorage.setItem("pet-timer-token", result.token);
      localStorage.setItem("pet-timer-user", result.user.email);
      if (authMode === "login" && result.state && Object.keys(result.state).length) setData({ ...INITIAL, ...result.state });
      setAuthOpen(false); setPassword(""); notify("アカウントに接続したよ！");
    } catch (err) { setAuthError(err.message); }
  }
  function logout() {
    setToken(""); setAccount(""); localStorage.removeItem("pet-timer-token"); localStorage.removeItem("pet-timer-user");
    notify("ログアウトしました。端末のデータは残っています。");
  }
  function exportBackup() {
    const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href=url; a.download="pet-timer-backup.json"; a.click(); URL.revokeObjectURL(url);
  }
  function addAlarm() {
    patch({ alarms: [...data.alarms, { id: crypto.randomUUID(), time: alarmTime, sound: alarmSound, enabled: true }] });
    notify("アラームを登録したよ。ブラウザを開いたまま使ってね。");
  }
  function petImage() {
    return data.pet.image || petDefaultPhotos[data.pet.type] || petDefaultPhotos.cat;
  }

  const nav = ["ホーム","タイマー","アラーム","タスク","ペットのお部屋","記録・レポート","設定"];
  const shownSeconds = timerStatus === "running" ? remaining : timerStatus === "overtime" ? elapsed : remaining;
  const dateText = new Intl.DateTimeFormat("ja-JP", { month:"long", day:"numeric", weekday:"long" }).format(new Date());

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="paw">🐾</span><span>pet timer</span></div>
      <p className="tagline">いっしょにがんばる、<br/>ペットの学習タイマー</p>
      <button className="pet-select" onClick={() => setPetPicker(true)}><img className="avatar pet-avatar-photo" src={petImage()} alt=""/><b>{data.pet.name}</b><span className="chevron">⌄</span></button>
      <nav>{nav.map((n,i)=><button key={n} className={page===n?"nav-item active":"nav-item"} onClick={()=>setPage(n)}><span>{["⌂","◷","♧","☑","🐾","▥","⚙"][i]}</span>{n}</button>)}</nav>
      <div className="sync"><span className="cloud">☁</span><div><b>{syncLabel}</b><small>{account || "ゲストモード"}</small></div></div>
      <button className="account-btn" onClick={()=>token?logout():setAuthOpen(true)}>{token?"ログアウト":"アカウント登録・ログイン"}</button>
    </aside>

    <main className="main">
      <header className="topbar">
        <div><span className="date">{dateText}</span><h1>{page==="ホーム"?"おかえりなさい！":page}</h1></div>
        <div className="top-stats"><span>💗 なかよし Lv.{data.pet.level}</span><span>🪙 {data.pet.coins.toLocaleString()} <button className="plus" onClick={()=>notify("コインは勉強やタスク完了で増えるよ")}>＋</button></span><span>🏆 {Math.floor(data.pet.xp/10)}</span><button className="profile" onClick={()=>setAuthOpen(true)}>●</button></div>
      </header>

      {page==="ホーム" && <div className="dashboard">
        <section className="center-column">
          <div className="pet-hero">
            <div className="hero-glow"></div>
            <img className={`hero-pet pet-motion ${isSleeping?"sleeping":""}`} src={petImage()} alt={`${data.pet.name}の写真`} onError={e=>{e.currentTarget.src=petDefaultPhotos.cat;}}/>
            {isSleeping && <div className="zzz">Z z z</div>}
            <div className="pet-caption"><b>{data.pet.name}</b><span>{isSleeping?"すやすやお昼寝中…":"今日もいっしょにがんばろう！"}</span></div>
            <button className="change-pet" onClick={()=>setPetPicker(true)}>ペットを変更</button>
          </div>
          <div className="quick-actions">
            <button onClick={feedPet}><span>🥣</span>ごはん</button><button onClick={playPet}><span>🧶</span>あそぶ</button><button onClick={()=>notify("おやつをあげたよ🍪")}><span>🍪</span>おやつ</button><button onClick={()=>notify("なでなで…気持ちよさそう！")}><span>🪮</span>お手入れ</button><button onClick={()=>updatePet({sleepingUntil:Date.now()+60000,energy:Math.min(100,data.pet.energy+10)})}><span>🛏️</span>おやすみ</button>
            <button onClick={()=>notify("今日の健康状態を記録しよう！")}><span>💗</span>健康記録</button><button onClick={()=>notify(data.pet.name+"の成長を記録したよ！")}><span>📈</span>成長記録</button><button onClick={()=>notify("今日の思い出を日記に残そう📔")}><span>📔</span>日記</button><button onClick={()=>notify("ペットのアルバムを開く準備中だよ📷")}><span>🖼️</span>アルバム</button><button onClick={()=>notify("次のお世話をリマインダーに登録しよう⏰")}><span>⏰</span>予定・通知</button>
            <button onClick={()=>notify("お気に入りのおもちゃを選ぼう！")}><span>🎾</span>おもちゃ</button><button onClick={()=>notify("お部屋の模様替え機能は準備中だよ🏠")}><span>🏠</span>お部屋</button>
          </div>
        </section>
        <aside className="task-panel">
          <div className="panel-head"><h2>☑ タスク</h2><button className="add-btn" onClick={()=>openNewTask()}>＋ タスクを追加</button></div>
          <div className="filter-tabs">{[["today","今日"],["week","今週"],["all","すべて"],["project","プロジェクト"]].map(([v,l])=><button className={data.filter===v?"on":""} onClick={()=>patch({filter:v})}>{l}</button>)}</div>
          <div className="task-tools"><input placeholder="タスク・タグを検索" value={search} onChange={e=>setSearch(e.target.value)}/><span>{openTasks.length}件</span></div>
          <div className="task-list">{visibleTasks.slice(0,8).map(task=><div className={`task-row ${task.done?"completed":""}`} key={task.id}>
            <button className={`check ${task.done?"checked":""}`} onClick={()=>toggleDone(task)}>{task.done?"✓":""}</button>
            <div className="task-info"><button className="task-title" onClick={()=>openNewTask(task)}>{task.title}</button><div className="task-meta">{task.tags.map(tag=>{const t=data.tags.find(x=>x.name===tag);return <span className="tag" style={{background:t?.color||"#eee"}}>{tag}</span>})}<span className="duration">◷ {task.minutes}分</span>{task.priority==="高"&&<span className="flag">⚑</span>}</div></div>
            <button className="delete-task-btn" aria-label={`${task.title}を削除`} title="タスクを削除" onClick={()=>deleteTask(task)}>🗑</button>
          </div>)}</div>
          <div className="tag-manager"><div className="tag-heading"><b>◇ タグ管理</b><button onClick={()=>setShowTagManager(!showTagManager)}>＋</button></div><div className="tag-cloud">{data.tags.map(t=><span className="tag" style={{background:t.color}}>{t.name}</span>)}</div>
            {showTagManager&&<form className="inline-form" onSubmit={addTag}><input placeholder="新しいタグ名" value={tagName} onChange={e=>setTagName(e.target.value)}/><input type="color" value={tagColor} onChange={e=>setTagColor(e.target.value)}/><button>追加</button></form>}
          </div>
        </aside>
        <section className="pet-status">
          <img className="status-avatar pet-avatar-photo" src={petImage()} alt=""/><div className="status-name"><b>{data.pet.name} のようす</b><small>{isSleeping?"すやすやお昼寝中":"ごきげんだよ！"}</small></div>
          <div className="meters"><Meter label="ごきげん" value={data.pet.mood} color="#e97c98"/><Meter label="まんぷく" value={data.pet.hunger} color="#f4b63e"/><Meter label="げんき" value={data.pet.energy} color="#55b8df"/></div>
        </section>
        <section className="today-card"><h3>▥ 今日のがんばり</h3><p>💗 集中 <b>{todaySessions.filter(s=>s.mode==="集中").length}回（{Math.floor(focusSeconds/60)}分）</b></p><p>☕ 休憩 <b>{todaySessions.filter(s=>s.mode==="休憩").length}回（{Math.floor(restSeconds/60)}分）</b></p><p>🐾 タスク完了 <b>{doneCount}/{data.tasks.length}件</b></p></section>
      </div>}


      {page==="タイマー" && <section className="full-panel timer-workspace">
        <div className="timer-page-heading"><div><span className="date">FOCUS TIME</span><h2>いっしょに集中しよう</h2><p>{data.pet.name}と一緒に、今日の一歩を進めよう。</p></div><div className="timer-pet-badge"><img className="pet-motion" src={petImage()} alt=""/><b>{data.pet.name}</b></div></div>
        <div className="timer-task-select"><label htmlFor="timer-task">取り組むタスク</label><select id="timer-task" value={data.selectedTaskId||""} onChange={e=>patch({selectedTaskId:e.target.value})}><option value="">タスクを選ばずに集中</option>{openTasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select><button className="soft-btn" onClick={()=>openNewTask()}>＋ タスク追加</button></div>
                  <div className="timer-card">
            <div className="timer-tabs">{["集中","休憩","カスタム"].map(m=><button className={timerMode===m?"selected":""} onClick={()=>{setTimerMode(m);setTimerStatus("idle");setElapsed(0);setRemaining(m==="集中"?1500:m==="休憩"?300:0);setHours("0");setMinutes(m==="集中"?"25":m==="休憩"?"5":"0");setSeconds("0");}}>{m==="集中"?"✦ ":m==="休憩"?"☕ ":"◌ "}{m}</button>)}</div>
            <div className="timer-digits">{timerStatus==="overtime"?`+${fmt(elapsed)}`:fmt(shownSeconds)}</div>
            <div className="timer-sub">{timerStatus==="overtime"?`${timerMode}終了からの経過時間`:timerStatus==="running"?"いっしょに集中中…":timerStatus==="paused"?"一時停止中":"時間を決めてスタートしよう"}</div>
            <div className="time-inputs">
              <label>時<input type="number" min="0" max="99" value={hours} onChange={e=>setHours(e.target.value)}/></label>
              <label>分<input type="number" min="0" max="59" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label>
              <label>秒<input type="number" min="0" max="59" value={seconds} onChange={e=>setSeconds(e.target.value)}/></label>
            </div>
            <div className="timer-options"><label><input type="checkbox" checked={pomodoro} onChange={e=>setPomodoro(e.target.checked)}/> 集中後に自動休憩</label><span>休憩 <input type="number" min="1" max="60" value={breakMinutes} onChange={e=>setBreakMinutes(Number(e.target.value))}/> 分</span></div>
            <div className="timer-actions">
              {timerStatus==="running"? <button className="soft-btn" onClick={()=>setTimerStatus("paused")}>一時停止</button>:<button className="start-btn" onClick={startTimer}>{timerStatus==="paused"?"▶ 再開":"▶ 開始"}</button>}
              {timerStatus==="overtime"?<button className="soft-btn" onClick={stopTimer}>記録して終了</button>:timerStatus==="paused"?<button className="soft-btn" onClick={()=>{setTimerStatus("idle");setElapsed(0);}}>リセット</button>:null}
              {timerStatus==="idle" && <button className="tiny-reset" onClick={()=>{setRemaining(0);setHours("0");setMinutes("0");setSeconds("0");}}>クリア</button>}
            </div>
            <div className="sound-settings">🔔 終了音 <select value={soundRepeats} onChange={e=>setSoundRepeats(Number(e.target.value))}><option value="1">1回</option><option value="3">3回</option><option value="5">5回</option></select><span>音量</span><input type="range" min="10" max="100" value={volume} onChange={e=>setVolume(Number(e.target.value))}/><button onClick={()=>beep(Number(soundRepeats),volume/100)}>試聴</button></div>
          </div>
        <div className="timer-encouragement"><img className="pet-avatar-photo" src={petImage()} alt=""/><div><b>{data.pet.name}が応援しているよ</b><p>終わったら経験値とコインをゲット！</p></div></div>
      </section>}
      {page==="タスク" && <section className="full-panel">
        <div className="panel-head"><h2>☑ タスク管理</h2><button className="add-btn" onClick={()=>openNewTask()}>＋ タスクを追加</button></div>
        <div className="task-view-switch"><button className={data.view==="list"?"on":""} onClick={()=>patch({view:"list"})}>☷ リスト</button><button className={data.view==="calendar"?"on":""} onClick={()=>patch({view:"calendar"})}>▦ カレンダー</button></div>
        {data.view==="list" ? <div className="wide-task-list">{data.tasks.map(task=><div className="wide-task" key={task.id}><button className={`check ${task.done?"checked":""}`} onClick={()=>toggleDone(task)}>{task.done?"✓":""}</button><div className="task-info"><button className="task-title" onClick={()=>openNewTask(task)}>{task.title}</button><div className="task-meta">{task.tags.map(tag=><span className="tag" style={{background:data.tags.find(t=>t.name===tag)?.color||"#eee"}}>{tag}</span>)}<span>{task.due?new Date(task.due).toLocaleString("ja-JP"):"期限未設定"}</span><span>{task.minutes}分</span><b className="priority">{task.priority}</b></div></div><button className="soft-btn" onClick={()=>openNewTask(task)}>編集</button><button className="delete-task-btn" aria-label={`${task.title}を削除`} title="タスクを削除" onClick={()=>deleteTask(task)}>🗑 削除</button></div>)}</div>
        : <Calendar month={calendarMonth} setMonth={setCalendarMonth} tasks={data.tasks} onTask={openNewTask}/>}
      </section>}

      {page==="アラーム" && <section className="full-panel"><h2>♧ アラーム</h2><div className="alarm-form"><label>時刻<input type="time" value={alarmTime} onChange={e=>setAlarmTime(e.target.value)}/></label><label>音<select value={alarmSound} onChange={e=>setAlarmSound(e.target.value)}><option>ベル</option><option>チャイム</option><option>やさしい音</option></select></label><button className="add-btn" onClick={addAlarm}>＋ アラームを追加</button></div>{data.alarms.map(a=><div className="alarm-row"><b>{a.time}</b><span>{a.sound}</span><label><input type="checkbox" checked={a.enabled} onChange={e=>patch({alarms:data.alarms.map(x=>x.id===a.id?{...x,enabled:e.target.checked}:x)})}/> 有効</label><button onClick={()=>patch({alarms:data.alarms.filter(x=>x.id!==a.id)})}>削除</button></div>)}<p className="notice">※ ブラウザの仕様上、ページを閉じたり端末がスリープしたりすると、アラームが鳴らない場合があります。まずはページを開いたまま、音を有効にしてご利用ください。</p></section>}

      {page==="ペットのお部屋" && <section className="full-panel room"><div className="room-hero"><img className="pet-motion" src={petImage()} alt={`${data.pet.name}の写真`}/><div><h2>{data.pet.name}のお部屋</h2><p>いっしょに遊んだり、ごはんをあげたりしよう。</p><div className="room-level">Lv.{data.pet.level} · なかよし度 {data.pet.affection}% · 🪙 {data.pet.coins}</div></div></div><div className="room-actions"><button onClick={feedPet}>🍚 ごはん（2コイン）</button><button onClick={playPet}>🧶 あそぶ</button><button onClick={()=>notify("おやつをあげたよ！")}>🍪 おやつ</button><button onClick={()=>notify("やさしくブラッシングしたよ")}>🪮 お手入れ</button><button onClick={()=>updatePet({sleepingUntil:Date.now()+60000,energy:Math.min(100,data.pet.energy+10)})}>🛏️ お昼寝</button></div><p className="notice">遊んだ後は、ときどき自分からお昼寝するよ。お昼寝中は起こさず、そっと見守ってね。</p></section>}

      {page==="記録・レポート" && <section className="full-panel"><h2>▥ 記録・レポート</h2><div className="report-grid"><div><small>今日の集中時間</small><strong>{Math.floor(focusSeconds/60)}分</strong></div><div><small>今日の休憩時間</small><strong>{Math.floor(restSeconds/60)}分</strong></div><div><small>完了タスク</small><strong>{doneCount}件</strong></div><div><small>ペットのレベル</small><strong>Lv.{data.pet.level}</strong></div></div><h3>今日のセッション</h3>{todaySessions.length?todaySessions.map(s=><p className="session-row">{s.mode} · {Math.floor(s.seconds/60)}分 · {s.taskTitle||"タスク未選択"}</p>):<p className="notice">タイマーを使うと、ここに記録されるよ。</p>}</section>}

      {page==="設定" && <section className="full-panel"><h2>⚙ 設定</h2><div className="settings-row"><div><b>アカウント・クラウド保存</b><p>{account||"ゲスト利用中"}</p></div><button className="add-btn" onClick={()=>token?logout():setAuthOpen(true)}>{token?"ログアウト":"登録・ログイン"}</button></div><div className="settings-row"><div><b>データのバックアップ</b><p>タスク・ペット・設定をJSONファイルで保存</p></div><button className="soft-btn" onClick={exportBackup}>バックアップを書き出す</button></div><div className="settings-row"><div><b>ペットの名前・種類・写真</b><p>名前や種類、表示スタイルを変更できるよ。</p></div><button className="soft-btn" onClick={()=>setPetPicker(true)}>変更</button></div><div className="settings-row"><div><b>アラームについて</b><p>ブラウザを閉じた状態での鳴動は保証されません。</p></div></div></section>}
    </main>

    {taskModal && <div className="modal-backdrop" onClick={()=>setTaskModal(false)}><form className="modal" onSubmit={saveTask} onClick={e=>e.stopPropagation()}><h2>{editingTask?"タスクを編集":"タスクを追加"}</h2><label>タスク名<input autoFocus value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="例：簿記論の講義を見る"/></label><label>タグ（複数選択）<div className="tag-picker">{data.tags.map(t=><button type="button" className={taskTags.includes(t.name)?"picked":""} style={{background:t.color}} onClick={()=>setTaskTags(v=>v.includes(t.name)?v.filter(x=>x!==t.name):[...v,t.name])}>{t.name}</button>)}</div></label><div className="form-grid"><label>優先順位<select value={taskPriority} onChange={e=>setTaskPriority(e.target.value)}><option>高</option><option>中</option><option>低</option></select></label><label>予定時間（分）<input type="number" min="0" value={taskMinutes} onChange={e=>setTaskMinutes(e.target.value)}/></label></div><label>期限<input type="datetime-local" value={taskDue} onChange={e=>setTaskDue(e.target.value)}/></label><div className="modal-actions"><button type="button" className="soft-btn" onClick={()=>setTaskModal(false)}>キャンセル</button><button className="add-btn">保存</button></div></form></div>}

    {authOpen && <div className="modal-backdrop" onClick={()=>setAuthOpen(false)}><form className="modal" onSubmit={submitAuth} onClick={e=>e.stopPropagation()}><h2>{authMode==="register"?"アカウント登録":"ログイン"}</h2><p className="modal-help">アカウントを作ると、ペットやタスクを別の端末でも引き継げるようになります。</p><label>メールアドレス<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label>パスワード（8文字以上）<input type="password" required minLength="8" value={password} onChange={e=>setPassword(e.target.value)}/></label>{authError&&<p className="error">{authError}</p>}<button className="add-btn full">{authMode==="register"?"登録してクラウド保存":"ログイン"}</button><button type="button" className="text-button" onClick={()=>{setAuthMode(authMode==="register"?"login":"register");setAuthError("");}}>{authMode==="register"?"すでにアカウントをお持ちの方：ログイン":"アカウントを新規登録"}</button></form></div>}

    {petPicker && <div className="modal-backdrop" onClick={()=>setPetPicker(false)}><div className="modal" onClick={e=>e.stopPropagation()}><h2>いっしょに過ごすペット</h2><div className="pet-options">{Object.entries(petLabels).map(([type,label])=><button className={data.pet.type===type?"chosen":""} onClick={()=>{updatePet({type,image:""});}}><img className="pet-option-photo" src={petDefaultPhotos[type]} alt=""/>{label}</button>)}</div><label>名前<input value={petName} onChange={e=>setPetName(e.target.value)}/></label><label>ペットの写真を選ぶ<input type="file" accept="image/*" onChange={e=>{const input=e.currentTarget;const f=input.files?.[0];if(!f)return;if(!f.type.startsWith("image/")){notify("画像ファイルを選んでね");input.value="";return;}if(f.size>20*1024*1024){notify("20MB以下の写真を選んでね");input.value="";return;}const reader=new FileReader();reader.onerror=()=>{notify("写真を読み込めなかったよ。もう一度選んでね");input.value="";};reader.onload=()=>{const img=new Image();img.onerror=()=>{notify("この写真形式は読み込めなかったよ。JPEGかPNGを試してね");input.value="";};img.onload=()=>{try{const max=720,scale=Math.min(1,max/Math.max(img.width,img.height));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext("2d");if(!ctx)throw new Error("canvas");ctx.drawImage(img,0,0,canvas.width,canvas.height);const compressed=canvas.toDataURL("image/jpeg",0.68);updatePet({image:compressed});notify("写真を登録したよ！ホームに反映したよ");}catch(err){notify("写真を保存できなかったよ。別の画像を試してね");}input.value="";};img.src=String(reader.result);};reader.readAsDataURL(f);}}/></label><p className="modal-help">ペットを選ぶだけで写真が自動表示されるよ。自分の写真にしたいときだけ、下からアップロードしてね。</p><div className="modal-actions"><button className="soft-btn" onClick={()=>setPetPicker(false)}>閉じる</button><button className="add-btn" onClick={()=>{updatePet({name:petName||"うちの子"});setPetPicker(false);}}>保存</button></div></div></div>}

    {toast && <div className="toast">{toast}</div>}
  </div>;
}

function PetArtwork({type="cat",sleeping=false,compact=false}) {
  const palette = {
    cat:["#f3a45f","#d98248","#ffe0b9","#e88e86"],
    dog:["#c99568","#986743","#f1d1a8","#80563f"],
    rabbit:["#f2e8df","#d8c8bd","#fffaf4","#e9a8b1"],
    hamster:["#d9a45d","#b77c3d","#fff0d8","#e9a3a0"]
  }[type] || ["#f3a45f","#d98248","#ffe0b9","#e88e86"];
  const [body,shade,light,ear]=palette;
  return <div className={"pet-art-wrap "+(compact?"compact ":"")+(sleeping?"sleeping":"")} role="img" aria-label={(petLabels[type]||"ペット")+"のイラスト"}>
    <svg className="pet-art" viewBox="0 0 240 210" aria-hidden="true">
      {type==="cat" && <path d="M65 85 L58 28 L100 61 Q120 52 140 61 L182 28 L175 90" fill={body} stroke={shade} strokeWidth="6" strokeLinejoin="round"/>}
      {type==="dog" && <><path d="M78 72 Q35 15 38 68 Q44 110 86 105 M162 72 Q205 15 202 68 Q196 110 154 105" fill={shade}/></>}
      {type==="rabbit" && <><path d="M91 83 Q55 -8 91 5 Q112 10 116 79 M132 79 Q137 -8 161 5 Q182 23 148 86" fill={body} stroke={shade} strokeWidth="5"/><path d="M91 57 Q78 8 91 17 Q105 37 108 67 M143 65 Q149 20 160 17 Q169 38 150 66" fill={ear}/></>}
      {type==="hamster" && <><circle cx="77" cy="72" r="25" fill={ear}/><circle cx="163" cy="72" r="25" fill={ear}/></>}
      <ellipse cx="120" cy="135" rx="73" ry="59" fill={body} stroke={shade} strokeWidth="5"/>
      <circle cx="120" cy="83" r="53" fill={body} stroke={shade} strokeWidth="5"/>
      {type==="cat" && <><path d="M85 43 L89 12 L111 35 M129 35 L153 12 L156 43" fill={body} stroke={shade} strokeWidth="5" strokeLinejoin="round"/><path d="M90 28 L93 18 L104 34 M138 34 L151 18 L150 29" fill={ear}/></>}
      {type==="dog" && <ellipse cx="120" cy="103" rx="33" ry="25" fill={light}/>}
      {type==="hamster" && <><circle cx="91" cy="105" r="22" fill={light}/><circle cx="149" cy="105" r="22" fill={light}/></>}
      <ellipse cx="120" cy="151" rx="42" ry="34" fill={light}/>
      <path d={sleeping?"M94 87 Q102 96 110 87 M130 87 Q138 96 146 87":"M97 85 Q102 76 107 85 M133 85 Q138 76 143 85"} fill="none" stroke="#513b38" strokeWidth="5" strokeLinecap="round"/>
      <path d="M115 105 Q120 111 125 105 M120 111 Q109 122 101 114 M120 111 Q131 122 139 114" fill="none" stroke="#b96f73" strokeWidth="4" strokeLinecap="round"/>
      <path d="M63 142 Q39 130 31 149 M177 142 Q201 130 209 149" fill="none" stroke={shade} strokeWidth="12" strokeLinecap="round"/>
      <ellipse cx="88" cy="180" rx="20" ry="10" fill={shade}/><ellipse cx="152" cy="180" rx="20" ry="10" fill={shade}/>
      {sleeping && <text x="176" y="24" fontSize="24" fontWeight="bold" fill="#fff" stroke="#a77c70" strokeWidth="1">Z z z</text>}
    </svg>
  </div>;
}

function Meter({label,value,color}) { return <div className="meter"><span>{label}</span><div className="bar"><i style={{width:`${value}%`,background:color}}/></div><b>{value}%</b></div>; }

function Calendar({month,setMonth,tasks,onTask}) {
  const year=month.getFullYear(), m=month.getMonth(), first=new Date(year,m,1).getDay(), days=new Date(year,m+1,0).getDate();
  const cells=[...Array(first).fill(null),...Array.from({length:days},(_,i)=>i+1)];
  return <div className="calendar"><div className="calendar-head"><button onClick={()=>setMonth(new Date(year,m-1,1))}>‹</button><b>{year}年 {m+1}月</b><button onClick={()=>setMonth(new Date(year,m+1,1))}>›</button></div><div className="calendar-grid">{["日","月","火","水","木","金","土"].map(d=><b>{d}</b>)}{cells.map((day,i)=><div className="calendar-day" key={i}><span>{day||""}</span>{day&&tasks.filter(t=>t.due&&new Date(t.due).getDate()===day&&new Date(t.due).getMonth()===m).slice(0,2).map(t=><button onClick={()=>onTask(t)}>{t.title}</button>)}</div>)}</div></div>;
}
