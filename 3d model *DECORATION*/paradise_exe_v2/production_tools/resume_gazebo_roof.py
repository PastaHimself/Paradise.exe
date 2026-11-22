from pipeline import *
from checker import checker
D=ROOT/'paradise_exe_v2/flat_flower/ruined_gazebo_roof'
i=call('get_project_info',{});assert i['project']['name']=='flat_flower_ruined_gazebo_roof' and i['counts']['cubes']==9 and i['counts']['textures']==0
p=json.loads((D/'plan.json').read_text());p['materials']['roof'][2]='deepslate/deepslate_tiles.png';dump(D/'plan.json',p)
cs=json.loads((D/'build_elements.json').read_text());im=Image.new('RGBA',(64,64))
for x in range(0,64,16):
 for y in range(0,64,16):im.paste(Image.open(S/('planks_spruce.png' if x<32 else 'deepslate/deepslate_tiles.png')).convert('RGBA'),(x,y))
im.save(D/'ruined_gazebo_roof.png');call('create_texture',{'name':'ruined_gazebo_roof','data':str(D/'ruined_gazebo_roof.png')})
for q in cs:
 wood=q['name'].startswith('rafter') or q['name']=='gable_tie';x=0 if wood else 32
 dx,dy,dz=[b-a for a,b in zip(q['from'],q['to'])];faces={}
 for f,(w,h) in {'north':(dx,dy),'south':(dx,dy),'east':(dz,dy),'west':(dz,dy),'up':(dx,dz),'down':(dx,dz)}.items():
  rot=90 if wood and f in ['up','down'] else 0
  if rot:w,h=h,w
  faces[f]={'uv':[x/4,0,(x+w)/4,h/4],'rotation':rot,'texture':'ruined_gazebo_roof'}
 call('set_cube_uv',{'id':q['name'],'box_uv':False,'faces':faces})
dump(D/'uv_audit.json',[call('get_cube_uv',{'id':q['name']}) for q in cs])
checker(D,[0,2.5,0],[31,23,30]);views(D,[0,2.5,0],{'front':[36,12,0],'three_quarter':[31,23,30],'back':[-31,18,-30],'gameplay_scale':[50,33,48],'underside':[29,-13,24],'top':[0,48,1]})
print('Gazebo roof ready',flush=True)
