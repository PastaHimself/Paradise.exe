from pipeline import *
from checker import checker
cs=[];a={}
def book(n,w,d,y,h,color,angle,cx,cz):
 def c(part,lo,hi,m,off=[]):
  cs.append({'name':n+'_'+part,'from':[lo[0]+cx,lo[1],lo[2]+cz],'to':[hi[0]+cx,hi[1],hi[2]+cz],'origin':[cx,y,cz],'rotation':[0,angle,0]});a[n+'_'+part]=(m,off,False)
 c('lower_cover',[-w/2,y,-d/2],[w/2,y+.125,d/2],color)
 c('upper_cover',[-w/2,y+h-.125,-d/2],[w/2,y+h,d/2],color)
 c('pages',[-w/2+.125,y+.125,-d/2+.125],[w/2-.125,y+h-.125,d/2-.25],'paper',['up','down','south'])
 c('spine',[-w/2,y+.125,d/2-.25],[w/2,y+h-.125,d/2],color,['up','down','north'])
book('bottom',7,5,0,1.5,'red',0,0,0)
book('middle',6.5,4.75,1.5,1.25,'blue',8,.2,0)
book('top',6,4.5,2.75,1.25,'green',-6,-.2,.1)
D=build('book_stacks',cs,a,{'paper':(0,0,'quartz_block_side.png'),'red':(16,0,'wool_colored_red.png'),'blue':(0,16,'wool_colored_blue.png'),'green':(16,16,'wool_colored_green.png')},{'reference':'https://www.ebay.com/itm/135903409133','used':'stacked hardbacks with recessed page edges, projecting covers and slight misalignment','limitations':['three closed books; blank cloth covers and spines','no custom titles or weathering pixels']})
checker(D,[0,2,0],[12,10,-16]);views(D,[0,2,0],{'front':[0,8,-17],'three_quarter':[12,10,-16],'back':[-12,9,16],'gameplay_scale':[26,18,-34],'top':[0,22,-1]});print('Book stack ready')
