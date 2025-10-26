// ================= Unified Coordinator (No-Overlay) =================
const q = s => document.querySelector(s);
const tabs = [...document.querySelectorAll('.u-tab')];
const frames = {
  gr:   q('#frame-gr'),
  qm:   q('#frame-qm'),
  slit: q('#frame-slit')
};
// حدّث المسارات حسب ملفاتك
const SIMS = {
  gr:   'gr.html',       // GR
  qm:   'quantum.html',  // Quantum
  slit: 'main.html'      // Double-Slit
};
const themeBtn = q('#themeToggle');
const fpsEl = q('#fps');

let current = localStorage.getItem('unified.sim') || 'gr';
let lastT = performance.now(), fpsAcc=0, fpsCount=0, fpsShownAt=0;

// ---- إسناد المصادر مرّة واحدة عند البدء (بدون أي طبقة تحميل) ----
Object.entries(frames).forEach(([k,ifr])=>{
  const want = SIMS[k];
  if (ifr.getAttribute('src') !== want) ifr.setAttribute('src', want);
});

// ---- إظهار/إخفاء الإطارات ----
function show(sim){
  current = sim;
  localStorage.setItem('unified.sim', sim);
  tabs.forEach(b => b.classList.toggle('is-active', b.dataset.sim===sim));
  Object.entries(frames).forEach(([k,ifr])=>{
    ifr.classList.toggle('is-visible', k===sim);
  });
  applyThemeToFrame(frames[sim]); // حاول مزامنة الثيم داخل الإطار الظاهر
}

tabs.forEach(b => b.addEventListener('click', ()=>show(b.dataset.sim)));
show(current);

// ---- Theme toggle (الصفحة + داخل الإطارات إن أمكن) ----
function toggleTheme(){
  const body = document.body;
  const light = body.classList.toggle('theme-light');
  if(!light) body.classList.add('theme-dark'); else body.classList.remove('theme-dark');
  Object.values(frames).forEach(applyThemeToFrame);
}
themeBtn.addEventListener('click', toggleTheme);

function applyThemeToFrame(ifr){
  try{
    const doc = ifr.contentDocument || ifr.contentWindow?.document;
    if(!doc) return;
    const b = doc.body; if(!b) return;
    const isLight = document.body.classList.contains('theme-light');
    b.classList.toggle('theme-light', isLight);
    b.classList.toggle('theme-dark', !isLight);
  }catch(_e){ /* تجاهل في حال منع المتصفح الوصول المحلي */ }
}

// ---- FPS بسيط من المنسّق ----
function loop(now){
  const dt = (now - lastT) / 1000; lastT = now;
  const inst = 1/Math.max(1e-6, dt);
  fpsAcc += inst; fpsCount++;
  if(now - fpsShownAt > 400){
    fpsEl.textContent = (fpsAcc / fpsCount).toFixed(0);
    fpsShownAt = now; fpsAcc = 0; fpsCount = 0;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---- اختصارات: Ctrl+1/2/3 ----
window.addEventListener('keydown', (e)=>{
  if(e.ctrlKey){
    if(e.key==='1') show('gr');
    if(e.key==='2') show('qm');
    if(e.key==='3') show('slit');
  }
});
