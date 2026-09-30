const $ = (id) => document.getElementById(id);
let worker;
const SYSTEM = { role: "system", content: "You are a helpful assistant. Keep answers short and clear." };
let history = [SYSTEM];
let busy = false;
const EMPTY = document.getElementById("log").innerHTML;
const C = 339.3; // ring circumference

// Register the service worker first and start the AI engine only once it is active,
// so the engine's library files get cached for offline use.
const swReady = "serviceWorker" in navigator
  ? navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready).catch(() => {})
  : Promise.resolve();
async function startWorker() {
  await swReady;
  if (worker) worker.terminate();
  worker = new Worker("worker.js", { type: "module" });
  worker.onmessage = onMsg;
  worker.onerror = () => onMsg({ data: { type: "error", msg: "Couldn't start the engine. Check your connection and try again." } });
}
if (navigator.storage?.persist) navigator.storage.persist();

const ios = /iphone|ipad/i.test(navigator.userAgent);
const standalone = navigator.standalone || matchMedia("(display-mode: standalone)").matches;
if (ios && !standalone) $("hint").textContent = "On iPhone: tap Share, then Add to Home Screen, and open the app from there before downloading.";

function net() {
  const off = !navigator.onLine;
  $("net").classList.toggle("off", off);
  $("netlabel").textContent = off ? "Offline" : "Works offline";
}
addEventListener("online", net); addEventListener("offline", net); net();

let had = false;
try { had = localStorage.getItem("alpha-model") === "1"; } catch (_) {}
async function begin() {
  if (!navigator.gpu) {
    $("title").textContent = "WebGPU isn't available";
    $("sub").textContent = "This phone or browser can't run the model yet. On iPhone you need iOS 26 or newer. On Android, use a recent Chrome.";
    $("loadbtn").classList.add("hide");
    return;
  }
  $("loadbtn").disabled = true;
  $("loadbtn").textContent = had ? "Loading…" : "Downloading…";
  $("introorb").classList.add("busy");
  await startWorker();
  worker.postMessage({ type: "load" });
}
$("loadbtn").onclick = begin;

function scroll() { $("log").scrollTop = $("log").scrollHeight; }

function addUser(text, still) {
  const r = document.createElement("div"); r.className = "row u" + (still ? " still" : "");
  const t = document.createElement("div"); t.className = "t"; t.textContent = text;
  r.appendChild(t); $("log").appendChild(r); scroll();
}
function addBot() {
  const r = document.createElement("div"); r.className = "row a";
  r.innerHTML = '<div class="orb sm busy"></div><div class="body"><div class="status"><span class="dots"><i></i><i></i><i></i></span><span class="st"></span></div><div class="t"></div><div class="stat"></div></div>';
  $("log").appendChild(r); scroll();
  const b = { orb: r.querySelector(".orb"), t: r.querySelector(".t"), stat: r.querySelector(".stat"), status: r.querySelector(".status"), st: r.querySelector(".st") };
  startStatus(b);
  return b;
}

// Perceived-latency: honest, friendly status while the model reads the prompt.
const LINES = ["Turning it over…", "Choosing the first word…", "Sharpening the pencil…", "Consulting the muses…", "Finding the right shape…"];
function setSt(b, text) { b.st.textContent = text; b.st.style.animation = "none"; void b.st.offsetWidth; b.st.style.animation = ""; }
function startStatus(b) {
  setSt(b, "Reading your message…");
  let i = 0;
  b.timer = setTimeout(function tick() { setSt(b, LINES[i++ % LINES.length]); b.timer = setTimeout(tick, 1900); }, 1100);
}
function stopStatus(b) { clearTimeout(b.timer); b.status.classList.add("hide"); b.t.classList.add("caret"); }

// Smooth typewriter: tokens arrive in bursts, this releases them at an even pace.
let queue = "", pumping = false, onDrained = null;
function pump() {
  if (queue) {
    const k = Math.max(1, Math.ceil(queue.length / 10));
    bot.t.textContent += queue.slice(0, k); queue = queue.slice(k); scroll();
    requestAnimationFrame(pump);
  } else { pumping = false; if (onDrained) { const f = onDrained; onDrained = null; f(); } }
}
function push(t) { queue += t; if (!pumping) { pumping = true; requestAnimationFrame(pump); } }

let bot, t0, tFirst, n;

function send(text) {
  text = text.trim();
  if (!text || busy) return;
  busy = true; $("send").disabled = true; document.body.classList.add("gen"); navigator.vibrate?.(8);
  $("empty")?.remove();
  addUser(text);
  history.push({ role: "user", content: text });
  bot = addBot(); t0 = performance.now(); tFirst = 0; n = 0;
  worker.postMessage({ type: "chat", messages: history });
}

$("f").onsubmit = (e) => { e.preventDefault(); const v = $("q").value; $("q").value = ""; grow(); sync(); send(v); };
$("q").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && matchMedia("(hover:hover)").matches) { e.preventDefault(); $("f").requestSubmit(); }
});
function grow() { const q = $("q"); q.style.height = "auto"; q.style.height = Math.min(q.scrollHeight, 120) + "px"; }
$("q").addEventListener("input", () => { grow(); sync(); });
function sync() { $("send").classList.toggle("on", !!$("q").value.trim()); }
document.querySelectorAll(".chip").forEach((c) => (c.onclick = () => send(c.textContent)));


