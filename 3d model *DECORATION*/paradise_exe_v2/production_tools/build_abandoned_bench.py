from pipeline import *
from checker import checker
cs=[];a={}
def c(n,lo,hi,m='wood',off=[],grain=False,rotation=None,origin=None):
 q={'name':n,'from':lo,'to':hi}
 if rotation:q.update(rotation=rotation,origin=origin)
 cs.append(q);a[n]=(m,off,grain)
for x in [-10.5,9.5]:
 c('front_leg_'+str(x),[x,0,-3.5],[x+1,6,-2.5],'metal',['up'])
 c('rear_leg_'+str(x),[x,0,2.5],[x+1,6,4.25],'metal',['up'])
 c('seat_support_'+str(x),[x,6,-3.5],[x+1,7,4.25],'metal')
 c('back_post_'+str(x),[x,7,3.5],[x+1,16.5,4.25],'metal',rotation=[12,0,0],origin=[0,7,3.5])
c('front_seat',[-12,7,-3.5],[12,8,-1.5])
c('rear_seat',[-12,7,1.5],[12,8,3.5])
c('broken_middle_left',[-12,7,-1],[-2,8,1])
c('broken_middle_right',[6,7,-1],[12,8,1])
c('loose_seat_piece',[-4,8,-1],[4,8.75,1],rotation=[0,28,0],origin=[0,8.375,0])
for y in [10,13]:c('back_board_'+str(y),[-12,y,3],[12,y+2,3.5],rotation=[12,0,0],origin=[0,7,3.5])
D=build('abandoned_bench',cs,a,{'wood':(0,0,'planks_spruce.png',32,32),'metal':(32,0,'concrete_gray.png')},{'reference':'https://primariagiurgiu.ro/2024/04/bancile-din-parcul-adiacent-casa-armatei-au-fost-vandalizate-la-putin-timp-dupa-ce-au-fost-reabilitate/','used':'slatted wooden bench with metal end supports, broken seat gap and loose plank resting across the seat','limitations':['square metal supports simplify ornate reference; armrests omitted','one missing middle-seat segment and its loose board indicate abandonment','original vanilla wood pixels; no custom wear, paint or graffiti','static furniture only']},area='flat_flower')
checker(D,[0,8,1],[30,24,-34]);views(D,[0,8,1],{'front':[0,21,-38],'three_quarter':[30,24,-34],'back':[-30,21,36],'gameplay_scale':[48,32,-61],'underside':[24,-9,-26],'seat_top':[0,36,-1]});views(D,[0,8,1],{'hero':[30,24,-34]},format='jpeg');print('Abandoned bench ready',flush=True)
