from mcp import *
from PIL import Image
D=ROOT/'paradise_exe_v2/library/card_reader_terminal';stem='library_card_reader_terminal'
i=call('get_project_info',{});assert i['project']['name']==stem;uuid=i['project']['uuid']
for codec,ext in [('project','bbmodel'),('bedrock','geo.json')]:call('export_model',{'codec_id':codec,'path':str(D/(stem+'.'+ext)),'max_content_length':0})
b=json.loads((D/(stem+'.bbmodel')).read_text());g=json.loads((D/(stem+'.geo.json')).read_text());p=json.loads((D/'plan.json').read_text())
assert len(b['elements'])==19 and sum(len(q.get('cubes',[])) for q in g['minecraft:geometry'][0]['bones'])==19
im=Image.open(D/'card_reader_terminal.png').convert('RGBA')
for x,y,f in p['materials'].values():assert im.crop((x,y,x+16,y+16)).tobytes()==Image.open(ROOT/'bedrock-samples-v1.26.70.23-preview-full/textures/blocks'/f).convert('RGBA').tobytes()
assert base64.b64decode(b['textures'][0]['source'].split(',')[1])==(D/'card_reader_terminal.png').read_bytes()
count=0
for q in b['elements']:
 dx,dy,dz=[v-u for u,v in zip(q['from'],q['to'])]
 spans={'north':(dx,dy),'south':(dx,dy),'east':(dz,dy),'west':(dz,dy),'up':(dx,dz),'down':(dx,dz)}
 for f,v in q['faces'].items():
  if v.get('texture') is None:continue
  u=v['uv'];w,h=spans[f];assert abs(abs(u[2]-u[0])*4-w)<1e-4 and abs(abs(u[3]-u[1])*4-h)<1e-4;assert all(0<=n<=16 for n in u);count+=1
for n in ['front','three_quarter','back','gameplay_scale']:assert Image.open(D/(n+'.png')).width==640
r=call('risky_eval',{'code':f'(()=>{{if(Project.uuid!=={json.dumps(uuid)})throw Error("Target changed");Codecs.project.write(Codecs.project.compile(),{json.dumps(str(D/(stem+".bbmodel")))});return {{saved:Project.saved,path:Project.save_path}}}})()'});assert r['saved']
dump(D/'verification.json',{'cubes':19,'active_quads':count,'density':'1 pixel/model unit','UV_bounds':True,'native_pixels':True,'embedded_texture_matches':True,'source_runtime_match':True,'native_save':r})
call('trigger_action',{'action':'close_project','confirmDialog':False})
r=call('risky_eval',{'code':'ModelProject.all.map(p=>({uuid:p.uuid,name:p.name}))'});assert not any(q['uuid']==uuid for q in r)
t=ROOT/'paradise_exe_v2/TODO.md';s=t.read_text().replace('Current: **Library card reader terminal — IN PROGRESS**','Current: **Library index-card drawer cabinet — IN PROGRESS**').replace('Next: **Library index-card drawer cabinet**','Next: **Library book return slot**').replace('- [ ] Card reader terminal; references / paths: pending.','- [x] Card reader terminal — 19 cubes; `library/card_reader_terminal/library_card_reader_terminal.bbmodel`, `.geo.json`, `card_reader_terminal.png`, front/three_quarter/back/gameplay_scale PNGs and verification.json. Vanilla concrete_black.png, concrete_silver.png, concrete_light_blue.png, concrete_red.png, concrete_lime.png copied unchanged. Reference: https://ipon.hu/shop/termek/reiner-sct-cyberjack-rfid-komfort-usb/1716183 (desktop shape, raised display, tactile keypad, card slot). Blank keys/display; static only. 1 pixel/unit UVs, atlas pixels, embedded image and runtime geometry verified; native saved tab closed and verified.')
t.write_text(s);print('Card reader completed and closed')
