/* ==========================================================
   QuantumAtom v5 — Arabic Edition
   Offline WebGL Simulation: Real Atomic Orbitals
   ========================================================== */

// عناصر واجهة المستخدم
const glCanvas = document.getElementById("glcanvas");
const fpsEl = document.getElementById("fpsDisplay");
const timeEl = document.getElementById("timeDisplay");
const energyEl = document.getElementById("energyDisplay");
const elName = document.getElementById("elementName");
const elSymbol = document.getElementById("elementSymbol");
const elZ = document.getElementById("elementZ");
const elConfig = document.getElementById("electronConfig");

// متغيرات عامة
let gl, progPoints, progVolumetric, progLines;
let mode = "quantum", running = true;
let eCount = 1, pCount = 1, nCount = 0;
let radius = 2.0, speed = 5.0, opacity = 0.7, pointSize = 6.0;
let orbitLines = false, trackNucleus = false;
let time = 0, fpsAcc = 0, fpsT0 = performance.now();

// =====================================================
//           إعداد WebGL و الكاميرا
// =====================================================
function initGL(){
  gl = glCanvas.getContext("webgl",{antialias:true});
  if(!gl){ alert("WebGL غير مدعوم في هذا المتصفح."); return; }
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0.02,0.03,0.07,1);
  onResize();
  window.addEventListener("resize",onResize);
}

function onResize(){
  const dpr = window.devicePixelRatio||1;
  const w = glCanvas.clientWidth*dpr, h = glCanvas.clientHeight*dpr;
  if(glCanvas.width!==w || glCanvas.height!==h){
    glCanvas.width=w; glCanvas.height=h;
    gl.viewport(0,0,w,h);
  }
}

// ============== الكاميرا والتحكم ==============
const Cam = {
  r: 6, th: 1.0, ph: 1.2,
  target:[0,0,0],
  minR:1, maxR:25
};

function camPos(){
  const {r,th,ph,target}=Cam;
  return [
    target[0]+r*Math.sin(th)*Math.cos(ph),
    target[1]+r*Math.cos(th),
    target[2]+r*Math.sin(th)*Math.sin(ph)
  ];
}

function lookAt(eye,center,up=[0,1,0]){
  let [ex,ey,ez]=eye,[cx,cy,cz]=center;
  let zx=ex-cx,zy=ey-cy,zz=ez-cz;
  const zn=1/Math.hypot(zx,zy,zz);zx*=zn;zy*=zn;zz*=zn;
  let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;
  const xn=1/Math.hypot(xx,xy,xz);xx*=xn;xy*=xn;xz*=xn;
  let yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
  return [xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
          -(xx*ex+xy*ey+xz*ez),
          -(yx*ex+yy*ey+yz*ez),
          -(zx*ex+zy*ey+zz*ez),1];
}

function perspective(fov,asp,n,f){
  const t=1/Math.tan(fov/2), nf=1/(n-f);
  return [
    t/asp,0,0,0,
    0,t,0,0,
    0,0,(f+n)*nf,-1,
    0,0,(2*f*n)*nf,0
  ];
}

// التحكم بالماوس
(function(){
  let dragging=false,lastX=0,lastY=0,isPan=false;
  glCanvas.addEventListener("mousedown",e=>{
    dragging=true; lastX=e.clientX; lastY=e.clientY; isPan=e.shiftKey;
  });
  window.addEventListener("mouseup",()=>dragging=false);
  window.addEventListener("mousemove",e=>{
    if(!dragging)return;
    const dx=(e.clientX-lastX)/glCanvas.clientWidth;
    const dy=(e.clientY-lastY)/glCanvas.clientHeight;
    lastX=e.clientX; lastY=e.clientY;
    if(isPan){
      Cam.target[0]-=dx*Cam.r*0.8;
      Cam.target[1]+=dy*Cam.r*0.8;
    }else{
      Cam.ph-=dx*3;
      Cam.th+=dy*3;
      Cam.th=Math.max(0.1,Math.min(Math.PI-0.1,Cam.th));
    }
  });
  glCanvas.addEventListener("wheel",e=>{
    Cam.r*=1+Math.sign(e.deltaY)*0.1;
    Cam.r=Math.max(Cam.minR,Math.min(Cam.maxR,Cam.r));
    e.preventDefault();
  },{passive:false});
})();

