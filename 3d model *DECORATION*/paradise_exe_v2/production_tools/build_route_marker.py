from pipeline import *
from checker import checker
import sys
mode=sys.argv[1];folder={'true':'true_route_marker','decoy_one':'decoy_marker_one','decoy_two':'decoy_marker_two'}[mode];cs=[];a={}
def c(n,lo,hi,m,off=[],grain=False,angle=0):
 q={'name':n,'from':lo,'to':hi}
 if angle:q.update(origin=[0,24,0],rotation=[0,0,angle])
 cs.append(q);a[n]=(m,off,grain)
c('post',[-.75,0,-.75],[.75,21 if mode=='decoy_two' else 20,.75],'post',[],True)
if mode=='decoy_one':c('solid_diamond',[-3,21,-.5],[3,27,.5],'head',angle=45)
else:
 angle=45 if mode=='true' else 0
 c('left_edge',[-3,21,-.5],[-2,27,.5],'head',grain=True,angle=angle)
 c('right_edge',[2,21,-.5],[3,27,.5],'head',grain=True,angle=angle)
 c('bottom_edge',[-2,21,-.5],[2,22,.5],'head',['east','west'],angle=angle)
 c('top_edge',[-2,26,-.5],[2,27,.5],'head',['east','west'],angle=angle)
D=build(folder,cs,a,{'post':(0,0,'planks_spruce.png',32,32),'head':(32,0,'planks_acacia.png')},{'reference':'https://inthewoodsdear.fi/outdoors/sipoonkorpi-national-park-lake-fisktrask/','used':'wooden trail post and diamond marker proportions; requested cutout design replaces printed symbols','limitations':[{'true':'true marker uses an open diamond head','decoy_one':'decoy one repeats diamond silhouette with solid filled head','decoy_two':'decoy two uses an upright square opening'}[mode],'all three markers share identical vanilla materials; recognition comes from shape','static prop; no route logic, placement rules or collision integration']},area='flat_flower')
checker(D,[0,14,0],[26,26,-43]);views(D,[0,14,0],{'front':[0,22,-48],'three_quarter':[26,26,-43],'back':[-26,24,43],'gameplay_scale':[44,35,-70]});views(D,[0,24,0],{'head_close':[0,24,-17]});print(mode+' marker ready',flush=True)
