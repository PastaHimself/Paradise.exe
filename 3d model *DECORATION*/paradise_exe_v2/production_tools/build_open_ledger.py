from pipeline import *
from checker import checker
cs=[];a={}
def c(n,lo,hi,m,off=[],angle=0):cs.append({'name':n,'from':lo,'to':hi,'origin':[0,.125,0],'rotation':[0,0,angle]});a[n]=(m,off,False)
c('left_cover',[-4,0,-3],[0,.125,3],'cover',[], -8)
c('right_cover',[0,0,-3],[4,.125,3],'cover',[],8)
c('left_pages',[-3.875,.125,-2.875],[-.125,.625,2.875],'paper',['down'],-8)
c('right_pages',[.125,.125,-2.875],[3.875,.625,2.875],'paper',['down'],8)
c('binding',[-.125,0,-3],[.125,.3,3],'spine')
D=build('open_ledger',cs,a,{'cover':(0,0,'wool_colored_brown.png'),'paper':(16,0,'quartz_block_side.png'),'spine':(0,16,'concrete_brown.png')},{'reference':'https://amhistory.si.edu/american-enterprise/merchant-ledger/','used':'wide open spread, recessed page edges, thick binding and projecting cover edges','limitations':['blank pages; exact ledger ruling, writing and age stains unavailable under original-pixel rules','static open spread']})
checker(D,[0,.5,0],[12,9,-15]);views(D,[0,.5,0],{'front':[0,7,-15],'three_quarter':[12,9,-15],'back':[-12,8,15],'gameplay_scale':[25,20,-32],'top':[0,20,-1]});print('Ledger ready')
