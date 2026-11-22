from views import *
from PIL import Image
import shutil
D=ROOT/'paradise_exe_v2/flat_flower/field_ground';D.mkdir(parents=True,exist_ok=True);stem='flat_flower_field_ground_preview';S=ROOT/'bedrock-samples-v1.26.70.23-preview-full/textures/blocks'
assert not list(D.glob('*.bbmodel'))
items=[('short_grass','grass_carried.png'),('flattened_grass_moss_proxy','pale_moss_block.png'),('dry_grass_straw_proxy','hay_block_top.png'),('bare_soil','dirt.png'),('worn_footpath','grass_path_top.png')]
plan={'reference':'https://www.wildbienen.info/artenschutz/nisthilfen_06.php','image':'../../references/field_ground.jpg','used':'exposed compacted footpath through short grass; contrast between green, dry material and bare soil','texture_order_left_to_right':[v[0] for v in items],'sources':dict(items),'blocked_exact':['flattened grass: no matching trampled-grass surface in local sources','dry grass ground: no exact dry-grass ground tile in local sources; original hay top supplied as straw proxy'],'limitations':['native precolored grass_carried.png avoids custom tint','pale moss and hay proxies are labelled explicitly; exact damaged grass states remain blocked','texture-only outputs; Generic Model is a tiled preview, no runtime geometry or pack integration']};dump(D/'plan.json',plan)
call('create_project',{'name':stem,'format':'free'});assert call('get_project_info',{})['project']['name']==stem
cs=[]
for n,(name,src) in enumerate(items):
 shutil.copyfile(S/src,D/(name+'.png'));assert Image.open(D/(name+'.png')).size==(16,16)
 call('create_texture',{'name':name,'data':str(D/(name+'.png')),'uv_width':16,'uv_height':16})
 q={'name':name,'from':[-44+n*18,0,-8],'to':[-28+n*18,1,8]};cs.append(q);call('place_cube',{'elements':[q],'faces':False})
 faces={f:{'uv':[0,0,w,h],'texture':name} for f,(w,h) in {'north':(16,1),'south':(16,1),'east':(16,1),'west':(16,1),'up':(16,16),'down':(16,16)}.items()};call('set_cube_uv',{'id':name,'box_uv':False,'faces':faces})
dump(D/'build_elements.json',cs);audit=[call('get_cube_uv',{'id':q['name']}) for q in cs];dump(D/'uv_audit.json',audit)
check=ROOT/'bedrock-samples-v1.26.70.23-preview-full/textures/misc/missing_texture.png';call('create_texture',{'name':'__qa_checker','data':str(check),'uv_width':16,'uv_height':16})
try:
 for q in audit:call('set_cube_uv',{'id':q['uuid'],'faces':{f:{'texture':'__qa_checker'} for f in q['faces']}})
 views(D,[0,0,0],{'qa_checker':[50,80,-100]})
finally:
 for q in audit:call('set_cube_uv',{'id':q['uuid'],'faces':{f:{'texture':v['texture']} for f,v in q['faces'].items()}})
 call('delete_texture',{'texture':'__qa_checker'})
views(D,[0,0,0],{'front':[0,70,-110],'three_quarter':[50,80,-100],'back':[-50,75,100],'gameplay_scale':[70,100,-150],'top':[0,125,-1]})
call('export_model',{'codec_id':'project','path':str(D/(stem+'.bbmodel')),'max_content_length':0});print('Field ground preview ready',flush=True)
