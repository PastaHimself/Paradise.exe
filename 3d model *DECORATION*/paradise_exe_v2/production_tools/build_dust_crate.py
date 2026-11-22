from pipeline import *
from checker import checker
cs=[];a={}
def c(n,lo,hi,m,off=[],rot=False):cs.append({'name':n,'from':lo,'to':hi});a[n]=(m,off,rot)
c('body',[-6,0,-5],[6,7.5,5],'wood',['up'])
c('lid',[-6,7.5,-5],[6,8,5],'wood',['down'])
for x in [-4,3]:
 c('front_batten_'+str(x),[x,0,-5.25],[x+1,8,-5],'batten',['south'],True)
 c('rear_batten_'+str(x),[x,0,5],[x+1,8,5.25],'batten',['north'],True)
 c('lid_batten_'+str(x),[x,8,-5.25],[x+1,8.5,5.25],'batten',['down'])
for n,(x1,x2) in enumerate([(-6,-4),(-3,3),(4,6)]):c('dust_'+str(n),[x1,8,-5],[x2,8.0625,5],'dust',['down'])
D=build('dust_covered_crate',cs,a,{'wood':(0,0,'planks_spruce.png'),'batten':(16,0,'planks_oak.png'),'dust':(0,16,'concrete_powder_silver.png')},{'reference':'https://www.la-sceno.com/decors-cuba/955-caisse-en-bois.html','used':'closed plank shipping crate reinforced by two vertical battens continuing across lid','limitations':['dust represented by thin original concrete_powder_silver surface in lid recesses','no custom weathering or markings','closed static crate; disposable test projects untouched']})
checker(D,[0,4,0],[20,17,-25]);views(D,[0,4,0],{'front':[0,13,-27],'three_quarter':[20,17,-25],'back':[-20,15,25],'gameplay_scale':[34,25,-48],'top':[0,32,-1]});print('Dust crate ready')
