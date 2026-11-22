from pipeline import *
from checker import checker
cs=[];a={}
for n,(x,z,y,angle) in enumerate([(-.5,0,0,-16),(.5,.25,.0625,12),(0,-.3,.125,-4)]):
 name='sheet_'+str(n);cs.append({'name':name,'from':[x-1.75,y,z-2.5],'to':[x+1.75,y+.0625,z+2.5],'origin':[x,y,z],'rotation':[0,angle,0]});a[name]=('paper',[],False)
D=build('loose_papers',cs,a,{'paper':(0,0,'quartz_block_side.png')},{'reference':'https://www.pixelsquid.com/png/scattered-paper-3493347090795336991','used':'overlapping blank sheets at different angles, crisp rectangular edges','limitations':['three blank sheets in one shallow fan','thickness exaggerated to 1/16 model unit for readable edges','no custom print or stains']})
checker(D,[0,.1,0],[9,9,-12]);views(D,[0,.1,0],{'front':[0,7,-12],'three_quarter':[9,9,-12],'back':[-9,8,12],'gameplay_scale':[22,20,-30],'top':[0,17,-1]});print('Papers ready')
