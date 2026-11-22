from views import *
from PIL import Image
import io,hashlib
S=ROOT/'bedrock-samples-v1.26.70.23-preview-full/textures/blocks'
def build_texture(area,folder,source,reference,used,limitations):
 D=ROOT/'paradise_exe_v2'/area/folder;D.mkdir(parents=True,exist_ok=True);stem=area+'_'+folder+'_preview';assert not list(D.glob('*.bbmodel'))
 raw=(S/source).read_bytes();assert Image.open(io.BytesIO(raw)).size==(16,16);(D/(folder+'.png')).write_bytes(raw)
 dump(D/'plan.json',{'source':source,'reference':reference,'used':used,'limitations':limitations,'scope':'texture-only; 2x2 native-scale tile preview'})
 call('create_project',{'name':stem,'format':'free'});assert call('get_project_info',{})['project']['name']==stem
 call('create_texture',{'name':folder,'data':str(D/(folder+'.png')),'uv_width':16,'uv_height':16});cs=[]
 for ix,x in enumerate([-16,0]):
  for iz,z in enumerate([-16,0]):cs.append({'name':f'tile_{ix}_{iz}','from':[x,0,z],'to':[x+16,1,z+16]})
 call('place_cube',{'elements':cs,'faces':False})
 for q in cs:
  faces={}
  for f,(w,h) in {'north':(16,1),'south':(16,1),'east':(16,1),'west':(16,1),'up':(16,16),'down':(16,16)}.items():faces[f]={'uv':[0,0,w,h],'texture':folder}
  call('set_cube_uv',{'id':q['name'],'box_uv':False,'faces':faces})
 dump(D/'build_elements.json',cs);audit=[call('get_cube_uv',{'id':q['name']}) for q in cs];dump(D/'uv_audit.json',audit)
 check=ROOT/'bedrock-samples-v1.26.70.23-preview-full/textures/misc/missing_texture.png';call('create_texture',{'name':'__qa_checker','data':str(check),'uv_width':16,'uv_height':16})
 try:
  for q in audit:call('set_cube_uv',{'id':q['uuid'],'faces':{f:{'texture':'__qa_checker'} for f,v in q['faces'].items() if v['texture'] is not None}})
  views(D,[0,0,0],{'qa_checker':[35,36,-42]})
 finally:
  for q in audit:call('set_cube_uv',{'id':q['uuid'],'faces':{f:{'texture':v['texture']} for f,v in q['faces'].items()}})
  call('delete_texture',{'texture':'__qa_checker'})
 views(D,[0,0,0],{'front':[0,36,-53],'three_quarter':[35,36,-42],'back':[-35,32,42],'gameplay_scale':[55,55,-75],'top':[0,70,-1]})
 call('export_model',{'codec_id':'project','path':str(D/(stem+'.bbmodel')),'max_content_length':0});return D

def finish_texture(area,folder,title,nexttitle,nextnext):
 D=ROOT/'paradise_exe_v2'/area/folder;stem=area+'_'+folder+'_preview';p=json.loads((D/'plan.json').read_text());raw=(D/(folder+'.png')).read_bytes();assert raw==(S/p['source']).read_bytes()
 b=json.loads((D/(stem+'.bbmodel')).read_text());assert len(b['elements'])==4 and len(b['textures'])==1
 im=Image.open(io.BytesIO(base64.b64decode(b['textures'][0]['source'].split(',')[1]))).convert('RGBA');assert im.tobytes()==Image.open(io.BytesIO(raw)).convert('RGBA').tobytes()
 for q in b['elements']:
  for f,v in q['faces'].items():
   if v.get('texture') is None:continue
   w,h=(16,16) if f in ['up','down'] else (16,1);u=v['uv'];assert abs(abs(u[2]-u[0])-w)<1e-5 and abs(abs(u[3]-u[1])-h)<1e-5
 for n in ['front','three_quarter','back','gameplay_scale','qa_checker']:assert Image.open(D/(n+'.png')).width==640
 i=call('get_project_info',{});assert i['project']['name']==stem;uuid=i['project']['uuid']
 r=call('risky_eval',{'code':f'(()=>{{if(Project.uuid!=={json.dumps(uuid)})throw Error("Target changed");Codecs.project.write(Codecs.project.compile(),{json.dumps(str(D/(stem+".bbmodel")))});return {{saved:Project.saved,path:Project.save_path}}}})()'});assert r['saved']
 dump(D/'verification.json',{'source_byte_identical':True,'source_sha256':hashlib.sha256(raw).hexdigest(),'embedded_pixels_match':True,'density':'1 px/unit','tiles':4,'native_save':r})
 call('trigger_action',{'action':'close_project','confirmDialog':False});inventory=call('risky_eval',{'code':'ModelProject.all.map(p=>({uuid:p.uuid,name:p.name}))'});assert not any(q['uuid']==uuid for q in inventory)
 t=ROOT/'paradise_exe_v2/TODO.md';s=t.read_text();import re
 label=area.replace('_',' ').title();s=re.sub(r'Current: \*\*.*?\*\*','Current: **'+label+' '+nexttitle+' — IN PROGRESS**',s,count=1);s=re.sub(r'Next: \*\*.*?\*\*','Next: **'+label+' '+nextnext+'**',s,count=1)
 old='- [ ] '+title+'; references / paths: pending.';assert old in s
 note=f'- [x] {title} — original {p["source"]} copied byte-identically to `{area}/{folder}/{folder}.png`. Editable tiled preview `{stem}.bbmodel`, front/three_quarter/back/gameplay_scale/top/checker PNGs and verification.json in same folder. Reference: '+p['reference']+' ('+p['used']+'). '+'; '.join(p['limitations'])+'. 1 pixel/unit UVs and embedded pixels verified; native saved preview closed. Texture-only output, no runtime geometry needed.'
 t.write_text(s.replace(old,note));print(title+' texture verified and preview closed',flush=True)
