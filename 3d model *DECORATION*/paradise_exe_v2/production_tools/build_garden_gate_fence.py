from pipeline import *
from checker import checker
import sys,math
mode=sys.argv[1];folder='standalone_garden_gate' if mode=='gate' else 'broken_picket_fence';cs=[];a={}
def c(n,lo,hi,m='wood',off=[],grain=False,rotation=None,origin=None):
 q={'name':n,'from':lo,'to':hi}
 if rotation:q.update(rotation=rotation,origin=origin)
 cs.append(q);a[n]=(m,off,grain)
for x in [-8,6.5]:c('post_'+str(x),[x,0,-.75],[x+1.5,28,.75],'post',grain=True)
for y in [5,13,22]:c('rail_'+str(y),[-6 if mode=='gate' else -6.5,y,-.5],[6 if mode=='gate' else 6.5,y+1,.5],off=[] if mode=='gate' else ['east','west'])
if mode=='gate':
 for x in [-5.75,-3.25,-.75,1.75,4.25]:c('picket_'+str(x),[x,1,-.75],[x+1.5,26,-.5],grain=True)
 length=math.sqrt(10*10+17*17);angle=-math.degrees(math.atan2(10,17))
 c('diagonal_brace',[-5.375,5.5,.5],[-4.625,5.5+length,1],grain=True,rotation=[0,0,angle],origin=[-5,5.5,.75])
 for y in [5,22]:c('hinge_'+str(y),[-7,y,-.95],[-4.5,y+.5,-.75],'metal',['south'])
 c('latch',[5,13,-.95],[6.95,13.5,-.75],'metal',['south'])
else:
 for x in [-5.75,-3.25,1.75]:c('standing_picket_'+str(x),[x,1,-.75],[x+1.5,26,-.5],grain=True)
 c('broken_left',[-.75,1,-.75],[0,6.5,-.5],grain=True)
 c('broken_right',[0,1,-.75],[.75,5.75,-.5],grain=True)
 c('fallen_upper_picket',[-10,0,-4],[10,.25,-2.5],rotation=[0,12,0],origin=[0,.125,-3.25])
D=build(folder,cs,a,{'post':(0,0,'planks_spruce.png',32,32),'wood':(32,0,'planks_oak.png',32,32),'metal':(0,32,'iron_block.png')},{'reference':'https://www.ruby-group.co.uk/products/copy-of-featheredge-garden-gate-green-brown','used':'flat-topped vertical pickets, horizontal rails and diagonal rear brace; matching construction reused for fence section','limitations':['static closed freestanding gate with two posts and visible hardware' if mode=='gate' else 'one stepped broken stump, one absent picket and a fallen upper board; fallen board intentionally overhangs fence width','original wood pixels unchanged; damage is geometry only','no swing, collision or pack integration']},area='flat_flower')
checker(D,[0,14,0],[29,28,-44]);views(D,[0,14,0],{'front':[0,22,-49],'three_quarter':[29,28,-44],'back':[-29,25,44],'gameplay_scale':[47,36,-72]});print(mode+' garden kit piece ready',flush=True)
