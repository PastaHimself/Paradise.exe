import json,subprocess,pathlib,base64
ROOT=pathlib.Path('/home/pasta/Downloads/blockbench')
_calls=0
def call(tool,args):
 global _calls
 p=subprocess.run(['mcptoon','call','blockbench',tool,'--stdin','--destructive','--json'],input=json.dumps(args),text=True,capture_output=True)
 try:d=json.loads(p.stdout)
 except json.JSONDecodeError:raise RuntimeError(f'{tool}: no JSON result; exit={p.returncode}; stdout_length={len(p.stdout)}; stderr={p.stderr[-1800:]}')
 if p.returncode or isinstance(d,dict) and (d.get('error') or d.get('isError')):raise RuntimeError(str(d)[:2000]+p.stderr[:200])
 _calls+=1
 if _calls%20==0:print('MCP progress:',_calls,'calls',flush=True)
 return d
def dump(path,data):pathlib.Path(path).write_text(json.dumps(data,indent=2))
