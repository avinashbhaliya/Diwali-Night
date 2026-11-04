const stage=document.querySelector('#stage'),canvas=document.querySelector('#fx'),ctx=canvas.getContext('2d');
const pt=document.querySelector('#pt'),pc=pt?pt.getContext('2d'):null;
let W,H,dpr,mob=false,particles=[],effects=[],flashes=[],sound=true,audio,showTimers=[];
const R=(a,b)=>a+Math.random()*(b-a),gold=['#fff8db','#ffdf93','#ffb64d','#ffe8b4'],palettes=[['#fda7c8','#ff548a'],['#b5d8ff','#6e9aff'],['#d2bbff','#a87cff'],['#ffe7ac','#ffb851'],['#b7ffe5','#57dba3']];
const $=s=>document.querySelector(s);

function resize(){
  const b=stage.getBoundingClientRect();
  W=b.width;H=b.height;
  dpr=Math.min(devicePixelRatio||1,2);
  mob=W<700;
  for(const c of [canvas,pt]){
    if(c){c.width=W*dpr;c.height=H*dpr;}
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(pc)pc.setTransform(dpr,0,0,dpr,0,0);
}
new ResizeObserver(resize).observe(stage);resize();

let master,noiseBuffer,queue=[],clock=0,audioUntil=0;const sprites=new Map();

const toastMessages={
  sparkler:["Haath dur rakhjo!","Aa to chhota dhamako che"],
  fountain:["Dur ubha raho, anar aave che!","Kaka ni dukan jevo sparkle"],
  spinner:["Chakri ne chakkar aave che","Gol gol Rani"],
  rocket:["3, 2, 1... ISRO ne jaan kari do","Upar jaay che, pachho nahi aave"],
  firework:["Padosi jaagi gaya!","Aa to full dhamal"],
  all:["Hve to Diwali puri!","Kaan ma ruu nakho"],
  soundOn:["Fari dhamako chaalu"],
  soundOff:["Shanti no maahol"]
};
let toastTimer=null;
function triggerToast(kind){
  const el=document.querySelector('.status');
  const list=toastMessages[kind];
  if(!el||!list||!list.length)return;
  if(toastTimer){clearTimeout(toastTimer);toastTimer=null}
  el.textContent=list[Math.floor(Math.random()*list.length)];
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  toastTimer=setTimeout(()=>{el.classList.remove('show');toastTimer=null},2000);
}

function introToast(m){
  const el=document.querySelector('.status');
  if(!el)return;
  if(toastTimer){clearTimeout(toastTimer);toastTimer=null}
  el.textContent=m;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  toastTimer=setTimeout(()=>{el.classList.remove('show');toastTimer=null},2000);
}

async function unlockAudio(){
  try{
    audio=audio||new(window.AudioContext||window.webkitAudioContext)();
    if(!master){
      master=audio.createGain();
      master.gain.value=sound?.8:0;
      const limiter=audio.createDynamicsCompressor();
      limiter.threshold.value=-12;
      limiter.ratio.value=5;
      master.connect(limiter);
      limiter.connect(audio.destination);
      noiseBuffer=audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate);
      const data=noiseBuffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    }
    if(audio.state!=='running')await audio.resume();
  }catch(error){
    document.querySelector('.status').textContent='Aa browser ma aawaj nathi aavto, bhai!';
  }
}

// Audio unlock on first pointerdown or keydown
const audioUnlockOnce = async () => {
  window.removeEventListener('pointerdown', audioUnlockOnce);
  window.removeEventListener('keydown', audioUnlockOnce);
  await unlockAudio();
};
window.addEventListener('pointerdown', audioUnlockOnce, { passive: true });
window.addEventListener('keydown', audioUnlockOnce, { passive: true });