// =====================================================
//   جدول العناصر: الاسم، الرمز، التوزيع الإلكتروني
// =====================================================
// =====================================================
// جدول العناصر حتى Z=118 (يُبنى تلقائيًا)
// =====================================================
// تعريف ترتيب المدارات وقدرتها على استيعاب الإلكترونات
const orbitalOrder = [
  "1s","2s","2p","3s","3p","4s","3d","4p","5s","4d","5p","6s",
  "4f","5d","6p","7s","5f","6d","7p"
];
const orbitalCapacity = {"s":2,"p":6,"d":10,"f":14};

const elementBase = [
  ["H","الهيدروجين"],["He","الهيليوم"],["Li","الليثيوم"],["Be","البيريليوم"],["B","البورون"],
  ["C","الكربون"],["N","النيتروجين"],["O","الأوكسجين"],["F","الفلور"],["Ne","النيون"],
  ["Na","الصوديوم"],["Mg","المغنيسيوم"],["Al","الألومنيوم"],["Si","السليكون"],["P","الفسفور"],
  ["S","الكبريت"],["Cl","الكلور"],["Ar","الأرجون"],["K","البوتاسيوم"],["Ca","الكالسيوم"]
];

// توليد العناصر حتى 118 أوتوماتيكيًا:
const elements = {};
for(let i=1;i<=118;i++){
  const base = elementBase[i-1] || [`E${i}`,"عنصر رقم "+i];
  elements[i] = {
    sym: base[0],
    name: base[1],
    config: buildElectronConfig(i)
  };
}


// =====================================================
//   تحميل عنصر جديد وبناء توزيعه
// =====================================================
function loadElement(Z){
  // تعيين عدد البروتونات/الإلكترونات/النيوترونات
  pCount = Z;
  eCount = Z;
  nCount = Math.round(Z * 1.1); // تقريب بسيط

  const el = elements[Z] || {sym:"?",name:"عنصر غير معروف",config:""};
  elSymbol.textContent = el.sym;
  elName.textContent = el.name;
  elZ.textContent = Z;
  elConfig.textContent = el.config || buildElectronConfig(Z);

  // بناء النواة والإلكترونات
  buildNucleus();
  buildElectronOrbitals(Z);
  if(mode==="quantum") generateQuantumCloud();
  else generateClassical();
}

// =====================================================
//   بناء التوزيع الإلكتروني تلقائيًا (حتى 118)
// =====================================================

function buildElectronConfig(Z){
  // ترتيب ملء المدارات الصحيح حتى Z=118
  const order = [
    "1s","2s","2p","3s","3p","4s","3d","4p",
    "5s","4d","5p","6s","4f","5d","6p","7s","5f","6d","7p"
  ];
  const cap = {s:2,p:6,d:10,f:14};

  let rem = Z;
  const conf = [];
  for(const o of order){
    const ltr = o.slice(-1);
    const take = Math.min(rem, cap[ltr]);
    conf.push(`${o}${take}`);
    rem -= take;
    if(rem <= 0) break;
  }
  return conf.join(" ");
}

// =====================================================
// الجزء الثاني — الفيزياء: النواة + الإلكترونات
// =====================================================

// توزيع عشوائي بسيط غاوسي
function randn(){
  let u=0,v=0;while(u===0)u=Math.random();while(v===0)v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}

// =====================================================
//   بناء النواة (بروتونات + نيوترونات)
// =====================================================
let nucleusParticles = [];

function buildNucleus(){
  nucleusParticles = [];
  const layers = Math.ceil(Math.cbrt(pCount + nCount) / 2);
  let i=0;
  for(let x=-layers;x<=layers;x++){
    for(let y=-layers;y<=layers;y++){
      for(let z=-layers;z<=layers;z++){
        if(i<pCount+nCount){
          const pos = [0.08*x+0.01*randn(),0.08*y+0.01*randn(),0.08*z+0.01*randn()];
          const isP = i<pCount;
          const col = isP ? [1.0,0.1,0.1] : [0.2,0.8,1.0]; // 🔴 بروتون - 🔵 نيوترون
          nucleusParticles.push({pos,col});
          i++;
        }
      }
    }
  }
}


// =====================================================
//   بناء المدارات الإلكترونية الكلاسيكية
// =====================================================
let classicalElectrons = [];

