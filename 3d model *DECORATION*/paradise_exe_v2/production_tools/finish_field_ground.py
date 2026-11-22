from mcp import *
from PIL import Image
import io,hashlib
D=ROOT/'paradise_exe_v2/flat_flower/field_ground';stem='flat_flower_field_ground_preview';p=json.loads((D/'plan.json').read_text());p['texture_order_left_to_right']=list(reversed(list(p['sources'])));dump(D/'plan.json',p)
b=json.loads((D/(stem+'.bbmodel')).read_text());assert len(b['elements'])==5;hashes={}
for name,src in p['sources'].items():
 raw=(D/(name+'.png')).read_bytes();assert raw==(ROOT/'bedrock-samples-v1.26.70.23-preview-full/textures/blocks'/src).read_bytes();hashes[name]=hashlib.sha256(raw).hexdigest()
 tx=next(t for t in b['textures'] if t['name']==name);embedded=Image.open(io.BytesIO(base64.b64decode(tx['source'].split(',')[1]))).convert('RGBA');assert embedded.tobytes()==Image.open(D/(name+'.png')).convert('RGBA').tobytes()
for q in b['elements']:
 dx,dy,dz=[v-u for u,v in zip(q['from'],q['to'])];spans={'north':(dx,dy),'south':(dx,dy),'east':(dz,dy),'west':(dz,dy),'up':(dx,dz),'down':(dx,dz)}
 for f,v in q['faces'].items():
  w,h=spans[f];u=v['uv'];assert abs(abs(u[2]-u[0])-w)<1e-5 and abs(abs(u[3]-u[1])-h)<1e-5
assert not any(t['name']=='__qa_checker' for t in b['textures'])
for name in ['top','three_quarter','qa_checker']:assert Image.open(D/(name+'.png')).width==640
info=call('get_project_info',{});assert info['project']['name']==stem;uuid=info['project']['uuid']
r=call('risky_eval',{'code':f'(()=>{{if(Project.uuid!=={json.dumps(uuid)})throw Error("Target changed");Codecs.project.write(Codecs.project.compile(),{json.dumps(str(D/(stem+".bbmodel")))});return {{saved:Project.saved,path:Project.save_path}}}})()'});assert r['saved']
dump(D/'verification.json',{'outputs_sha256':hashes,'native_source_files_byte_identical':True,'embedded_pixels_match':True,'density':'1 original pixel/model unit','UV_bounds':True,'checker_removed':True,'supported':['short_grass','bare_soil','worn_footpath'],'blocked_exact':p['blocked_exact'],'native_save':r})
call('trigger_action',{'action':'close_project','confirmDialog':False});r=call('risky_eval',{'code':'ModelProject.all.map(p=>({uuid:p.uuid,name:p.name}))'});assert not any(q['uuid']==uuid for q in r)
t=ROOT/'paradise_exe_v2/TODO.md';s=t.read_text().replace('- [ ] Field ground; references / paths: pending.','- [ ] Field ground — PARTIAL / exact flattened and dry grass surfaces BLOCKED by original-source rule. Verified outputs: `flat_flower/field_ground/short_grass.png` (grass_carried.png), `bare_soil.png` (dirt.png), `worn_footpath.png` (grass_path_top.png). Explicit proxies: `flattened_grass_moss_proxy.png` (pale_moss_block.png), `dry_grass_straw_proxy.png` (hay_block_top.png). Native files copied byte-identically. Editable `flat_flower_field_ground_preview.bbmodel`, top/three_quarter/checker PNGs, plan.json, verification.json. Reference: https://www.wildbienen.info/artenschutz/nisthilfen_06.php (short grass and exposed footpath). Exact damaged-grass pixels absent; proxies do not complete those two states. Generic tiled preview saved, checked at 1 px/unit, and tab closed; no runtime geometry needed.').replace('Current: **Flat Flower field ground — IN PROGRESS**','Current: **Flat Flower dense flower cluster — IN PROGRESS**').replace('Next: **Flat Flower dense flower cluster**','Next: **Flat Flower sparse flower cluster**');t.write_text(s);print('Ground outputs verified and preview closed; continue flowers')