function noise(duration=.5,frequency=1100,volume=.12,type='hiss'){
  if(!sound||!audio||audio.state!=='running'||!master)return;
  const t=audio.currentTime,src=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();
  src.buffer=noiseBuffer;src.loop=true;
  filter.type=type==='boom'?'lowpass':'bandpass';
  filter.frequency.setValueAtTime(frequency,t);
  filter.Q.value=type==='whistle'?4:.7;
  gain.gain.setValueAtTime(.001,t);
  gain.gain.exponentialRampToValueAtTime(volume,t+.015);
  if(type==='hiss'){for(let i=1;i<duration*12;i++)gain.gain.linearRampToValueAtTime(volume*(.65+Math.random()*.35),t+i/12)}
  gain.gain.exponentialRampToValueAtTime(.001,t+duration);
  src.connect(filter);filter.connect(gain);gain.connect(master);
  src.start(t);src.stop(t+duration+.03);
  src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect()};
  audioUntil=Math.max(audioUntil,clock+duration*60);
}

function tone(startHz,endHz,duration,volume,wave='sine'){
  if(!sound||!audio||audio.state!=='running')return;
  const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();
  o.type=wave;
  o.frequency.setValueAtTime(startHz,t);
  o.frequency.exponentialRampToValueAtTime(endHz,t+duration);
  g.gain.setValueAtTime(.001,t);
  g.gain.exponentialRampToValueAtTime(volume,t+.015);
  g.gain.exponentialRampToValueAtTime(.001,t+duration);
  o.connect(g);g.connect(master);
  o.start(t);o.stop(t+duration+.02);
  o.onended=()=>{o.disconnect();g.disconnect()};
  audioUntil=Math.max(audioUntil,clock+duration*60);
}

function soundEffect(kind){
  if(kind==='sparkler'){noise(3.2,5200,.22);noise(3.1,2300,.08)}
  if(kind==='fountain'){noise(3.5,1800,.36);noise(3.4,4200,.13)}
  if(kind==='spinner'){noise(3.2,2900,.28);tone(540,1300,3.1,.035,'triangle')}
  if(kind==='rocket'||kind==='shell'){noise(1.5,1800,.18);tone(420,1700,1.45,.065)}
  if(kind==='burst'){noise(.13,4800,.5,'boom');noise(1.5,600,.6,'boom');tone(130,35,.7,.4);noise(.9,3200,.12)}
}

function schedule(kind,delay=0,offset=0){queue.push({kind,due:clock+delay,offset});stage.classList.add('active')}
function syncStage(){stage.classList.toggle('active',Boolean(effects.length||particles.length||flashes.length||queue.length||P.length||RK.length||(sound&&clock<audioUntil)))}

function sprite(color){
  if(sprites.has(color))return sprites.get(color);
  let c=document.createElement('canvas');c.width=c.height=24;
  let g=c.getContext('2d'),rad=g.createRadialGradient(12,12,0,12,12,12);
  rad.addColorStop(0,'#fff9e5');rad.addColorStop(.15,color);rad.addColorStop(1,'transparent');
  g.fillStyle=rad;g.fillRect(0,0,24,24);sprites.set(color,c);return c;
}

function particle(x,y,vx,vy,color,life=65,size=1.4,gravity=.045){
  if(particles.length>2200)return;
  particles.push({x,y,px:x,py:y,vx,vy,color,life,max:life,size,gravity});
}

function burst(x,y){
  const pal=palettes[Math.floor(R(0,palettes.length))],scale=Math.min(1,W/650,H/550);
  flashes.push({x,y,life:12,max:12,color:pal[0]});
  for(let i=0;i<180;i++){
    let a=i*Math.PI*2/180+R(-.025,.025),speed=R(4.5,8.0)*scale;
    particle(x,y,Math.cos(a)*speed,Math.sin(a)*speed,pal[i%2],R(85,135),R(.8,1.8),.025);
  }
  for(let i=0;i<60;i++){
    let a=R(0,Math.PI*2),v=R(.3,3)*scale;
    particle(x,y,Math.cos(a)*v,Math.sin(a)*v,gold[i%4],R(40,90),R(.7,1.5),.025);
  }
  soundEffect('burst');
}