function buildElectronOrbitals(Z){
  classicalElectrons = [];
  const config = buildElectronConfig(Z).split(" ");
  const orbitals = [];

  for(const part of config){
    const n = +part[0];
    const ltr = part[1];
    const count = parseInt(part.slice(2)) || 1;
    orbitals.push({n,ltr,count});
  }

  for(const orb of orbitals){
    const {n,count} = orb;
    const r = n * 0.6; // نصف القطر النسبي لكل غلاف
    for(let i=0;i<count;i++){
      const phi = (i/count)*2*Math.PI; // توزيع الزوايا بالتساوي
      const theta = Math.PI/2;         // المدار أفقي مبدئيًا
      const omega = 0.5 + Math.random(); // سرعة زاوية
      classicalElectrons.push({
        r, theta, phi, omega,
        n, pos:[
          r*Math.cos(phi),
          (n-1)*0.3, // إزاحة بسيطة لكل غلاف
          r*Math.sin(phi)
        ],
        col:[0.2,0.7,1.0]
      });
    }
  }
  eCount = classicalElectrons.length;
}




// =====================================================
//   فيزياء الوضع الكلاسيكي
// =====================================================
function generateClassical(){
  for(let e of classicalElectrons){
    const r=e.r,th=e.theta,ph=e.phi;
    e.phi += 0; // يبدأ ساكن حتى يبدأ الزمن
    e.pos=[
      r*Math.sin(th)*Math.cos(ph),
      r*Math.cos(th),
      r*Math.sin(th)*Math.sin(ph)
    ];
  }
}

// =====================================================
//   فيزياء الوضع الكمي — توليد السحابة
// =====================================================
let quantumCloud = [];

function generateQuantumCloud(){
  quantumCloud=[];
  const total = eCount;
  const N = 15000 + total*1000;
  for(let i=0;i<N;i++){
    // توزيع احتمالي تقريبي
    const r = radius * Math.pow(Math.random(),0.7);
    const theta = Math.acos(1-2*Math.random());
    const phi = Math.random()*2*Math.PI;

    // كثافة احتمالية تقريبية ~ e^{-2r} * sin²(theta)
    const val = Math.exp(-2*r) * Math.pow(Math.sin(theta),2);

    quantumCloud.push({
      pos:[r*Math.sin(theta)*Math.cos(phi),
           r*Math.cos(theta),
           r*Math.sin(theta)*Math.sin(phi)],
      val
    });
  }
}

// =====================================================
//   تحديث المواقع عبر الزمن
// =====================================================
function updatePhysics(dt){
  if(mode==="classical"){
    for(let e of classicalElectrons){
      e.phi += e.omega * dt * speed;
      const {r,theta,phi,n} = e;
      e.pos = [
        r*Math.sin(theta)*Math.cos(phi),
        (n-1)*0.3,
        r*Math.sin(theta)*Math.sin(phi)
      ];
    }
  } else {
    for(let q of quantumCloud){
      q.phase = Math.sin(time*0.6 + q.pos[0]*0.3 + q.pos[1]*0.3);
    }
  }
}



// =====================================================
// الجزء الثالث — التصيير (الرسم): Shaders + Render
// =====================================================

// أداة إنشاء Shader
function makeShader(type,src){
  const s = gl.createShader(type);
  gl.shaderSource(s,src);
  gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
    console.error("Shader error:", gl.getShaderInfoLog(s));
  }
  return s;
}

// أداة إنشاء برنامج
function makeProgram(vsSrc,fsSrc){
  const vs = makeShader(gl.VERTEX_SHADER,vsSrc);
  const fs = makeShader(gl.FRAGMENT_SHADER,fsSrc);
  const p = gl.createProgram();
  gl.attachShader(p,vs);
  gl.attachShader(p,fs);
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))
    console.error("Program link error:", gl.getProgramInfoLog(p));
  return p;
}

// =====================================================
//  Shader للنواة والإلكترونات (نقطي كروي مضيء)
// =====================================================
function createPointShader(){
  const vs = `
    attribute vec3 aPos;
    uniform mat4 uP, uV;
    uniform float uSize;
    void main(){
      gl_Position = uP * uV * vec4(aPos,1.0);
      gl_PointSize = uSize;
    }
  `;
   const fs = `
  precision mediump float;
  uniform vec3 uColor;

  void main(){
    // المسافة من مركز النقطة (0.5,0.5)
    float d = length(gl_PointCoord - vec2(0.5));

    // شكل دائري: احذف أي شيء خارج نصف القطر
    if (d > 0.5) discard;

    // حافة ناعمة + توهج داخلي
    float edge = smoothstep(0.5, 0.35, 0.5 - d);
    float glow = 1.0 - pow(d * 2.0, 2.0);

    // لون دائري مضيء مع تدرج خفيف
    vec3 color = mix(uColor * 0.7, vec3(1.0,1.0,1.0), glow * 0.4);

    // شدة الإضاءة
    float intensity = glow * edge;

    gl_FragColor = vec4(color * intensity * 1.3, intensity);
  }
`;

  progPoints = makeProgram(vs,fs);
}

