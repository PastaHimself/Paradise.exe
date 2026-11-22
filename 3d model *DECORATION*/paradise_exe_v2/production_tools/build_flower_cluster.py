from pipeline import *
from checker import checker
import sys
mode=sys.argv[1]
if mode=='dense':folder='dense_flower_cluster';positions=[(-4,-4),(3.5,-3.5),(-3.75,4),(4,4),(.25,.5)]
elif mode=='sparse':folder='sparse_flower_cluster';positions=[(-4,3.5),(4,-4)]
elif mode=='rows':folder='uniform_flower_rows';positions=[(-4,-4),(4,-4),(-4,4),(4,4)]
else:raise ValueError(mode)
cs=[];a={}
for n,(x,z) in enumerate(positions):
 for plane in ['x','z']:
  name=f'flower_{n}_{plane}'
  lo=[x-3.5,0,z] if plane=='x' else [x,0,z-3.5];hi=[x+3.5,14,z] if plane=='x' else [x,14,z+3.5]
  cs.append({'name':name,'from':lo,'to':hi});a[name]=('flower',['east','west','up','down'] if plane=='x' else ['north','south','up','down'],False)
D=build(folder,cs,a,{'flower':(0,0,'flower_oxeye_daisy.png')},{'reference':'https://meadowinmygarden.co.uk/products/oxeye-daisy-seeds','used':'white daisy heads above slender green stems; '+('irregular dense clump' if mode=='dense' else 'separated flowers with open ground' if mode=='sparse' else 'unnaturally identical spacing and height in two straight rows'),'limitations':['original vanilla cutout flower pixels; 1 pixel/model unit','native opaque bounding box cropped in UVs only (4,2)-(11,16)','requires alpha-test material binding during later pack integration','static crossed planes; no entity or sway animation']},area='flat_flower')
for q in cs:
 faces=['north','south'] if q['name'].endswith('_x') else ['east','west']
 call('set_cube_uv',{'id':q['name'],'faces':{f:{'uv':[1,.5,2.75,4],'texture':folder} for f in faces}})
dump(D/'uv_audit.json',[call('get_cube_uv',{'id':q['name']}) for q in cs])
checker(D,[0,7,0],[26,22,-30]);views(D,[0,7,0],{'front':[0,17,-35],'three_quarter':[26,22,-30],'back':[-26,20,30],'gameplay_scale':[42,30,-55],'top':[0,38,-1]});print(mode+' flowers ready',flush=True)