function projectile(kind,offset=0){
  effects.push({kind,x:W*.5+offset,y:H-38,start:H-38,t:0,d:90,target:H*R(.2,.35),drift:R(-.25,.25)});
  soundEffect(kind);
}

function launch(kind){
  stage.classList.add('active');const x=W/2,y=H-55;
  if(kind==='sparkler'){effects.push({kind,x,y:y-105,t:0,d:190});soundEffect(kind)}
  if(kind==='fountain'){effects.push({kind,x,y,t:0,d:210});soundEffect(kind)}
  if(kind==='spinner'){effects.push({kind,x,y,t:0,d:190});soundEffect(kind)}
  if(kind==='rocket')projectile('rocket');
  if(kind==='firework'){projectile('shell',-Math.min(120,W*.18));schedule('shell',39,Math.min(120,W*.18));schedule('shell',78,0)}
}

document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=async()=>{await unlockAudio();triggerToast(b.dataset.kind);launch(b.dataset.kind)});
document.querySelector('#all').onclick=async()=>{await unlockAudio();triggerToast('all');queue=[];['sparkler','fountain','spinner','rocket','firework'].forEach((kind,i)=>schedule(kind,i*145))};
document.querySelector('#sound').onclick=async e=>{
  const b=e.currentTarget;sound=!sound;
  b.querySelector('.sound-label').textContent=sound?'Dhamako ON':'Dhamako OFF';
  b.setAttribute('aria-checked',String(sound));
  triggerToast(sound?'soundOn':'soundOff');
  await unlockAudio();
  if(master)master.gain.setTargetAtTime(sound?.8:0,audio.currentTime,.025);
  if(sound){for(const e of effects)if(!e.done)soundEffect(e.kind)}else audioUntil=clock;
  syncStage();
};

function glow(x,y,r,color){
  let g=ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,color);g.addColorStop(1,'transparent');
  ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
}