// =====================================================
//  Shader للسحابة الكمية (Volumetric Shader)
// =====================================================
function createVolumetricShader(){
  const vs = `
    attribute vec3 aPos;
    uniform mat4 uP, uV;
    varying float vR;
    void main(){
      gl_Position = uP * uV * vec4(aPos,1.0);
      gl_PointSize = 5.0;
      vR = length(aPos);
    }
  `;
  const fs = `
    precision mediump float;
    varying float vR;
    uniform float uTime;
    uniform float uOpacity;
    void main(){
      float d = length(gl_PointCoord - vec2(0.5));
      float density = exp(-6.0 * d*d);
      float glow = 0.6 + 0.4*sin(uTime*0.8 + vR*3.0);
      vec3 inner = vec3(0.25,0.5,1.0);
      vec3 outer = vec3(0.9,0.3,1.0);
      vec3 color = mix(inner, outer, glow);
      float alpha = smoothstep(0.45, 0.25, 0.5 - d);
      float intensity = density * alpha;
      gl_FragColor = vec4(color * intensity * 1.4, intensity * uOpacity);
    }
  `;
  progVolumetric = makeProgram(vs,fs);
}

// =====================================================
// Shader لخطوط المدار
// =====================================================
function createLineShader(){
  const vs = `
    attribute vec3 aPos;
    uniform mat4 uP, uV;
    void main(){
      gl_Position = uP * uV * vec4(aPos,1.0);
    }
  `;
  const fs = `
    precision mediump float;
    uniform vec3 uColor;
    void main(){
      gl_FragColor = vec4(uColor,0.4);
    }
  `;
  progLines = makeProgram(vs, fs);

  bufPoints = gl.createBuffer();
  bufColors = gl.createBuffer();
  bufLines = gl.createBuffer();
}


// =====================================================
//  تهيئة كل البرامج والـ Buffers
// =====================================================
let bufPoints, bufLines;
function initPrograms(){
  createPointShader();
  createVolumetricShader();
    createNucleusCloudShader();
  createLineShader();


  bufPoints = gl.createBuffer();
  bufLines = gl.createBuffer();
}

// =====================================================
//  رسم النواة والإلكترونات
// =====================================================
function drawPoints(objects,sizeMul=1.0){
  gl.useProgram(progPoints);
  const uP = gl.getUniformLocation(progPoints,"uP");
  const uV = gl.getUniformLocation(progPoints,"uV");
  const uC = gl.getUniformLocation(progPoints,"uColor");
  const uS = gl.getUniformLocation(progPoints,"uSize");
  gl.uniformMatrix4fv(uP,false,matP);
  gl.uniformMatrix4fv(uV,false,matV);
  for(let o of objects){
    const pos = new Float32Array(o.pos);
    const col = o.col || [1,1,1];
    gl.uniform3fv(uC,col);
    gl.uniform1f(uS, pointSize * sizeMul);
    gl.vertexAttrib3fv(0,pos);
    gl.drawArrays(gl.POINTS,0,1);
  }
}

// =====================================================
//  رسم السحابة الكمّية (volumetric cloud)
// =====================================================
function drawQuantumCloud(){
  if(quantumCloud.length===0) return;
  gl.useProgram(progVolumetric);
  const uP = gl.getUniformLocation(progVolumetric,"uP");
  const uV = gl.getUniformLocation(progVolumetric,"uV");
  const uT = gl.getUniformLocation(progVolumetric,"uTime");
  const uO = gl.getUniformLocation(progVolumetric,"uOpacity");
  gl.uniformMatrix4fv(uP,false,matP);
  gl.uniformMatrix4fv(uV,false,matV);
  gl.uniform1f(uT,time);
  gl.uniform1f(uO,opacity);
  const attrib = gl.getAttribLocation(progVolumetric,"aPos");

  const arr=[];
  for(let q of quantumCloud){ arr.push(...q.pos); }
  gl.bindBuffer(gl.ARRAY_BUFFER,bufPoints);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.STREAM_DRAW);
  gl.enableVertexAttribArray(attrib);
  gl.vertexAttribPointer(attrib,3,gl.FLOAT,false,0,0);
  gl.drawArrays(gl.POINTS,0,quantumCloud.length);
}

