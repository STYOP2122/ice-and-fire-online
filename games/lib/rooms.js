/* One authoritative game, streamed over WebRTC; no divergent game simulations. */
(() => {
 'use strict';
 const bar=document.createElement('section');bar.id='room-bar';
 bar.innerHTML='<button id="room-create">Создать комнату</button><input id="room-id" aria-label="ID комнаты" placeholder="000–999" maxlength="3" inputmode="numeric" pattern="[0-9]{3}"><button id="room-join">Подключиться</button><button id="room-leave" hidden>Выйти</button><button id="room-copy" hidden>Скопировать ID</button><span id="room-status" role="status">На одном устройстве: Огонёк — стрелки, Капелька — W A D</span>';
 document.body.append(bar);
 const css=document.createElement('style');css.textContent=`
 #room-bar{position:fixed;top:34px;left:50%;transform:translateX(-50%);z-index:10000;background:#14212eee;color:white;border:1px solid #46576b;border-radius:12px;padding:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center;width:max-content;max-width:96vw;font:13px Arial}
 #room-bar button,#room-bar input{padding:9px;border:1px solid #58708a;border-radius:7px;background:#223449;color:white;font:inherit}#room-id{width:125px}#room-status{max-width:420px}#room-bar [hidden]{display:none}
 #remote-game{position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:black;z-index:9000}
 body[data-game-active="true"] #room-bar{display:none}
 #btn-fullscreen{display:none!important}
 #btn-back{z-index:10001;padding:10px 14px;border:1px solid #ffffff30;border-radius:0 0 14px 0;background:#14212ecc;color:#fff;backdrop-filter:blur(8px);font:600 13px Arial}
 #btn-back svg{width:18px;height:18px;vertical-align:middle;margin-right:6px}
 @media(max-height:500px){#room-bar{top:28px;padding:4px;font-size:11px}#room-status{max-width:230px}}
 `;document.head.append(css);
 const $=id=>document.getElementById(id);let peer,conn,call,stream,video,role='',timer,heartbeat,lastSeen=0;
 const down=new Set(), remoteDown=new Set();let localPaused=false,audioOut;
 const status=t=>$('room-status').textContent=t;
 const key=(code,type)=>{const e=new KeyboardEvent(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'keyCode',{value:code});Object.defineProperty(e,'which',{value:code});Object.defineProperty(e,'roomRemote',{value:true});window.dispatchEvent(e);};
 function release(){remoteDown.forEach(c=>key(c,'keyup'));remoteDown.clear();}
 function send(d){if(conn?.open)conn.send(d);}
 function cleanup(message='Вы вышли из комнаты. Можно играть на одном устройстве.'){
  clearTimeout(timer);clearInterval(heartbeat);release();down.clear();role='';delete document.body.dataset.roomRole;delete document.body.dataset.gameActive;
  const old=peer;peer=null;conn=null;old?.destroy();call?.close();call=null;stream?.getTracks().forEach(t=>t.stop());stream=null;video?.remove();video=null;
  if(audioOut){try{window.icefireGame?.sound.masterGain.disconnect(audioOut);}catch(_){}audioOut=null;}
  if(localPaused&&window.icefireGame){window.icefireGame.paused=false;window.icefireGame.sound.mute=false;}localPaused=false;
  $('root')?.style.removeProperty('visibility');$('room-create').disabled=false;$('room-join').disabled=false;$('room-id').disabled=false;$('room-leave').hidden=true;$('room-copy').hidden=true;status(message);
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
   if(d.t==='scene'&&role==='guest'&&typeof d.active==='boolean')document.body.dataset.gameActive=String(d.active);
   if(d.t==='busy'){cleanup('В комнате уже два игрока.');return;}
   if(d.t==='reset'&&role==='host')release();
   if(d.t==='key'&&role==='host'&&[65,68,87].includes(d.c)&&typeof d.on==='boolean'){
    if(d.on)remoteDown.add(d.c);else remoteDown.delete(d.c);key(d.c,d.on?'keydown':'keyup');
   }
  });
 }
 $('room-create').onclick=()=>{
  const canvas=document.querySelector('canvas');if(!canvas?.captureStream){status('Дождитесь загрузки игры. Для комнат нужен браузер с поддержкой WebRTC.');return;}
  if(!begin('host'))return;
  if(window.icefireGame)window.icefireGame.stage.disableVisibilityChange=true;
  const id=String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000).padStart(3,'0');
  $('room-id').value=id;$('room-id').disabled=true;status('Создаём комнату…');
  peer=new Peer('icefire-ru-'+id);peer.on('error',e=>cleanup(e.type==='unavailable-id'?'Этот ID уже занят. Нажмите «Создать комнату» ещё раз.':'Не удалось создать комнату. Проверьте подключение к интернету.'));
  peer.on('open',()=>{clearTimeout(timer);$('room-copy').hidden=false;status('Комната '+id+' · Вы — Огонёк. Ждём Капельку…');});
  peer.on('connection',c=>{
   if(conn){c.on('open',()=>{c.send({t:'busy'});setTimeout(()=>c.close(),200);});return;}
   wire(c);c.on('open',()=>{
    stream=canvas.captureStream(24);
    const sound=window.icefireGame?.sound;if(sound?.context&&sound.masterGain){audioOut=sound.context.createMediaStreamDestination();sound.masterGain.connect(audioOut);audioOut.stream.getAudioTracks().forEach(t=>stream.addTrack(t));}
    call=peer.call(c.peer,stream);call.on('error',()=>cleanup('Не удалось передать изображение. Попробуйте другую сеть.'));
    status('Вдвоём · Вы — Огонёк (стрелки). Выбирайте уровень на этом экране.');
   });
  });
 };
 $('room-join').onclick=()=>{
  const id=$('room-id').value.trim().toUpperCase();if(!/^[0-9]{3}$/.test(id)){status('Введите три цифры ID комнаты, например 042.');return;}
  if(!begin('guest'))return;status('Подключаемся к '+id+'…');$('root')?.style.setProperty('visibility','hidden');
  if(window.icefireGame){window.icefireGame.paused=true;window.icefireGame.sound.mute=true;localPaused=true;}
  peer=new Peer();peer.on('error',()=>cleanup('Комната не найдена или сеть блокирует соединение. Проверьте ID.'));
  peer.on('open',()=>wire(peer.connect('icefire-ru-'+id,{reliable:true})));
  peer.on('call',c=>{if(c.peer!=='icefire-ru-'+id){c.close();return;}call=c;c.answer();c.on('stream',s=>{
   clearTimeout(timer);video=document.createElement('video');video.id='remote-game';video.autoplay=true;video.playsInline=true;video.muted=true;video.srcObject=s;document.body.append(video);video.play().catch(()=>status('Нажмите на экран для начала.'));
   status('Вдвоём · Вы — Капелька (W A D). Уровень выбирает Огонёк.');
  });c.on('error',()=>cleanup('Не удалось получить изображение. Попробуйте другую сеть.'));});
 };
 for(const type of ['keydown','keyup'])window.addEventListener(type,e=>{
  if(e.roomRemote||/INPUT|TEXTAREA/.test(e.target?.tagName))return;const c=e.keyCode;if(![37,38,39,65,68,87].includes(c))return;
  if(role==='guest'){e.preventDefault();e.stopImmediatePropagation();if([65,68,87].includes(c)){if(type==='keydown')down.add(c);else down.delete(c);send({t:'key',c,on:type==='keydown'});}}
  else if(role==='host'&&[65,68,87].includes(c)){e.preventDefault();e.stopImmediatePropagation();}
 },true);
 setInterval(()=>{if(role==='guest')down.forEach(c=>send({t:'key',c,on:true}));},350);
 window.addEventListener('blur',()=>{down.clear();send({t:'reset'});release();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){down.clear();send({t:'reset'});release();}});
 $('room-leave').onclick=()=>cleanup();$('room-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('room-id').value);status('ID скопирован. Отправьте его другу и выберите одну и ту же часть игры.');}catch(_){status('Скопируйте ID из поля комнаты.');}};
 const menu=$('btn-back');if(menu)menu.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>Меню';
 setInterval(()=>{
  if(role==='guest')return;
  const state=window.icefireGame?.state?.current;
  const active=['level','endGame','gameComplete'].includes(state);
  document.body.dataset.gameActive=String(active);
  if(role==='host')send({t:'scene',active});
 },300);
 window.addEventListener('beforeunload' ,()=>peer?.destroy());
})();