function effect(e,dt){
  e.t+=dt;const strength=Math.min(1,e.t/12,(e.d-e.t)/20);
  if(e.kind==='sparkler'){
    let x=e.x+Math.sin(e.t*.025)*18,y=e.y+Math.cos(e.t*.035)*6;
    ctx.lineCap='round';ctx.strokeStyle='#756b60';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-38,y+132);ctx.lineTo(x,y);ctx.stroke();
    ctx.strokeStyle='#cfbaa0';ctx.lineWidth=1;ctx.stroke();glow(x,y,65,'#ffb34835');ctx.fillStyle='#fff9e4';ctx.beginPath();ctx.arc(x,y,4,0,7);ctx.fill();
    for(let j=0;j<16*strength*dt;j++){const a=R(0,Math.PI*2),v=R(1.5,7);particle(x,y,Math.cos(a)*v,Math.sin(a)*v,gold[j%4],R(12,35),R(.5,1.5),.06)}
  }
  if(e.kind==='fountain'){
    let x=e.x,y=e.y;glow(x,y-30,120,'#ffae3322');ctx.save();ctx.translate(x,y);
    const g=ctx.createLinearGradient(-28,0,28,0);g.addColorStop(0,'#73351f');g.addColorStop(.45,'#de9053');g.addColorStop(1,'#85452c');
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-13,-22);ctx.bezierCurveTo(-42,-12,-35,19,-22,21);ctx.lineTo(22,21);ctx.bezierCurveTo(35,19,42,-12,13,-22);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#e9b373';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,-21,14,4,0,0,7);ctx.stroke();
    ctx.strokeStyle='#f2c47a';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,8,30,6,0,0,Math.PI);ctx.stroke();ctx.restore();
    for(let j=0;j<15*strength*dt;j++){const a=R(-.32,.32),v=R(4,12)*Math.min(1,H/450);particle(x+R(-5,5),y-23,Math.sin(a)*v,-Math.cos(a)*v,gold[j%4],R(40,75),R(.6,1.7),.105)}
  }
  if(e.kind==='spinner'){
    let x=e.x+Math.sin(e.t*.08)*5,y=e.y;glow(x,y,95,'#ffa23525');ctx.save();ctx.translate(x,y);ctx.scale(1,.4);
    ctx.fillStyle='#773c2c';ctx.beginPath();ctx.arc(0,0,31,0,7);ctx.fill();
    for(let r=8;r<31;r+=5){ctx.strokeStyle=r%2?'#c66a39':'#e8b870';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.stroke()}
    ctx.fillStyle='#f9d38a';ctx.beginPath();ctx.arc(0,0,5,0,7);ctx.fill();ctx.restore();
    for(let j=0;j<15*strength*dt;j++){const a=e.t*.46+R(-.15,.15),vx=-Math.sin(a)*R(5,10),vy=Math.cos(a)*R(1,3);particle(x+Math.cos(a)*28,y+Math.sin(a)*11,vx,vy-R(.2,2),gold[j%4],R(20,43),R(.6,1.7),.055)}
  }
  if(e.kind==='rocket'||e.kind==='shell'){
    let t=Math.min(1,e.t/e.d);e.y=e.start+(e.target-e.start)*(1-Math.pow(1-t,1.55));e.x+=e.drift*dt;
    glow(e.x,e.y+15,32,'#ffb63535');
    for(let j=0;j<4*dt;j++)particle(e.x+R(-2,2),e.y+15,R(-.8,.8),R(1,3),gold[j%4],R(20,40),R(.6,1.8),.03);
    ctx.save();ctx.translate(e.x,e.y);
    if(e.kind==='rocket'){
      ctx.fillStyle='#f7c36e';ctx.fillRect(-6,-11,12,25);ctx.fillStyle='#c84b56';ctx.beginPath();ctx.moveTo(0,-24);ctx.lineTo(-8,-10);ctx.lineTo(8,-10);ctx.closePath();ctx.fill();
      ctx.fillRect(-6,-5,12,4);ctx.strokeStyle='#aa8f6f';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(1,14);ctx.lineTo(1,49);ctx.stroke();
    }else{
      ctx.fillStyle='#fff3cb';ctx.beginPath();ctx.arc(0,0,4,0,7);ctx.fill();
    }
    ctx.restore();
    if(e.t>=e.d&&!e.done){e.done=true;burst(e.x,e.y)}
  }
}

// ========================================================
// SAMPLE-BASED OPENING SEQUENCE, PETALS, TEXT & SHARE BAR
// ========================================================

/* names */
const clean=s=>(s||'').replace(/\s+/g,' ').trim().replace(/[^\p{L}\p{M}\p{N} .,'-]/gu,'').slice(0,20).trim();
let name=clean(new URLSearchParams(location.search).get('from'));
const lines=()=>[(name||'Mara')+' taraf thi','Happy Diwali','Mara Kaleja'];
const setGreet=()=>{
  const g1=$('#g1');if(g1)g1.textContent=lines()[0];
  document.title=lines()[0]+' Happy Diwali';
};

/* particles & rockets from sample */
let P=[],RK=[],T=null,run=0;
const hsl=h=>`hsl(${h},100%,62%)`;
function sp(x,y,a,s,c,life,g,sz){P.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,c,life,max:life,g,sz,m:0})}
function sampleBurst(x,y,h){
  if(sound&&audio&&audio.state==='running')soundEffect('burst');
  const n=mob?70:100;
  for(let i=0;i<n;i++)sp(x,y,R(0,6.283),R(40,230)*Math.sqrt(Math.random()),hsl(h+R(-15,15)),R(1,1.9),90,R(1.2,2.2));
}
function sampleRocket(x,ty,h,cb){
  if(sound&&audio&&audio.state==='running')soundEffect('rocket');
  let y=H-90;const vy=-R(560,680);
  RK.push(dt=>{
    y+=vy*dt;
    for(let i=0;i<2;i++)sp(x+R(-1,1),y,1.57+R(-.4,.4),R(10,40),'hsl(38,100%,65%)',R(.25,.5),0,1.4);
    if(y<=ty){cb?cb(x,y):sampleBurst(x,y,h);return false}
    return true;
  });
  syncStage();
}