function onMsg({ data }) {
  if (data.type === "progress") {
    $("arc").style.strokeDashoffset = C * (1 - data.pct / 100);
    $("title").textContent = `${had ? "Loading" : "Downloading"} ${Math.round(data.pct)}%`;
    $("sub").textContent = "Keep this screen open. This only happens once.";
  } else if (data.type === "warming") {
    $("arc").style.strokeDashoffset = 0;
    $("title").textContent = "Almost ready…";
    $("sub").textContent = "Tuning the engine so your first reply comes fast.";
  } else if (data.type === "ready") {
    $("intro").classList.add("hide");
    $("app").classList.remove("hide");
    try { localStorage.setItem("alpha-model", "1"); } catch (_) {}
  } else if (data.type === "token") {
    if (!tFirst) { tFirst = performance.now(); stopStatus(bot); }
    n++;
    push(data.t);
  } else if (data.type === "done") {
    const end = performance.now(), b = bot;
    const finish = () => {
      b.t.classList.remove("caret");
      b.orb.classList.remove("busy");
      if (n > 1) b.stat.textContent = `~${(n / ((end - tFirst) / 1000)).toFixed(1)} tokens/s · first word in ${((tFirst - t0) / 1000).toFixed(1)}s`;
      history.push({ role: "assistant", content: b.t.textContent }); saveChat();
      busy = false; $("send").disabled = false; document.body.classList.remove("gen");
    };
    if (!tFirst) stopStatus(b);
    if (queue) onDrained = finish; else finish();
  } else if (data.type === "error") {
    if (!$("intro").classList.contains("hide")) {
      had = false;
      $("title").textContent = "Couldn't load the model";
      $("sub").textContent = data.msg;
      $("loadbtn").disabled = false; $("loadbtn").textContent = "Try again";
      $("introorb").classList.remove("busy");
    } else if (bot) {
      queue = ""; stopStatus(bot); bot.orb.classList.remove("busy");
      bot.t.classList.remove("caret");
      bot.t.textContent = "Something went wrong: " + data.msg;
    }
  }
}

// ---- Recent chats: saved on this phone (localStorage), newest first ----
const KEY = "alpha-chats-v1";
let chats = [];
try { chats = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (_) {}
let cur = Date.now().toString(36);
function persist() { try { localStorage.setItem(KEY, JSON.stringify(chats)); } catch (_) {} }
function saveChat() {
  const first = history.find((m) => m.role === "user");
  if (!first) return;
  const c = { id: cur, title: first.content.slice(0, 60), ts: Date.now(), messages: history };
  const i = chats.findIndex((x) => x.id === cur);
  if (i >= 0) chats.splice(i, 1);
  chats.unshift(c);
  chats = chats.slice(0, 30);
  persist();
}
function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + " min ago";
  const h = Math.round(m / 60);
  return h < 24 ? h + " h ago" : Math.round(h / 24) + " d ago";
}
function renderList() {
  const el = $("list"); el.innerHTML = "";
  if (!chats.length) { el.innerHTML = '<p class="none">No saved chats yet. Conversations are kept on this phone only.</p>'; return; }
  chats.forEach((c) => {
    const row = document.createElement("div"); row.className = "item";
    const pick = document.createElement("button"); pick.className = "pick";
    pick.innerHTML = '<span class="it"></span><span class="tm"></span>';
    pick.querySelector(".it").textContent = c.title;
    pick.querySelector(".tm").textContent = ago(c.ts);
    pick.onclick = () => openChat(c.id);
    const del = document.createElement("button"); del.className = "del"; del.textContent = "×"; del.setAttribute("aria-label", "Delete chat");
    del.onclick = () => { chats = chats.filter((x) => x.id !== c.id); persist(); renderList(); };
    row.append(pick, del); el.appendChild(row);
  });
}
function addStill(text) {
  const r = document.createElement("div"); r.className = "row a still";
  r.innerHTML = '<div class="orb sm"></div><div class="body"><div class="t"></div></div>';
  r.querySelector(".t").textContent = text;
  $("log").appendChild(r);
}
function openChat(id) {
  if (busy) return;
  const c = chats.find((x) => x.id === id);
  if (!c) return;
  history = c.messages.slice(); cur = c.id;
  $("log").innerHTML = "";
  history.forEach((m) => { if (m.role === "user") addUser(m.content, true); else if (m.role === "assistant") addStill(m.content); });
  closeSheet(); scroll();
}
function closeSheet() { $("sheet").classList.remove("open"); }
$("hist").onclick = () => { renderList(); $("sheet").classList.add("open"); };
$("scrim").onclick = closeSheet;
addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
$("new").onclick = () => {
  if (busy) return;
  history = [SYSTEM]; cur = Date.now().toString(36);
  $("log").innerHTML = EMPTY;
  document.querySelectorAll(".chip").forEach((c) => (c.onclick = () => send(c.textContent)));
  closeSheet();
};

// Model already on this phone: load it automatically.
if (had) {
  $("title").textContent = "Waking the model…";
  $("sub").textContent = "Loading from this phone. No internet needed.";
  begin();
}
