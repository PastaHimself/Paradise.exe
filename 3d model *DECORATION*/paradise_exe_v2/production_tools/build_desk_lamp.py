from pipeline import *
from checker import checker
from variants import variant
cs=[];a={}
def c(n,lo,hi,m,off=[]):cs.append({'name':n,'from':lo,'to':hi});a[n]=(m,off,False)
c('base',[-2,0,-1.5],[2,.5,1.5],'brass')
c('stem',[-.35,.5,.5],[.35,4.75,1],'brass',['down','up'])
c('shade_top',[-3,5.75,-2],[3,6.5,1],'green')
c('shade_front',[-3,4.75,-2],[3,5.75,-1.75],'green',['up'])
c('shade_back',[-3,4.75,.75],[3,5.75,1],'green',['up'])
c('shade_left',[-3,4.75,-1.75],[-2.5,5.75,.75],'green',['up','north','south'])
c('shade_right',[2.5,4.75,-1.75],[3,5.75,.75],'green',['up','north','south'])
c('bulb',[-2.5,5.25,-1.5],[2.5,5.5,.5],'light',['east','west'])
D=build('desk_lamp',cs,a,{'brass':(0,0,'gold_block.png'),'green':(16,0,'concrete_green.png'),'light':(0,16,'glowstone.png')},{'reference':'https://www.nackabyggnadsvard.se/p/el-belysning/bordslampor/bankirlampa-massing-med-gron-skarm-bestallningsvara.html','used':'wide green downward shade, brass support and broad weighted base','limitations':['straight stem and squared shade simplify curved reference','lit/unlit appearance uses glowstone/concrete_gray pixels; runtime emitted light belongs to pack integration']})
checker(D,[0,3,0],[11,10,-15]);views(D,[0,3,0],{'front':[0,9,-16],'three_quarter':[11,10,-15],'back':[-11,9,15],'gameplay_scale':[24,18,-32],'underside':[9,-2,-12]});variant(D,'desk_lamp',(0,16),'concrete_gray.png',[0,3,0],[11,7,-15]);print('Desk lamp states ready')