function textBurst(bx,by){
  const L=lines(),cols=['#ffc23d','#fff4de','#ff6aa8'],oc=document.createElement('canvas');
  oc.width=W;oc.height=H;const o=oc.getContext('2d');o.textAlign='center';o.textBaseline='middle';
  let fs=Math.min(W/9,96);const set=()=>o.font=`800 ${fs}px "Baloo 2",system-ui,sans-serif`;set();
  const mw=Math.max(...L.map(t=>o.measureText(t).width));if(mw>W*.85){fs*=W*.85/mw;set()}
  const cy=H*.42,gap=fs*1.2;L.forEach((t,i)=>{o.fillStyle=cols[i];o.fillText(t,W/2,cy+(i-1)*gap)});
  const d=o.getImageData(0,0,W,H).data;let step=mob?6:4,pts;
  for(;;){
    pts=[];
    for(let y=0;y<H;y+=step)for(let x=0;x<W;x+=step){
      const k=(y*W+x)*4;if(d[k+3]>128)pts.push([x,y,d[k],d[k+1],d[k+2]]);
    }
    if(pts.length<=1800)break;step++;
  }
  pts.forEach(([x,y,r,g,b])=>{
    const a=R(0,6.283),s=R(60,260);
    P.push({x:bx,y:by,vx:Math.cos(a)*s,vy:Math.sin(a)*s,tx:x,ty:y,c:`rgb(${r},${g},${b})`,life:99,max:99,g:0,sz:R(1.3,2.1),m:1,ph:R(0,6.283)});
  });
  T=performance.now()/1000;
  syncStage();
}

/* petals from sample */
let pet=[],pOn=false,p0=0;
function petals(){
  const n=mob?60:120,cs=['#ff9a1f','#ffb020','#ffd23f','#ff7a00','#ff6aa8'];
  pet=[];
  for(let i=0;i<n;i++)pet.push({t:R(0,5),x:R(0,W),y:-20,vy:R(50,110),sw:R(20,50),ph:R(0,6.283),f:R(.8,1.6),rot:R(0,6.283),vr:R(-1.5,1.5),s:R(5,11),c:cs[(Math.random()*cs.length)|0]});
  p0=performance.now()/1000;pOn=true;
}
function petalFrame(dt){
  if(!pc)return;
  const e=performance.now()/1000-p0;pc.clearRect(0,0,W,H);let alive=false;
  for(const p of pet){
    if(e<p.t){alive=true;continue}
    if(p.y>H+20)continue;
    alive=true;p.y+=p.vy*dt;p.rot+=p.vr*dt;
    pc.save();pc.translate(p.x+Math.sin(e*p.f+p.ph)*p.sw,p.y);pc.rotate(p.rot);pc.fillStyle=p.c;const s=p.s;
    pc.beginPath();pc.moveTo(0,-s);pc.bezierCurveTo(s*.9,-s*.4,s*.7,s*.8,0,s);pc.bezierCurveTo(-s*.7,s*.8,-s*.9,-s*.4,0,-s);pc.fill();pc.restore();
  }
  if(!alive){pOn=false;pc.clearRect(0,0,W,H)}
}

