/* Accessible SVG touch controls. Movement on the left, jump on the right. */
(() => {
 'use strict';
 if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return;
 const pressed = new Set();
 function key(code, on) {
  if (on === pressed.has(code)) return;
  if (on) pressed.add(code); else pressed.delete(code);
  const e = new KeyboardEvent(on ? 'keydown' : 'keyup', {bubbles:true,cancelable:true});
  Object.defineProperty(e,'keyCode',{value:code});
  Object.defineProperty(e,'which',{value:code});
  window.dispatchEvent(e);
 }
 const style=document.createElement('style');
 style.textContent=`
 .tc-controls{position:fixed;inset:0;pointer-events:none;z-index:9998;--size:clamp(48px,10vw,74px)}
 .tc-cluster{position:absolute;bottom:max(16px,env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:10px}
 .tc-movement{left:max(16px,env(safe-area-inset-left))}.tc-jumps{right:max(16px,env(safe-area-inset-right))}
 .tc-group{display:flex;gap:10px;align-items:center}.tc-water{--accent:102,220,255}.tc-fire{--accent:255,137,85}
 .tc-btn{pointer-events:auto;display:grid;place-items:center;width:var(--size);height:var(--size);padding:0;border:1px solid rgba(var(--accent),.65);border-radius:20px;background:linear-gradient(145deg,rgba(var(--accent),.28),rgba(12,23,35,.85));color:rgb(var(--accent));box-shadow:inset 0 1px 0 #ffffff30,0 5px 18px #0005;backdrop-filter:blur(8px);touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
 .tc-btn svg{width:52%;height:52%;pointer-events:none;filter:drop-shadow(0 1px 3px #0005)}
 .tc-btn.active{background:rgba(var(--accent),.55);transform:translateY(2px);box-shadow:0 0 20px rgba(var(--accent),.3)}
 .tc-btn-jump{border-radius:50%;width:calc(var(--size) * 1.12);height:calc(var(--size) * 1.12)}
 body[data-room-role="host"] .tc-water,body[data-room-role="guest"] .tc-fire{display:none}
 @media(min-width:1000px) and (hover:hover) and (pointer:fine){.tc-controls{display:none}}
 `;document.head.append(style);
 const paths={left:'<path d="m14 6-6 6 6 6M8 12h12"/>',right:'<path d="m10 6 6 6-6 6M4 12h12"/>',jump:'<path d="M12 18V5m-6 6 6-6 6 6M5 21h14"/>'};
 function button(code, icon, name) {
  const b=document.createElement('button');b.type='button';b.className='tc-btn'+(icon==='jump'?' tc-btn-jump':'');b.dataset.key=code;b.setAttribute('aria-label',name);
  b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[icon]+'</svg>';
  const pointers=new Set();
  b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);pointers.add(e.pointerId);b.classList.add('active');key(code,true);});
  const release=e=>{pointers.delete(e.pointerId);if(!pointers.size){b.classList.remove('active');key(code,false);}};
  b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);
  b.addEventListener('contextmenu',e=>e.preventDefault());return b;
 }
 const controls=document.createElement('div');controls.className='tc-controls';
 const movement=document.createElement('div');movement.className='tc-cluster tc-movement';
 const jumps=document.createElement('div');jumps.className='tc-cluster tc-jumps';
 for(const [color,name,left,right,jump] of [['water','Капелька',65,68,87],['fire','Огонёк',37,39,38]]){
  const row=document.createElement('div');row.className='tc-group tc-'+color;
  row.append(button(left,'left',name+': влево'),button(right,'right',name+': вправо'));movement.append(row);
  const j=document.createElement('div');j.className='tc-group tc-'+color;j.append(button(jump,'jump',name+': прыжок'));jumps.append(j);
 }
 controls.append(movement,jumps);document.body.append(controls);
 const reset=()=>{[...pressed].forEach(c=>key(c,false));controls.querySelectorAll('.active').forEach(b=>b.classList.remove('active'));};
 window.addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
 new MutationObserver(reset).observe(document.body,{attributes:true,attributeFilter:['data-room-role']});
})();
