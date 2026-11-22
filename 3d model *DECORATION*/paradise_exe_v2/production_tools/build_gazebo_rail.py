from pipeline import *
from checker import checker
cs=[];a={}
def c(n,lo,hi,vertical=False,off=[]):cs.append({'name':n,'from':lo,'to':hi});a[n]=('wood',off,vertical)
c('left_post',[-12,0,-1],[-10,16,1],True)
c('broken_right_post',[10,0,-1],[12,13,1],True)
c('lower_rail',[-10,2,-.75],[10,3,.75],off=['east','west'])
c('broken_top_rail',[-10,14,-1],[8,16,1],off=['west'])
c('stepped_top_tip',[8,14,-1],[9.5,15,1],off=['west'])
for i,x in enumerate([-8,-4,4,7]):c('baluster_'+str(i),[x-.5,3,-.375],[x+.5,14,.375],True,['up','down'])
c('broken_baluster',[-.5,3,-.375],[.5,7,.375],True,['down'])
D=build('ruined_gazebo_rail',cs,a,{'wood':(0,0,'planks_spruce.png',32,32)},{'reference':'https://acskalapacs.hu/acs','used':'paired posts and horizontal rails with sparse vertical balusters; shared gazebo reference','limitations':['24-unit railing fragment; stepped broken top rail and short right post; missing center baluster','original spruce pixels unchanged; no pack integration']},area='flat_flower')
checker(D,[0,8,0],[31,22,-38]);views(D,[0,8,0],{'front':[0,15,-48],'three_quarter':[31,22,-38],'back':[-31,20,38],'gameplay_scale':[47,29,-60],'top':[0,44,-1]})
print('Gazebo rail ready',flush=True)