// =====================================================
//  رسم خطوط المدار الكلاسيكية
// =====================================================
function drawOrbitLines(){
  if(!orbitLines || mode!=="classical") return;
  gl.useProgram(progLines);
  const uP = gl.getUniformLocation(progLines,"uP");
  const uV = gl.getUniformLocation(progLines,"uV");
  const uC = gl.getUniformLocation(progLines,"uColor");
  gl.uniformMatrix4fv(uP,false,matP);
  gl.uniformMatrix4fv(uV,false,matV);

  const N = 64;
  for(let e of classicalElectrons){
    const pts=[];
    const r=e.r;
    for(let i=0;i<=N;i++){
      const a=(i/N)*2*Math.PI;
      pts.push(r*Math.cos(a),0,r*Math.sin(a));
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,bufLines);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pts),gl.STREAM_DRAW);
    const attrib = gl.getAttribLocation(progLines,"aPos");
    gl.enableVertexAttribArray(attrib);
    gl.vertexAttribPointer(attrib,3,gl.FLOAT,false,0,0);
    gl.uniform3fv(uC,[0.4,0.6,1.0]);
    gl.drawArrays(gl.LINE_STRIP,0,pts.length/3);
  }
}

// =====================================================
//  رسم المشهد الكامل
// =====================================================
let matP=[], matV=[];
function setupView(){
  const asp = glCanvas.width/glCanvas.height;
  matP = perspective(45*Math.PI/180, asp, 0.1, 100.0);
  const eye = camPos();
  matV = lookAt(eye,Cam.target);
}
function drawScene(){
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  setupView();

  // نواة (دائمًا مرئية)
  drawPoints(nucleusParticles, 2.2);

  // إلكترونات
  drawPoints(classicalElectrons, 1.6);

  // خطوط المدار في الوضع الكلاسيكي فقط
  if(mode === "classical") drawOrbitLines();

  // سحابة كمّية شفافة فوقهم
  if(mode === "quantum") drawQuantumCloud();
}

// =====================================================
// الجزء الرابع — حلقة الزمن + الأحداث + الواجهة
// =====================================================

// حساب الطاقة التقريبية (نموذج بور)
function computeEnergy(){
  const E = -13.6 * (pCount*pCount) / (radius*radius);
  energyEl.textContent = `E = ${E.toFixed(2)} eV`;
}

// حلقة التحديث والرسم
function loop(now){
  const dt = 0.016;
  if(running) time += dt;
  updatePhysics(dt);
  computeEnergy();
  drawScene();

  // تحديث FPS
  fpsAcc++;
  if(now - fpsT0 > 500){
    const fps = (fpsAcc*1000)/(now - fpsT0);
    fpsEl.textContent = `FPS: ${fps.toFixed(0)}`;
    fpsT0 = now; fpsAcc = 0;
  }

  timeEl.textContent = `t = ${time.toFixed(1)} s`;

  requestAnimationFrame(loop);
}

// =====================================================
// الأحداث (الواجهة)
// =====================================================

document.getElementById("mode").onchange = e => {
  mode = e.target.value;
  if(mode==="quantum") generateQuantumCloud();
  else generateClassical();
};

document.getElementById("radius").oninput = e => {
  radius = +e.target.value;
  if(mode==="quantum") generateQuantumCloud();
  else buildElectronOrbitals(pCount);
};

document.getElementById("speed").oninput = e => { speed = +e.target.value; };
document.getElementById("opacity").oninput = e => { opacity = +e.target.value; };
document.getElementById("size").oninput = e => { pointSize = +e.target.value; };
document.getElementById("orbitLines").onchange = e => { orbitLines = e.target.checked; };
document.getElementById("trackNucleus").onchange = e => { trackNucleus = e.target.checked; };
document.getElementById("toggleRun").onclick = () => { running = !running; };

document.getElementById("themeToggle").onclick = () => {
  document.body.classList.toggle("theme-light");
  document.body.classList.toggle("theme-dark");
};

// تحميل عنصر جديد عند الضغط على الزر
document.getElementById("loadElement").onclick = () => {
  const Z = parseInt(document.getElementById("Zinput").value);
  if(Z>=1 && Z<=118) loadElement(Z);
};

// =====================================================
// بدء المحاكي
// =====================================================
function startSimulator(){
  initGL();        // أولاً تهيئة WebGL
  initPrograms();  // ثم إنشاء الـ shaders
  loadElement(6);
  requestAnimationFrame(loop);
}


startSimulator();
