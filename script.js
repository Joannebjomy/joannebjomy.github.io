/* ==========================================================
   The Making of an Engineer: interactive parts
   1. Chapter tabs that follow your scroll
   2. Chapter I:   L-system fractal generator
   3. Chapter II:  SmartAttend video with scene markers
   4. Chapter III: "Am I at risk?" checker (real KNN model)
   ========================================================== */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- 1. Tabs: highlight the chapter you're reading ---------- */
const tabs = document.querySelectorAll("[data-tab]");
const sections = [...tabs].map(t => document.querySelector(t.getAttribute("href")));

const tabObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    tabs.forEach(t => t.classList.toggle("is-active", t.getAttribute("href") === "#" + entry.target.id));
  });
}, { rootMargin: "-45% 0px -50% 0px" });
sections.forEach(s => s && tabObserver.observe(s));

const toTop = document.getElementById("to-top");
window.addEventListener("scroll", () => toTop.classList.toggle("show", window.scrollY > 600), { passive: true });
toTop.addEventListener("click", () => document.getElementById("title").scrollIntoView());


/* ---------- 2. Chapter I: L-system fractals ---------- */
const PATTERNS = {
  fern:      { name: "fern",         axiom: "X",       rules: { X: "F+[[X]-X]-F[-FX]+X", F: "FF" }, angle: 25,   gens: 5,  start: -65 },
  bush:      { name: "bush",         axiom: "F",       rules: { F: "FF+[+F-F-F]-[-F+F+F]" },        angle: 22.5, gens: 4,  start: -90 },
  dragon:    { name: "dragon curve", axiom: "FX",      rules: { X: "X+YF+", Y: "-FX-Y" },           angle: 90,   gens: 11, start: 0 },
  snowflake: { name: "snowflake",    axiom: "F--F--F", rules: { F: "F+F--F+F" },                    angle: 60,   gens: 4,  start: 0 },
};

// Step 1: rewrite the string again and again
function expand(p) {
  let s = p.axiom;
  for (let i = 0; i < p.gens; i++) {
    let next = "";
    for (const ch of s) next += p.rules[ch] ?? ch;
    s = next;
  }
  return s;
}

// Step 2: let a "turtle" read the string and record every line it draws
function walk(str, p) {
  const segs = [], stack = [];
  let x = 0, y = 0, a = p.start * Math.PI / 180;
  const turn = p.angle * Math.PI / 180;
  for (const ch of str) {
    if (ch === "F") {
      const nx = x + Math.cos(a), ny = y + Math.sin(a);
      segs.push([x, y, nx, ny, stack.length]);
      x = nx; y = ny;
    } else if (ch === "+") a += turn;
    else if (ch === "-") a -= turn;
    else if (ch === "[") stack.push([x, y, a]);
    else if (ch === "]") [x, y, a] = stack.pop();
  }
  return segs;
}

const canvas = document.getElementById("fractal");
const ctx = canvas.getContext("2d");
const caption = document.getElementById("fractal-caption");
const readout = document.getElementById("fractal-readout");
let drawJob = 0;

function grow() {
  const p = PATTERNS[document.getElementById("pattern").value];
  const str = expand(p);
  const segs = walk(str, p);

  // fit the drawing to the canvas
  const dpr = window.devicePixelRatio || 1;
  const W = 520, H = 460, pad = 22;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x1, y1, x2, y2] of segs) {
    minX = Math.min(minX, x1, x2); maxX = Math.max(maxX, x1, x2);
    minY = Math.min(minY, y1, y2); maxY = Math.max(maxY, y1, y2);
  }
  const scale = Math.min((W - 2 * pad) / (maxX - minX), (H - 2 * pad) / (maxY - minY));
  const ox = (W - (maxX - minX) * scale) / 2 - minX * scale;
  const oy = (H - (maxY - minY) * scale) / 2 - minY * scale;

  ctx.lineCap = "round";
  const maxDepth = Math.max(1, ...segs.map(s => s[4]));
  const drawSeg = ([x1, y1, x2, y2, depth]) => {
    // older branches darker and thicker, new growth lighter: like ink drying
    const t = depth / maxDepth;
    ctx.strokeStyle = `rgba(${Math.round(62 + 60 * t)}, ${Math.round(43 + 70 * t)}, ${Math.round(31 + 30 * t)}, ${0.95 - 0.35 * t})`;
    ctx.lineWidth = p.name === "fern" || p.name === "bush" ? Math.max(0.6, 1.8 - t * 1.2) : 1.1;
    ctx.beginPath();
    ctx.moveTo(ox + x1 * scale, oy + y1 * scale);
    ctx.lineTo(ox + x2 * scale, oy + y2 * scale);
    ctx.stroke();
  };

  caption.textContent = `specimen: ${p.name}, ${p.gens} generations`;
  readout.textContent = `The rules turned "${p.axiom}" into a string ${str.length.toLocaleString()} characters long, which the turtle drew as ${segs.length.toLocaleString()} lines.`;

  const job = ++drawJob;
  if (reduceMotion) { segs.forEach(drawSeg); return; }
  const perFrame = Math.ceil(segs.length / 90);   // about 1.5 seconds
  let i = 0;
  (function frame() {
    if (job !== drawJob) return;                   // a newer drawing started
    for (let n = 0; n < perFrame && i < segs.length; n++, i++) drawSeg(segs[i]);
    if (i < segs.length) requestAnimationFrame(frame);
  })();
}

