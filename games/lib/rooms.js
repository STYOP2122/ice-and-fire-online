/* Direct state synchronization. Both devices run and render the game locally. */
(() => {
 'use strict';
 const bar=document.createElement('section');bar.id='room-bar';
 bar.innerHTML='<button id="room-create">Создать комнату</button><input id="room-id" aria-label="ID комнаты" placeholder="000–999" maxlength="3" inputmode="numeric" pattern="[0-9]{3}"><button id="room-join">Подключиться</button><button id="room-leave" hidden>Выйти</button><button id="room-copy" hidden>Скопировать ID</button><span id="room-status" role="status">На одном устройстве: Огонёк — стрелки, Капелька — W A D</span>';
 document.body.append(bar);
 const css=document.createElement('style');css.textContent=`
 #room-bar{position:fixed;top:34px;left:50%;transform:translateX(-50%);z-index:10000;background:#14212eee;color:white;border:1px solid #46576b;border-radius:12px;padding:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center;width:max-content;max-width:96vw;font:13px Arial}
 #room-bar button,#room-bar input{padding:9px;border:1px solid #58708a;border-radius:7px;background:#223449;color:white;font:inherit}#room-id{width:125px}#room-status{max-width:420px}#room-bar [hidden]{display:none}
 body[data-game-active="true"] #room-bar{display:none}
 #btn-fullscreen{display:none!important}
 #btn-back{z-index:10001;padding:10px 14px;border:1px solid #ffffff30;border-radius:0 0 14px 0;background:#14212ecc;color:#fff;backdrop-filter:blur(8px);font:600 13px Arial}
 #btn-back svg{width:18px;height:18px;vertical-align:middle;margin-right:6px}
 @media(max-height:500px){#room-bar{top:28px;padding:4px;font-size:11px}#room-status{max-width:230px}}
 `;document.head.append(css);
 const $=id=>document.getElementById(id);let peer,conn,role='',timer,heartbeat,lastSeen=0;
 const down=new Set(), remoteDown=new Set();let applying=false, sceneVersion=0, remoteVersion=-1, pendingScene=null, ready=false, lastScene=null;
 const status=t=>$('room-status').textContent=t;
 const key=(code,type)=>{const e=new KeyboardEvent(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'keyCode',{value:code});Object.defineProperty(e,'which',{value:code});Object.defineProperty(e,'roomRemote',{value:true});window.dispatchEvent(e);};
 function release(){remoteDown.forEach(c=>key(c,'keyup'));remoteDown.clear();}
 function send(d){if(conn?.open)conn.send(d);}
 function cleanup(message='Вы вышли из комнаты. Можно играть на одном устройстве.'){
  clearTimeout(timer);clearInterval(heartbeat);release();down.clear();role='';delete document.body.dataset.roomRole;delete document.body.dataset.gameActive;
  const old=peer;peer=null;conn=null;old?.destroy();
  ready=false;pendingScene=null;remoteVersion=-1;applying=false;
  const game=window.icefireGame;if(game){game.paused=false;game.state.fading=false;game.input.enabled=true;}
$('room-create').disabled=false;$('room-join').disabled=false;$('room-id').disabled=false;$('room-leave').hidden=true;$('room-copy').hidden=true;status(message);
 }
 function begin(r){
  cleanup();role=r;document.body.dataset.roomRole=r;$('room-create').disabled=true;$('room-join').disabled=true;$('room-leave').hidden=false;
  if(typeof Peer==='undefined'){cleanup('Не удалось загрузить сетевой модуль. Обновите страницу.');return false;}
  timer=setTimeout(()=>cleanup('Соединение не установлено. Проверьте ID и сеть, затем попробуйте снова.'),30000);return true;
 }
 function wire(c){
  conn=c;c.on('error',()=>cleanup('Ошибка соединения. Создайте комнату заново.'));
  c.on('close',()=>{if(conn===c)cleanup('Второй игрок отключился.');});
  c.on('open',()=>{clearTimeout(timer);lastSeen=Date.now();heartbeat=setInterval(()=>{send({t:'ping'});if(role==='host'&&Date.now()-lastSeen>2500)release();},700);});
  c.on('data',d=>{
   if(!d||typeof d!=='object')return;lastSeen=Date.now();
   if(d.t==='scene'&&role==='guest')receiveScene(d);
   if(d.t==='ready'&&role==='host'&&d.v===sceneVersion){ready=true;send({t:'keys',keys:[...down]});}
   if(d.t==='snapshot'&&role==='guest')applySnapshot(d);
   if(d.t==='keys')syncKeys(d.keys);
   if(d.t==='pause'&&role==='guest'&&typeof d.value==='boolean'&&window.icefireGame)window.icefireGame.paused=d.value;
   if(d.t==='wrong-game'){cleanup('Откройте одну и ту же часть игры на обоих устройствах.');return;}
   if(d.t==='busy'){cleanup('В комнате уже два игрока.');return;}
   if(d.t==='reset'){release();if(role==='host')send({t:'keys',keys:[...down]});}
   if(d.t==='key'&&role==='host'&&[65,68,87].includes(d.c)&&typeof d.on==='boolean'){
    if(d.on)remoteDown.add(d.c);else remoteDown.delete(d.c);key(d.c,d.on?'keydown':'keyup');
   }
  });
 }
 $('room-create').onclick=()=>{
  if(!window.icefireGame?.isBooted){status('Дождитесь загрузки игры.');return;}
  if(!begin('host'))return;
  if(window.icefireGame){window.icefireGame.stage.disableVisibilityChange=true;window.icefireGame.settings.controls='dual';window.icefireGame.settingsSignal?.dispatch('controls');}
  sceneVersion++;lastScene=describeScene();
  const id=String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000).padStart(3,'0');
  $('room-id').value=id;$('room-id').disabled=true;status('Создаём комнату…');
  peer=new Peer('icefire-state-v1-'+id);peer.on('error',e=>cleanup(e.type==='unavailable-id'?'Этот ID уже занят. Нажмите «Создать комнату» ещё раз.':'Не удалось создать комнату. Проверьте подключение к интернету.'));
  peer.on('open',()=>{clearTimeout(timer);$('room-copy').hidden=false;status('Комната '+id+' · Вы — Огонёк. Ждём Капельку…');});
  peer.on('connection',c=>{
   if(c.metadata?.game!==location.pathname||c.metadata?.protocol!==1){c.on('open',()=>{c.send({t:'wrong-game'});setTimeout(()=>c.close(),200);});return;}
   if(conn){c.on('open',()=>{c.send({t:'busy'});setTimeout(()=>c.close(),200);});return;}
   wire(c);c.on('open',()=>{
    ready=false;sendScene();
    status('Вдвоём · Вы — Огонёк (стрелки). Выбирайте уровень на этом экране.');
   });
  });
 };
 $('room-join').onclick=()=>{
  const id=$('room-id').value.trim().toUpperCase();if(!/^[0-9]{3}$/.test(id)){status('Введите три цифры ID комнаты, например 042.');return;}
  if(!window.icefireGame?.isBooted){status('Дождитесь загрузки игры.');return;}
  if(!begin('guest'))return;status('Подключаемся к '+id+'…');
  peer=new Peer();peer.on('error',()=>cleanup('Комната не найдена или сеть блокирует соединение. Проверьте ID.'));
  peer.on('open',()=>wire(peer.connect('icefire-state-v1-'+id,{reliable:true,metadata:{game:location.pathname,protocol:1}})));

 };
 for(const type of ['keydown','keyup'])window.addEventListener(type,e=>{
  if(e.roomRemote||/INPUT|TEXTAREA/.test(e.target?.tagName))return;const c=e.keyCode;if(![37,38,39,65,68,87].includes(c))return;
  if(role==='guest'){
   if([65,68,87].includes(c)){if(type==='keydown')down.add(c);else down.delete(c);send({t:'key',c,on:type==='keydown'});}
   else {e.preventDefault();e.stopImmediatePropagation();}
  }else if(role==='host'){
   if([65,68,87].includes(c)){e.preventDefault();e.stopImmediatePropagation();}
   else {if(type==='keydown')down.add(c);else down.delete(c);send({t:'keys',keys:[...down]});}
  }

 },true);
 setInterval(()=>{if(role==='guest')down.forEach(c=>send({t:'key',c,on:true}));},350);
 window.addEventListener('blur',()=>{down.clear();send({t:'reset'});release();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){down.clear();send({t:'reset'});release();}});
 $('room-leave').onclick=()=>cleanup();$('room-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('room-id').value);status('ID скопирован. Отправьте его другу и выберите одну и ту же часть игры.');}catch(_){status('Скопируйте ID из поля комнаты.');}};
 const menu=$('btn-back');if(menu)menu.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>Меню';
 setInterval(()=>{
  const state=window.icefireGame?.state?.current;
  const active=['level','endGame','gameComplete'].includes(state);
  document.body.dataset.gameActive=String(active);

 },300);
 // State transitions are authoritative on the host. The guest loads the same
 // class and level files, then runs its own simulation and native renderer.
 function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(_){return null;}}
 function describeScene(args){
  const game=window.icefireGame, state=game.state.getCurrentState();
  const name=args?.[0]||game.state.current;
  const instance=game.state.states[name];
  return {t:'scene',v:sceneVersion,name,module:instance?.constructor?.icefireModule,
   args:clone(args||[name,true,false,...(state?.levelData?[state.levelData]:[])]),
   temple:clone(game.currentTemple),settings:{...game.settings,controls:'dual'}};
 }
 function sendScene(){
  if(role!=='host')return;
  const scene=lastScene||describeScene();
  send({...scene,v:sceneVersion});
 }
 function receiveScene(d){
  if(!Number.isInteger(d.v)||d.v<=remoteVersion||!Array.isArray(d.args)||typeof d.module!=='string'||!d.module.startsWith('States/'))return;
  remoteVersion=d.v;ready=false;release();pendingScene=d;
  const game=window.icefireGame;
  window.require([d.module],State=>{
   if(role!=='guest'||pendingScene!==d)return;
   if(d.settings&&typeof d.settings==='object')Object.assign(game.settings,d.settings,{controls:'dual'});
   if(d.temple&&typeof d.temple==='object')game.currentTemple=d.temple;
   game.stage.disableVisibilityChange=true;
   applying=true;
   try{
    game.paused=false;game.state.fading=false;
    game.state.overlay?.kill();game.state.add(d.name,State);
    game.state.start(...d.args);
   }finally{applying=false;}
   status('Вдвоём · Вы — Капелька. Игра работает на вашем устройстве.');
  },()=>cleanup('Не удалось загрузить уровень. Обновите игру на обоих устройствах.'));
 }
 function syncKeys(keys){
  if(!Array.isArray(keys))return;
  const allowed=role==='guest'?[37,38,39]:[65,68,87];
  const next=new Set(keys.filter(c=>allowed.includes(c)));
  remoteDown.forEach(c=>{if(!next.has(c)){key(c,'keyup');remoteDown.delete(c);}});
  next.forEach(c=>{if(!remoteDown.has(c)){remoteDown.add(c);key(c,'keydown');}});
 }
 const flags=['exists','alive','visible','open','opened','active','activated','pressed','collected','dead','dying','finished','enabled','isOpen','isOn','on','state','currentState','value','direction','targetAngle','targetPosition'];
 function objects(){
  const level=window.icefireGame?.level||window.icefireGame?.state?.getCurrentState();
  const result=[];const seen=new Set();
  function visit(o,path,depth){
   if(!o||typeof o!=='object'||seen.has(o)||depth>3)return;seen.add(o);
   result.push([path,o]);
   if(Array.isArray(o)){o.forEach((v,i)=>visit(v,path.concat(i),depth+1));return;}
   for(const k of ['objects','pers1','pers2','door1','door2','data','bodySprite','bodyParts','head','legs','sprite','diamonds','doors','fairies'])if(o[k])visit(o[k],path.concat(k),depth+1);
  }
  visit(level,[],0);
  // Collectibles live in display layers rather than the level's object list.
  function layer(o,path,depth){if(!o||depth>8)return;if(!seen.has(o)){seen.add(o);result.push([path,o]);}o.children?.forEach((v,i)=>layer(v,path.concat('children',i),depth+1));}
  const layers=window.icefireGame?.layers;if(layers)for(const k of Object.keys(layers))layer(layers[k],['layers',k],0);
  return result;
 }
 function snapshot(){
  const game=window.icefireGame,world=game?.physics?.box2d;
  if(game?.state.current!=='level'||!world?.world||(conn?.dataChannel?.bufferedAmount||0)>65536)return;
  const bodies=world.getBodies().filter(b=>b.GetType()!==0).map(b=>{
   const p=b.GetPosition(),v=b.GetLinearVelocity();
   return [b.icefireId,p.x,p.y,b.GetAngle(),v.x,v.y,b.GetAngularVelocity(),b.IsActive()];
  });
  const props=objects().map(([path,o])=>{
   const values={};for(const k of flags)if(typeof o[k]==='boolean'||typeof o[k]==='number'||typeof o[k]==='string')values[k]=o[k];
   return [path,values];
  }).filter(([,values])=>Object.keys(values).length);
  send({t:'snapshot',v:sceneVersion,bodies,props,paused:game.paused});
 }
 function applySnapshot(d){
  if(!ready||d.v!==remoteVersion||!Array.isArray(d.bodies)||!Array.isArray(d.props))return;
  const game=window.icefireGame,world=game?.physics?.box2d;
  if(game.state.current!=='level'||!world?.world||world.world.IsLocked())return;
  const bodies=new Map(world.getBodies().map(b=>[b.icefireId,b]));
  for(const row of d.bodies){
   if(!Array.isArray(row)||row.length!==8||!row.slice(0,7).every(Number.isFinite))continue;
   const [id,x,y,a,vx,vy,av,active]=row,b=bodies.get(id);if(!b)continue;
   b.SetTransformXYRadians(x,y,a);const velocity=b.GetLinearVelocity().Clone();velocity.x=vx;velocity.y=vy;b.SetLinearVelocity(velocity);b.SetAngularVelocity(av);
   if(typeof active==='boolean'&&b.IsActive()!==active)b.SetActive(active);
  }
  const targets=new Map(objects().map(([path,o])=>[JSON.stringify(path),o]));
  for(const [path,values] of d.props){const o=targets.get(JSON.stringify(path));if(!o||!values)continue;
   for(const k of flags)if(Object.hasOwn(values,k)&&typeof values[k]===typeof o[k])o[k]=values[k];
  }
  if(typeof d.paused==='boolean')game.paused=d.paused;
 }
 setInterval(()=>{
  const game=window.icefireGame;if(!game?.isBooted)return;
  if(!game.state.icefireHook){
   const start=game.state.start;game.state.icefireHook=true;
   game.state.start=function(...args){
    if(role==='guest'&&!applying)return;
    const result=start.apply(this,args);
    if(role==='host'){sceneVersion++;ready=false;lastScene=describeScene(args);sendScene();}
    return result;
   };
  }
  if(role==='guest'&&pendingScene&&game.state.current===pendingScene.name&&!game.load.isLoading){
   const level=game.state.getCurrentState();
   if(pendingScene.name!=='level'||(level.pers1?.body&&level.pers2?.body&&!game.physics.box2d.paused)){
    pendingScene=null;ready=true;down.forEach(c=>key(c,'keydown'));send({t:'ready',v:remoteVersion});
   }
  }
  if(role==='host'&&conn?.open&&ready)snapshot();
 },50);
 window.addEventListener('beforeunload' ,()=>peer?.destroy());
})();
