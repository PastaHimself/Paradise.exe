from pipeline import *
from checker import checker
cs=[];a={}
def c(n,lo,hi,m,off=[],rot=False):cs.append({'name':n,'from':lo,'to':hi});a[n]=(m,off,rot)
c('tabletop',[-14,11,-7],[14,12,7],'top')
for x in [-12,10]:
 for z in [-6,4]:c(f'leg_{x}_{z}',[x,0,z],[x+2,11,z+2],'frame',['up'],True)
for z in [-6,5]:c('long_apron_'+str(z),[-10,8.5,z],[10,11,z+1],'frame',['up','west','east'])
for x in [-12,11]:c('end_apron_'+str(x),[x,8.5,-4],[x+1,11,4],'frame',['up','north','south'])
D=build('reading_table',cs,a,{'top':(0,0,'planks_oak.png',32,32),'frame':(32,0,'planks_spruce.png',32,32)},{'reference':'https://www.rbxhub.com/products/vintage-library-table','used':'broad rectangular top, square legs and deep apron; simplified plain joinery','limitations':['single static reading table','vanilla plank grain; carved ornament omitted']})
checker(D,[0,6,0],[30,25,-35]);views(D,[0,6,0],{'front':[0,20,-40],'three_quarter':[30,25,-35],'back':[-30,22,35],'gameplay_scale':[48,32,-62],'underside':[24,-12,-28]});print('Reading table ready')