document.getElementById("grow").addEventListener("click", grow);
document.getElementById("pattern").addEventListener("change", grow);

// grow the fern the first time Chapter I comes into view
new IntersectionObserver((entries, obs) => {
  if (entries[0].isIntersecting) { grow(); obs.disconnect(); }
}, { threshold: 0.3 }).observe(canvas);


/* ---------- 3. Chapter II: SmartAttend video scenes ---------- */
const saVideo = document.getElementById("sa-video");
const sceneButtons = document.querySelectorAll(".scenes button");

sceneButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    saVideo.currentTime = +btn.dataset.time;
    saVideo.play().catch(() => {});      // some browsers block autoplay; the jump still works
  });
});

// highlight the scene that is currently playing
saVideo.addEventListener("timeupdate", () => {
  let current = sceneButtons[0];
  sceneButtons.forEach(btn => { if (saVideo.currentTime >= +btn.dataset.time) current = btn; });
  sceneButtons.forEach(btn => btn.classList.toggle("is-playing", btn === current && saVideo.currentTime > 0));
});


/* ---------- 4. Chapter III: the KNN early-warning checker ---------- */
// KNN_DATA comes from model-data.js: the same 316 training students as the notebook.
const g1 = document.getElementById("g1");
const abs = document.getElementById("absences");
g1.addEventListener("input", () => (document.getElementById("g1-out").value = g1.value));
abs.addEventListener("input", () => (document.getElementById("abs-out").value = abs.value));

function knnPredict(student) {
  const { mean, std, k, rows } = KNN_DATA;
  // scale every feature the same way StandardScaler did
  const z = student.map((v, i) => (v - mean[i]) / std[i]);
  const distances = rows.map((r, idx) => {
    let d = 0;
    for (let i = 0; i < 3; i++) d += ((r[i] - mean[i]) / std[i] - z[i]) ** 2;
    return { d, passed: r[3], idx };
  });
  distances.sort((a, b) => a.d - b.d || a.idx - b.idx);
  const passes = distances.slice(0, k).reduce((sum, n) => sum + n.passed, 0);
  return { passes, k, atRisk: passes <= k / 2 };
}

document.getElementById("checker").addEventListener("submit", e => {
  e.preventDefault();
  const grade = +g1.value, days = +abs.value;
  const fails = +document.querySelector('input[name="failures"]:checked').value;
  const { passes, k, atRisk } = knnPredict([grade, days, fails]);

  const verdict = document.getElementById("verdict");
  const stamp = document.getElementById("verdict-stamp");
  verdict.hidden = false;
  stamp.textContent = atRisk ? "AT RISK" : "ON TRACK";
  stamp.className = "verdict-stamp " + (atRisk ? "risk" : "safe");
  void stamp.offsetWidth;
  stamp.classList.add("pressed");

  document.getElementById("verdict-text").textContent = (atRisk
    ? `Only ${passes} of the ${k} most similar students in my data passed. A teacher should check in with this student now, while there's still time.`
    : `${passes} of the ${k} most similar students in my data passed. No warning sign for now.`)
    + (passes === 5 || passes === 6 ? " This one is a close call: the vote was nearly split." : "");

  const treeRisk = grade <= 10.5;
  document.getElementById("verdict-tree").textContent =
    `Second opinion from the Decision Tree: a term-1 grade of ${grade} is ${treeRisk ? "at or below" : "above"} 10.5, so it says ${treeRisk ? "at risk" : "on track"}` +
    (treeRisk === atRisk ? " too." : ". The two models disagree here: the tree only looks at the grade, while KNN also weighs absences and past failures.");
});
