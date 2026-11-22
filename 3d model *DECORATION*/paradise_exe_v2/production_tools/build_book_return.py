from pipeline import *
from checker import checker
cs=[];a={}
def c(n,lo,hi,m,off=[],rotation=None,origin=None):
 q={'name':n,'from':lo,'to':hi}
 if rotation:q.update(rotation=rotation,origin=origin)
 cs.append(q);a[n]=(m,off,False)
c('upper_plate',[-8,7,7.5],[8,10,8],'metal')
c('lower_plate',[-8,0,7.5],[8,3,8],'metal')
c('left_jamb',[-8,3,7.5],[-7,7,8],'metal',['up','down'])
c('right_jamb',[7,3,7.5],[8,7,8],'metal',['up','down'])
c('recess',[-7,3,9.25],[7,7,9.5],'dark')
c('inward_flap',[-6.9,3.1,7.8],[6.9,6.95,8],'gray',[],[-10,0,0],[0,7,8])
c('lower_lip',[-7,2.7,7],[7,3,7.5],'metal',['south'])
D=build('book_return_slot',cs,a,{'metal':(0,0,'iron_block.png'),'gray':(16,0,'concrete_silver.png'),'dark':(0,16,'concrete_black.png')},{'reference':'https://www.bibliorpl.com/en/through-wall/935-american-book-returns-hsu-interior-through-walls-return-faceplate.html','used':'rectangular through-wall faceplate, inset flap and shallow bottom lip','limitations':['blank upper/lower label areas','flap fixed slightly inward; no animation','rear cavity must be inset into wall by pack placement']})
checker(D,[0,5,8],[22,17,-20])
views(D,[0,5,8],{'front':[0,10,-23],'three_quarter':[22,17,-20],'back':[-18,14,35],'gameplay_scale':[30,22,-48]})
print('Book slot ready')
