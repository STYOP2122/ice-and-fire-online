from pathlib import Path
import re,json
from PIL import Image,ImageFont,ImageDraw
root=Path(__file__).resolve().parent.parent
tr={'Play':'Играть','More Games':'Другие игры','Walkthrough':'Прохождение','Ok':'Хорошо','Continue':'Продолжить','credits_to':'Авторы игры','Back':'Назад','Level Numbers':'Номера уровней','Level numbers':'Номера уровней','Paused':'Пауза','End':'В меню','Retry':'Заново','Resume':'Продолжить','Menu':'Меню','Game Over':'Игра окончена','congratulations':'Поздравляем!','you_completed':'Вы прошли игру!','this':'Этот','menu':'меню','level':'уровень','temple':'храм','not_yet':'пока недоступен','complete_more':'Пройдите больше уровней','in_other_temples':'в других храмах','to_unlock':'для открытия','Ok!':'Хорошо!','unlock_all':'Открыть все уровни','Cancel':'Отмена','Loading':'Загрузка','you_almost_completed_1':'Попробуйте собрать','you_almost_completed_2':'все зелёные алмазы','Forest Temple':'Лесной храм','Water Temple':'Храм воды','Fire Temple':'Храм огня','Light Temple':'Храм света','Ice Temple':'Ледяной храм','Crystal Temple':'Хрустальный храм','Wind Temple':'Храм ветра'}
for p in root.glob('games/*/js/game.js'):
 s=p.read_text('utf-8')
 start=s.index('define("utils/lang/ch"')
 end=s.index('}.call(this)',start)
 block=s[start:end]
 for k,v in tr.items():
  block=re.sub(r'(?m)(\s*(?:'+re.escape(json.dumps(k))+'|'+re.escape(k)+r')\s*:\s*)"[^"\n]*"',lambda m:m[1]+json.dumps(v,ensure_ascii=False),block)
 s=s[:start]+block+s[end:]
 p.write_text(s,'utf-8')
p=root/'games/6-fairy-tales/game.js'
s=p.read_text('utf-8').replace('b = c && c.lang,','b = "ru",')
s=s.replace('WaterGirl','Капелькой').replace('FireBoy','Огоньком').replace('Watergirl','Капелькой').replace('Fireboy','Огоньком') if False else s
p.write_text(s,'utf-8')
# Cyrillic bitmap font used by parts 1–5. Part 6 already ships Cyrillic glyphs.
chars=''.join(chr(i) for i in range(32,127))+''.join(chr(i) for i in range(1024,1120))+'Ёё—«»…'
font=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',42)
im=Image.new('RGBA',(1024,1024)); draw=ImageDraw.Draw(im); entries=[];x=y=4
for ch in dict.fromkeys(chars):
 w=int(font.getlength(ch))+4
 if x+w>1020:x=4;y+=58
 draw.text((x,y),ch,font=font,fill='white',anchor='lt')
 entries.append(f'<char id="{ord(ch)}" x="{x}" y="{y}" width="{w}" height="54" xoffset="0" yoffset="0" xadvance="{w-2}" page="0" chnl="15"/>')
 x+=w+2
for folder in [root/'games/shared-assets/assets/fonts/chinese',root/'games/5-elements/assets/fonts/chinese']:
 im.save(folder/'font.png')
 (folder/'font.fnt').write_text('<font><info face="Arial" size="48"/><common lineHeight="54" base="44" scaleW="1024" scaleH="1024" pages="1"/><pages><page id="0" file="font.png"/></pages><chars count="'+str(len(entries))+'">'+''.join(entries)+'</chars></font>','utf-8')
names=['Лесной храм','Храм света','Ледяной храм','Хрустальный храм','Стихии','Сказки']
for i,p in enumerate(sorted(root.glob('games/*/index.html'))):
 s=p.read_text('utf-8').replace('lang="en"','lang="ru"').replace('scope: "/games/"','scope: new URL("../", location.href).pathname')
 s=re.sub(r'<title>.*?</title>',f'<title>Огонёк и Капелька — {names[i]}</title>',s)
 s=s.replace('&#8592; Menu','&#8592; Меню').replace('>Fullscreen<','>На весь экран<')
 s=s.replace('<script data-main=', '<script src="../lib/ru.js"></script>\n    <script data-main=')
 if 'ru.js' not in s:s=s.replace('<head>','<head><script src="../lib/ru.js"></script>')
 s=s.replace('</body>','<script src="../lib/peerjs.min.js"></script><script src="../lib/rooms.js"></script></body>')
 p.write_text(s,'utf-8')
p=root/'games/sw.js';s=p.read_text('utf-8')
s=s.replace('url.pathname.match(GAME_DIR_RE)','url.pathname.slice(new URL(self.registration.scope).pathname.length - 7).match(GAME_DIR_RE)')
s=s.replace("url.origin + '/games/shared-assets/'", "new URL('shared-assets/', self.registration.scope).href")
p.write_text(s,'utf-8')
