from pipeline import *
from checker import checker
from variants import variant
cs=[];a={}
def c(n,lo,hi,m,off=[]):cs.append({'name':n,'from':lo,'to':hi});a[n]=(m,off,False)
for z in [-3,1]:
 c('housing_'+str(z),[-12,.2,z],[12,1,z+2],'metal')
 c('diffuser_'+str(z),[-11.5,0,z+.25],[11.5,.2,z+1.75],'light',['up'])
for x in [-9,9]:
 c('crossbar_'+str(x),[x-.5,1,-3],[x+.5,1.5,3],'metal')
 c('pendant_'+str(x),[x-.125,1.5,-.125],[x+.125,9,.125],'stem',['up','down'])
 c('ceiling_plate_'+str(x),[x-1,9,-1],[x+1,9.5,1],'metal')
D=build('aisle_light',cs,a,{'metal':(0,0,'iron_block.png',32,16),'stem':(32,0,'concrete_silver.png'),'light':(0,32,'sea_lantern.png',32,16)},{'reference':'https://www.cooperlighting.com/global/brands/ametrix/134898/arrowlinear-fl-pendant-1-way-and-2-way','used':'two parallel linear housings, connecting arms, two pendant stems and ceiling plates','limitations':['rectangular cuboids simplify curved housings','lit/unlit sea_lantern/concrete_gray diffuse appearance; emitted light belongs to pack integration']})
checker(D,[0,4,0],[28,-9,-31]);views(D,[0,4,0],{'front':[0,-10,-39],'three_quarter':[28,-9,-31],'back':[-28,18,31],'gameplay_scale':[44,-20,-58],'underside':[12,-20,-24]});variant(D,'aisle_light',(0,32,32,16),'concrete_gray.png',[0,4,0],[28,-9,-31]);print('Aisle light states ready')