/* show sequence from sample */
function show(){
  const my=++run,g=$('#greet'),tor=$('#toran'),bar=$('#bar');
  P=[];RK=[];T=null;if(g)g.classList.remove('on');setGreet();
  if(matchMedia('(prefers-reduced-motion:reduce)').matches){if(g)g.classList.add('on');return}
  if(tor){tor.classList.remove('in');void tor.offsetWidth;tor.classList.add('in')}
  if(bar)bar.classList.add('dim');
  const at=(ms,fn)=>setTimeout(()=>{if(my===run)fn()},ms);
  petals();
  [[.2,0,330],[.5,250,45],[.8,500,190]].forEach(([k,ms,h])=>at(ms,()=>sampleRocket(W*k,H*R(.15,.35),h)));
  at(1400,()=>sampleRocket(W/2,H*.4,0,(x,y)=>{sampleBurst(x,y,45);textBurst(x,y)}));
  at(7000,()=>{if(g)g.classList.add('on');if(bar)bar.classList.remove('dim')});
}

// Master Animation Loop combining Standard Fireworks + Sample Intro
let previous=0;
function frame(now){
  let dt=Math.min(6,(now-previous)/16.667||1);
  previous=now;clock+=dt;
  const dtSec=Math.min(0.033,dt*0.01667);

  const ready=queue.filter(item=>item.due<=clock);
  queue=queue.filter(item=>item.due>clock);
  for(const item of ready){
    if(item.kind==='shell')projectile('shell',item.offset);
    else launch(item.kind);
  }

  ctx.clearRect(0,0,W,H);
  ctx.globalCompositeOperation='source-over';
  for(const e of effects)effect(e,dt);
  effects=effects.filter(e=>e.t<e.d);

  ctx.globalCompositeOperation='lighter';
  for(const f of flashes){
    glow(f.x,f.y,180,f.color+Math.round(f.life/f.max*45).toString(16).padStart(2,'0'));
    f.life-=dt;
  }
  flashes=flashes.filter(f=>f.life>0);

  ctx.lineCap='round';
  for(const p of particles){
    p.px=p.x;p.py=p.y;p.x+=p.vx*dt;p.y+=p.vy*dt;
    if(p.y>H-24){p.y=H-24;p.vy=-Math.abs(p.vy)*.18;p.vx*=.87;p.life=Math.min(p.life,15)}
    p.vx*=Math.pow(.985,dt);p.vy=p.vy*Math.pow(.989,dt)+p.gravity*dt;p.life-=dt;
    ctx.globalAlpha=Math.max(0,p.life/p.max)*(p.life<20?R(.6,1):1);
    ctx.shadowBlur=0;ctx.strokeStyle=p.color;ctx.lineWidth=p.size;ctx.beginPath();
    ctx.moveTo(p.px-p.vx*.8,p.py-p.vy*.8);ctx.lineTo(p.x,p.y);ctx.stroke();
    ctx.drawImage(sprite(p.color),p.x-p.size*3,p.y-p.size*3,p.size*6,p.size*6);
  }
  particles=particles.filter(p=>p.life>0);

  // Intro particles & rockets (from sample)
  if(RK.length) RK=RK.filter(f=>f(dtSec));
  if(P.length){
    const tt=T?performance.now()/1000-T:0,drag=Math.pow(.5,dtSec);
    P=P.filter(p=>{
      let a=1;
      if(p.m){
        if(tt>3.4){p.m=0;p.g=140;p.vx=R(-40,40);p.vy=R(-60,20);p.life=p.max=R(.8,1.6)}
        else{
          p.vx+=((p.tx-p.x)*60-p.vx*9)*dtSec+R(-1,1);
          p.vy+=((p.ty-p.y)*60-p.vy*9)*dtSec+R(-1,1);
          p.x+=p.vx*dtSec;p.y+=p.vy*dtSec;
          a=.75+.25*Math.sin(tt*9+p.ph);
        }
      }
      if(!p.m){
        p.life-=dtSec;if(p.life<=0)return false;
        p.vx*=drag;p.vy=p.vy*drag+p.g*dtSec;
        p.x+=p.vx*dtSec;p.y+=p.vy*dtSec;
        a=p.life/p.max;
      }
      ctx.globalAlpha=Math.max(0,Math.min(1,a));
      ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,p.sz,0,6.283);ctx.fill();
      return true;
    });
  }

  ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  if(pOn) petalFrame(dtSec);

  syncStage();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* share controls from sample */
