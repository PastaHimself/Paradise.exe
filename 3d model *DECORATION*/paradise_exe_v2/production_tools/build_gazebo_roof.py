from pipeline import *
from checker import checker
import math
cs=[];a={};H=4+.75*math.cos(math.pi/6)
def c(n,lo,hi,m,rotation=None):
 q={'name':n,'from':lo,'to':hi}
 if rotation:q.update(rotation=[rotation,0,0],origin=[0,H,0])
 cs.append(q);a[n]=(m,[],False)
c('north_roof',[-12,H,-8],[12,H+.75,0],'roof',-30)
c('south_roof',[-12,H,0],[7,H+.75,8],'roof',30)
c('broken_roof_tip',[7,H,0],[10,H+.75,3],'roof',30)
c('ridge_cap',[-12,H,-.6],[12,H+1,.6],'roof')
for x in [-9,7]:
 for side,lo,hi,angle in [('north',-8,0,-30),('south',0,8,30)]:c(f'rafter_{x}_{side}',[x-.5,H-.75,lo],[x+.5,H,hi],'wood',angle)
z=8*math.cos(math.pi/6)-.75*.5
c('gable_tie',[-9.5,0,-z],[-8.5,.75,z],'wood')
D=build('ruined_gazebo_roof',cs,a,{'wood':(0,0,'planks_spruce.png',32,32),'roof':(32,0,'deepslate_tiles.png',32,32)},{'reference':'https://acskalapacs.hu/acs','used':'pitched gable roof with exposed underside rafters and cross tie; shared gazebo construction reference','limitations':['detached collapsed roof fragment with missing corner and stepped broken edge','native deepslate roof tiles substitute reference roofing; original spruce rafters','no pack integration']},area='flat_flower')
for q in cs:
 if a[q['name']][0]!='wood':continue
 dx,dy,dz=[b-a for a,b in zip(q['from'],q['to'])]
 call('set_cube_uv',{'id':q['name'],'faces':{f:{'uv':[0,0,dz/4,dx/4],'rotation':90,'texture':'ruined_gazebo_roof'} for f in ['up','down']}})
dump(D/'uv_audit.json',[call('get_cube_uv',{'id':q['name']}) for q in cs])
checker(D,[0,2.5,0],[31,23,30]);views(D,[0,2.5,0],{'front':[36,12,0],'three_quarter':[31,23,30],'back':[-31,18,-30],'gameplay_scale':[50,33,48],'underside':[29,-13,24],'top':[0,48,1]})
print('Gazebo roof ready',flush=True)
