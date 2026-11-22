from views import *
from PIL import Image

def checker(D,target,camera):
 audit=json.loads((D/'uv_audit.json').read_text());src=ROOT/'bedrock-samples-v1.26.70.23-preview-full/textures/misc/missing_texture.png'
 tile=Image.open(src).convert('RGBA');im=Image.new('RGBA',(64,64))
 for x in range(0,64,tile.width):
  for y in range(0,64,tile.height):im.paste(tile,(x,y))
 tmp=ROOT/'paradise_exe_v2/production_tools/checker_temporary.png';im.save(tmp)
 call('create_texture',{'name':'__qa_checker','data':str(tmp)})
 try:
  for q in audit:call('set_cube_uv',{'id':q['uuid'],'faces':{f:{'texture':'__qa_checker'} for f,v in q['faces'].items() if v['texture'] is not None}})
  views(D,target,{'qa_checker':camera})
 finally:
  for q in audit:call('set_cube_uv',{'id':q['uuid'],'faces':{f:{'texture':v['texture']} for f,v in q['faces'].items()}})
  call('delete_texture',{'texture':'__qa_checker'})
 dump(D/'qa_checker.json',{'source':str(src),'method':'Unchanged original checker tiled at native resolution; face UVs preserved; original atlas assignments restored and checker texture removed'})