const nm=$('#nm'),wa=$('#wa'),cp=$('#cp');
try{if(nm)nm.value=name||localStorage.getItem('dn')||''}catch(e){if(nm)nm.value=name}
const cur=()=>clean(nm?nm.value:'');
const link=()=>location.origin+location.pathname+'?from='+encodeURIComponent(cur());
function sync(){
  const ok=!!cur();
  if(wa)wa.disabled=!ok;
  if(cp)cp.disabled=!ok;
  const hint=$('#hint');if(hint)hint.style.display=ok?'none':'block';
  try{localStorage.setItem('dn',cur())}catch(e){}
}
if(nm)nm.addEventListener('input',sync);
sync();

if(wa)wa.onclick=()=>{
  const n=cur();if(!n)return;
  window.open('https://wa.me/?text='+encodeURIComponent(n+' ni taraf thi tamne Happy Diwali! \u{1FA94} Aa link kholo ne fatakda fodo: '+link()),'_blank','noopener');
};

if(cp)cp.onclick=async()=>{
  if(!cur())return;
  try{await navigator.clipboard.writeText(link())}catch(e){
    const a=document.createElement('textarea');a.value=link();
    document.body.appendChild(a);a.select();
    try{document.execCommand('copy')}catch(_){}
    a.remove();
  }
  introToast('Link copy thai gayi!');
};

if($('#pv'))$('#pv').onclick=()=>{
  name=cur();
  setGreet();
  show();
};

/* routing */
const pages=[...document.querySelectorAll('[data-page]')];
function navigate(){
  let nameRoute=location.hash.slice(1);
  if(!['home','about','contact'].includes(nameRoute))nameRoute='home';
  for(const page of pages)page.hidden=page.id!==nameRoute;
  document.querySelectorAll('.nav-link').forEach(link=>{
    const active=link.hash==='#'+nameRoute;
    link.classList.toggle('active',active);
    if(active)link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  if(nameRoute==='home'){
    resize();
    if(master)master.gain.setTargetAtTime(sound?.8:0,audio.currentTime,.025);
    const tor=$('#toran'),bar=$('#bar'),g=$('#greet');
    if(tor)tor.classList.remove('intro-hidden');
    if(bar)bar.classList.remove('intro-hidden');
    if(g)g.classList.add('on');
  } else {
    queue=[];effects=[];particles=[];flashes=[];audioUntil=0;
    P=[];RK=[];T=null;pOn=false;
    if(pc)pc.clearRect(0,0,W,H);
    stage.classList.remove('active');
    if(master)master.gain.setTargetAtTime(0,audio.currentTime,.025);
    const tor=$('#toran'),bar=$('#bar');
    if(tor)tor.classList.add('intro-hidden');
    if(bar)bar.classList.add('intro-hidden');
  }
  document.title=(nameRoute==='home'?lines()[0]+' Happy Diwali':nameRoute==='about'?'Amara Vishe | Gaamda ni Diwali':'Vaat Kari Lo | Gaamda ni Diwali');
}
addEventListener('hashchange',navigate);navigate();

document.addEventListener('visibilitychange',()=>{
  previous=0;
  if(document.hidden){
    queue=[];effects=[];particles=[];flashes=[];audioUntil=0;
    stage.classList.remove('active');
    if(audio?.state==='running')audio.suspend();
  }else if(audio&&sound)audio.resume().catch(()=>{});
});

/* font check & initial sequence start */
Promise.race([
  document.fonts.load('800 80px "Baloo 2"'),
  new Promise(r=>setTimeout(r,1200))
]).then(show);
