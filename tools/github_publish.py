"""Use Git Credential Manager without writing credentials to disk or output."""
import subprocess,json,urllib.request,urllib.error,sys
def api(method,path,data=None):
 p=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',text=True,capture_output=True,check=True)
 c=dict(l.split('=',1) for l in p.stdout.splitlines() if '=' in l)
 req=urllib.request.Request('https://api.github.com'+path,method=method,data=json.dumps(data).encode() if data is not None else None,headers={'Authorization':'Bearer '+c['password'],'User-Agent':'icefire-setup','Accept':'application/vnd.github+json','Content-Type':'application/json'})
 with urllib.request.urlopen(req) as r:return json.load(r) if r.status!=204 else {}
if __name__=='__main__':
 user=api('GET','/user')['login'];repo=user+'/ice-and-fire-online'
 if sys.argv[1]=='create':
  try:r=api('GET','/repos/'+repo);print('EXISTS',r['html_url'])
  except urllib.error.HTTPError as e:
   if e.code!=404:raise
   r=api('POST','/user/repos',{'name':'ice-and-fire-online','description':'Огонёк и Капелька: 6 игр на русском, комнаты по ID и сенсорное управление','private':False});print('CREATED',r['html_url'])
 elif sys.argv[1]=='pages':
  try:r=api('POST','/repos/'+repo+'/pages',{'build_type':'workflow'})
  except urllib.error.HTTPError as e:
   if e.code!=409:raise
   r=api('PUT','/repos/'+repo+'/pages',{'build_type':'workflow'})
  print(json.dumps(r,ensure_ascii=True))
 elif sys.argv[1]=='status':
  r=api('GET','/repos/'+repo+'/actions/runs?per_page=1');print(json.dumps([{k:x.get(k) for k in ['status','conclusion','html_url']} for x in r['workflow_runs']]))
