from pipeline import *
from checker import checker
cs=[];a={}
def c(n,lo,hi,m='wood',off=[],rot=False,lean=False):
 q={'name':n,'from':lo,'to':hi}
 if lean:q.update(origin=[0,6,2.5],rotation=[12,0,0])
 cs.append(q);a[n]=(m,off,rot)
c('seat',[-4,6,-4],[4,7,2.5],'seat')
for x in [-4,2.75]:
 c('front_leg_'+str(x),[x,0,-4],[x+1.25,6,-2.75],off=['up'],rot=True)
 c('rear_leg_'+str(x),[x,0,2.5],[x+1.25,6,4],off=['up'],rot=True)
 c('back_post_'+str(x),[x,6,2.5],[x+1.25,15,4],off=['down'],rot=True,lean=True)
 c('side_stretcher_'+str(x),[x,2.75,-2.75],[x+1.25,3.5,2.5],off=['north','south'])
c('back_panel',[-2.75,10,2.75],[2.75,14.5,3.75],'seat',['east','west'],False,True)
D=build('reading_chair',cs,a,{'wood':(0,0,'planks_spruce.png'),'seat':(16,0,'planks_oak.png')},{'reference':'https://www.bookcover.jp/shopdetail/000000006103/','used':'solid wood seat, broad plywood back leaning rearward, paired side stretchers','limitations':['square legs and solid uncurved seat simplify reference','static furniture; no sitting interaction']})
checker(D,[0,7,0],[20,17,-25]);views(D,[0,7,0],{'front':[0,13,-28],'three_quarter':[20,17,-25],'back':[-20,16,28],'gameplay_scale':[36,25,-48],'side':[30,12,0]});print('Reading chair ready')
