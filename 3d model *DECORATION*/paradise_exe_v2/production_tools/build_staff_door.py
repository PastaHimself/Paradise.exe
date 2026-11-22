from pipeline import *
from checker import checker
from glyphs import lettering
cs=[];a={}
def c(n,lo,hi,m,off=[],rot=False):cs.append({'name':n,'from':lo,'to':hi});a[n]=(m,off,rot)
c('left_frame',[-8,0,7],[-7,30,9],'frame',[],True)
c('right_frame',[7,0,7],[8,30,9],'frame',[],True)
c('head_frame',[-7,29,7],[7,30,9],'frame',['east','west'])
c('leaf',[-7,.125,7.5],[7,28.875,8.5],'wood',[],True)
c('front_escutcheon',[5.25,12,7.35],[6.25,14.5,7.5],'metal',['south'])
c('front_lever',[4.25,13,7.1],[6,13.375,7.35],'metal',['south'])
c('rear_escutcheon',[5.25,12,8.5],[6.25,14.5,8.65],'metal',['north'])
c('rear_lever',[4.25,13,8.65],[6,13.375,8.9],'metal',['north'])
c('kick_plate',[-6.75,.5,7.475],[6.75,3,7.5],'metal',['south'])
c('plaque',[-3,21,7.4],[3,23,7.5],'paper',['south'])
lettering(cs,a,'STAFF',.25,21.375,7.4)
D=build('staff_door',cs,a,{'frame':(0,0,'planks_big_oak.png',32,32),'wood':(32,0,'planks_spruce.png',32,32),'metal':(0,32,'iron_block.png'),'paper':(32,32,'quartz_block_side.png'),'ink':(16,32,'concrete_black.png')},{'reference':'https://forest-bright.en.made-in-china.com/product/edhAIMuCfaDb/China-Multi-Color-Fire-Rated-Solid-Interior-Flush-Wooden-Door-with-Competitive-Price.html','used':'flush wood leaf in frame, lever hardware, eye-level staff plaque and metal kick plate','limitations':['STAFF lettering is geometry using unchanged black vanilla material','static closed door; 30 unit height fits Bedrock block model limit','no door behavior or collision integration']})
checker(D,[0,15,8],[30,27,-40]);views(D,[0,15,8],{'front':[0,22,-46],'three_quarter':[30,27,-40],'back':[-30,25,54],'gameplay_scale':[48,35,-68],'plaque_close':[0,22,-3]});print('Staff door ready')
