from pipeline import *
from checker import checker
cs=[];a={}
def c(n,lo,hi,m,off=[],rot=False):cs.append({'name':n,'from':lo,'to':hi,'rotation':[12,0,0],'origin':[0,.16,.75]});a[n]=(m,off,rot)
for x in [-4,3]:
 c('rail_'+str(x),[x,1.16,0],[x+1,28.16,1.5],'rail',['down'],True)
 c('foot_'+str(x),[x,.16,0],[x+1,1.16,1.5],'rubber',['up'])
for y in range(3,27,3):c('rung_'+str(y),[-3,y+.16,.25],[3,y+.91,1.25],'tread',['east','west'])
D=build('tall_library_ladder',cs,a,{'rail':(0,0,'planks_spruce.png',32,32),'tread':(0,32,'planks_oak.png'),'rubber':(32,0,'concrete_black.png')},{'reference':'https://www.vaneldikladders.nl/bibliotheekladder.html','used':'narrow wooden rails, evenly spaced deep rungs and steep lean against shelving','limitations':['12 degree fixed lean and rubber foot caps','no rail rolling or climb behavior','place upper end against shelf or wall']})
checker(D,[0,14,3.5],[23,24,-37]);views(D,[0,14,3.5],{'front':[0,22,-45],'three_quarter':[23,24,-37],'back':[-23,24,45],'gameplay_scale':[44,34,-70],'side':[40,20,3.5]});print('Ladder ready')
