from pipeline import *
from checker import checker
import math
cs=[];a={}
def c(n,lo,hi,off=[],rotation=None,origin=None):
 q={'name':n,'from':lo,'to':hi}
 if rotation:q.update(rotation=rotation,origin=origin)
 cs.append(q);a[n]=('wood',off,False)
c('post',[-1,0,-1],[1,26,1],['up'])
c('header',[-10,26,-1],[6,28,1])
c('broken_header_end',[6,26,-1],[8,27,1],['west'])
c('return_header',[-1,26,1],[1,28,8],['north'])
c('broken_return_end',[-1,26,8],[1,27,10],['north'])
l=math.sqrt(85);ang=math.degrees(math.atan2(6,7))
c('knee_x',[-.5,19,-.5],[.5,19+l,.5],rotation=[0,0,-ang],origin=[0,19,0])
c('knee_z',[-.5,19,-.5],[.5,19+l,.5],rotation=[ang,0,0],origin=[0,19,0])
D=build('ruined_gazebo_post',cs,a,{'wood':(0,0,'planks_spruce.png',32,32)},{'reference':'https://acskalapacs.hu/acs','used':'timber corner post with perpendicular headers and diagonal knee braces; shared gazebo reference','limitations':['standalone 28-unit structural fragment; missing roof and stepped broken beam ends','original spruce pixels only; no painted damage or pack integration']},area='flat_flower')
for name,z in [('return_header',7),('broken_return_end',2)]:call('set_cube_uv',{'id':name,'faces':{f:{'uv':[0,0,z/4,.5],'rotation':90,'texture':'ruined_gazebo_post'} for f in ['up','down']}})
dump(D/'uv_audit.json',[call('get_cube_uv',{'id':q['name']}) for q in cs])
checker(D,[0,14,1],[35,26,-44]);views(D,[0,14,1],{'front':[0,22,-56],'three_quarter':[35,26,-44],'back':[-35,25,44],'gameplay_scale':[55,35,-72],'underside':[28,7,-32]})
print('Gazebo post ready',flush=True)
