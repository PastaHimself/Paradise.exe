from pipeline import *
from checker import checker
import sys
mode=sys.argv[1]
if mode=='bent':folder='bent_flower_stems';source='flower_oxeye_daisy.png';x0,y0,x1,y1=4,2,11,16;positions=[(-1,-2,20),(1,2,-25)]
elif mode=='wilted':folder='wilted_flowers';source='flower_wither_rose.png';x0,y0,x1,y1=5,5,12,16;positions=[(0,0,110)]
else:raise ValueError(mode)
cs=[];a={};uvs={}
for n,(x,z,angle) in enumerate(positions):
 for part,lo_y,hi_y,v1,v2,rotation in [('lower',0,6,10,16,0),('upper',6,6+10-y0,y0,10,angle)]:
  for plane in ['x','z']:
   name=f'flower_{n}_{part}_{plane}';lo=[x-3.5,lo_y,z] if plane=='x' else [x,lo_y,z-3.5];hi=[x+3.5,hi_y,z] if plane=='x' else [x,hi_y,z+3.5]
   cs.append({'name':name,'from':lo,'to':hi,'origin':[x,6,z],'rotation':[0,0,rotation]});a[name]=('flower',['east','west','up','down'] if plane=='x' else ['north','south','up','down'],False);uvs[name]=[x0/4,v1/4,x1/4,v2/4]
D=build(folder,cs,a,{'flower':(0,0,source)},{'reference':'https://www.shutterbug.com/content/narrow-your-focus-how-use-lines-patterns-colors-textures-create-eye-catching-images','used':'arched slender stem and drooping flower head; bend is a single readable joint','limitations':['original cutout pixels split at source row 10; geometry rotation supplies bend without repaint','native wither-rose pixels substitute for species-specific wilted daisy pixels' if mode=='wilted' else 'two opposite fixed bends of 20 and 25 degrees','requires alpha-test material binding during pack integration','no animation or gameplay behavior']},area='flat_flower')
for q in cs:
 faces=['north','south'] if q['name'].endswith('_x') else ['east','west'];call('set_cube_uv',{'id':q['name'],'faces':{f:{'uv':uvs[q['name']],'texture':folder} for f in faces}})
dump(D/'uv_audit.json',[call('get_cube_uv',{'id':q['name']}) for q in cs])
checker(D,[0,6,0],[24,19,-28]);views(D,[0,6,0],{'front':[0,14,-30],'three_quarter':[24,19,-28],'back':[-24,18,28],'gameplay_scale':[38,27,-48],'side':[30,13,0]});print(mode+' flower ready',flush=True)
