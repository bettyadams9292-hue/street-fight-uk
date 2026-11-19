/** Street Fight UK — isolated Gym, Security & Neighbourhood Props.
 * Units metres, Y-up, front faces +Z. No game imports or registrations.
 * Use createExpansionAsset(id). userData.tags includes 'poor' for decay props.
 */
import * as THREE from 'three';
export const EXPANSION_ASSETS = [
{id:'hexDumbbell10',label:'10 kg hex dumbbell',category:'gym'},
{id:'hexDumbbell20',label:'20 kg hex dumbbell',category:'gym'},
{id:'dumbbellRack',label:'Commercial dumbbell rack',category:'gym'},
{id:'olympicBar20kg',label:'20 kg Olympic bar — shop item',category:'gym',weightKg:20,storeItem:true},
{id:'plate2_5kg',label:'2.5 kg Olympic plate — shop item',category:'gym',weightKg:2.5,storeItem:true},
{id:'plate5kg',label:'5 kg Olympic plate — shop item',category:'gym',weightKg:5,storeItem:true},
{id:'plate10kg',label:'10 kg Olympic plate — shop item',category:'gym',weightKg:10,storeItem:true},
{id:'plate15kg',label:'15 kg Olympic plate — shop item',category:'gym',weightKg:15,storeItem:true},
{id:'plate20kg',label:'20 kg Olympic plate — shop item',category:'gym',weightKg:20,storeItem:true},
{id:'plate25kg',label:'25 kg Olympic plate — shop item',category:'gym',weightKg:25,storeItem:true},
{id:'olympicCollar',label:'Olympic bar collar — shop item',category:'gym',storeItem:true},
{id:'olympicBarbell',label:'Olympic barbell',category:'gym'},
{id:'loadedBarbell',label:'Loaded bumper-plate barbell',category:'gym'},
{id:'barbell40kg',label:'Olympic barbell — 40 kg',category:'gym',weightKg:40,minStrengthLevel:1},
{id:'barbell60kg',label:'Olympic barbell — 60 kg',category:'gym',weightKg:60,minStrengthLevel:2},
{id:'barbell80kg',label:'Olympic barbell — 80 kg',category:'gym',weightKg:80,minStrengthLevel:3},
{id:'barbell100kg',label:'Olympic barbell — 100 kg',category:'gym',weightKg:100,minStrengthLevel:4},
{id:'barbell120kg',label:'Olympic barbell — 120 kg',category:'gym',weightKg:120,minStrengthLevel:5},
{id:'barbell140kg',label:'Olympic barbell — 140 kg',category:'gym',weightKg:140,minStrengthLevel:6},
{id:'barbell160kg',label:'Olympic barbell — 160 kg',category:'gym',weightKg:160,minStrengthLevel:7},
{id:'barbell180kg',label:'Olympic barbell — 180 kg',category:'gym',weightKg:180,minStrengthLevel:8},
{id:'barbell200kg',label:'Olympic barbell — 200 kg',category:'gym',weightKg:200,minStrengthLevel:9},
{id:'squatRack',label:'Adjustable squat rack',category:'gym'},
{id:'gymMirror',label:'Full-height gym wall mirror',category:'gym'},
{id:'exerciseBike',label:'Studio exercise bike',category:'gym'},
{id:'boxingRing',label:'Professional four-rope boxing ring',category:'gym'},
{id:'palisadeFence',label:'Galvanised palisade fence',category:'fence'},
{id:'palisadeGate',label:'Lockable palisade gate',category:'fence'},
{id:'chainLinkFence',label:'Galvanised chain-link fence',category:'fence'},
{id:'chainLinkGate',label:'Chain-link pedestrian gate',category:'fence'},
{id:'timberFence',label:'Close-board timber fence',category:'fence'},
{id:'poorTimberFence',label:'Damaged missing-board timber fence',category:'fence',tags:['poor']},
{id:'poorChainLinkFence',label:'Sagging damaged chain-link fence',category:'fence',tags:['poor']},
{id:'poorPalisadeGate',label:'Bent rusted palisade gate',category:'fence',tags:['poor']},
{id:'poorTimberGate',label:'Broken timber gate',category:'fence',tags:['poor']},
{id:'safeSmall',label:'Compact digital safe',category:'safe'},
{id:'safeMedium',label:'Medium combination safe',category:'safe'},
{id:'safeLarge',label:'Large commercial safe',category:'safe'},
{id:'poorSafe',label:'Battered neglected safe',category:'safe',tags:['poor']},
] as const;
export type ExpansionAssetId=typeof EXPANSION_ASSETS[number]['id'];
const M=(c:number,metal=.05,rough=.65)=>new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:rough});
const graphite=0x292d32,steel=0x596168,silver=0xaab0b4,rubber=0x16191d,wood=0x8c6845,red=0xb53537;
export function createExpansionAsset(id:ExpansionAssetId):THREE.Group{
 const entry=EXPANSION_ASSETS.find(a=>a.id===id);if(!entry)throw Error('Unknown asset '+id);
 const g=new THREE.Group();g.name='SFUK_EXP_'+id;
 return buildExpansionV2(g,id,entry);
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,c:number,metal=0)=>{
   const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),M(c,metal));o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;};
 const cyl=(radius:number,h:number,x:number,y:number,z:number,c:number,segments=24,metal=.35)=>{
   const o=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,h,segments),M(c,metal,.48));o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
 const rod=(a:[number,number,number],b:[number,number,number],r:number,c:number,metal=.55)=>{
   const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),v=q.clone().sub(p);
   const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),12),M(c,metal,.45));
   o.position.copy(p.add(q).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());o.castShadow=true;g.add(o);return o;};
 const disk=(r:number,th:number,x:number,y:number,z:number,c:number)=>{
   const o=cyl(r,th,x,y,z,c,32,.25);o.rotation.z=Math.PI/2;return o;};
 const label=(value:string,w:number,h:number,x:number,y:number,z:number,bg='#eeeeea',fg='#222629')=>{
   if(typeof document==='undefined')return;
   const can=document.createElement('canvas');can.width=512;can.height=256;
   const ctx=can.getContext('2d');if(!ctx)return;
   ctx.fillStyle=bg;ctx.fillRect(0,0,512,256);ctx.fillStyle=fg;ctx.font='bold 68px Arial';
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(value,256,128,480);
   const tex=new THREE.CanvasTexture(can);tex.colorSpace=THREE.SRGBColorSpace;
   const o=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
   o.position.set(x,y,z);g.add(o);};
 const dumbbell=(x:number,z:number,kg:number)=>{
   rod([x-.18,.15,z],[x+.18,.15,z],.023,silver,.8);
   for(const dx of [-.135,.135]){const o=cyl(kg===20?.115:.09,.105,x+dx,.15,z,rubber,6,.1);o.rotation.z=Math.PI/2;}
 };
 const barbell=(loaded:boolean,y=.19)=>{
   rod([-1.1,y,0],[1.1,y,0],.014,silver,.85);
   for(const sign of [-1,1]){
     rod([sign*.68,y,0],[sign*1.08,y,0],.023,silver,.8);
     if(loaded){
       for(const [i,r,c] of [[0,.215,0xe95b36],[1,.195,0x3472b8],[2,.16,0x56a64b]] as const){
         const o=cyl(r,.065,sign*(.79+i*.075),y,0,c,40,.08);o.rotation.z=Math.PI/2;
       }
       const collar=cyl(.05,.055,sign*1.06,y,0,graphite);collar.rotation.z=Math.PI/2;
     }
   }
 };
 if(id==='hexDumbbell10'||id==='hexDumbbell20')dumbbell(0,0,id==='hexDumbbell20'?20:10);
 if(id==='dumbbellRack'){
   for(const x of [-.85,.85]){rod([x,0,-.34],[x,.95,-.16],.04,graphite);rod([x,0,.34],[x,.95,.16],.04,graphite);}
   for(const y of [.43,.84])for(const z of [-.16,.16])box(1.85,.045,.08,0,y,z,steel,.6);
   for(let i=0;i<5;i++)dumbbell(-.68+i*.34,.08,i>2?20:10);
 }
 if(id==='olympicBarbell')barbell(false);
 if(id==='loadedBarbell')barbell(true,.235);
 if(id==='squatRack'){
   for(const x of [-.88,.88]){
     box(.10,2.30,.10,x,1.15,0,graphite,.7);
     box(.12,.08,1.20,x,.04,.12,graphite,.7);
     for(let i=0;i<17;i++)box(.012,.022,.012,x+(x>0?-.058:.058),.46+i*.095,.054,rubber);
     box(.21,.09,.27,x,1.35,.18,steel,.6);
     rod([x,.18,-.45],[x,2.25,-.45],.022,graphite);
   }
   rod([-.88,2.27,-.45],[.88,2.27,-.45],.03,graphite);
   rod([-.88,2.27,-.45],[-.55,2.38,-.45],.025,graphite);
   rod([.88,2.27,-.45],[.55,2.38,-.45],.025,graphite);
   rod([-.88,1.37,.18],[.88,1.37,.18],.023,silver,.8);
 }
 if(id==='gymMirror'){
   box(2.05,2.10,.045,0,1.08,0,graphite,.6);
   const mirror=new THREE.Mesh(new THREE.PlaneGeometry(1.94,1.98),
     new THREE.MeshPhysicalMaterial({color:0xcbd9df,metalness:.85,roughness:.06,clearcoat:1,side:THREE.DoubleSide}));
   mirror.position.set(0,1.08,.029);g.add(mirror);
   for(const x of [-.99,.99])box(.018,2.08,.06,x,1.08,.03,silver,.7);
   for(const y of [.04,2.12])box(2.03,.018,.06,0,y,.03,silver,.7);
 }
 if(id==='exerciseBike'){
   for(const z of [-.37,.40])rod([-.45,.06,z],[.49,.06,z],.035,graphite);
   rod([-.25,.06,0],[.20,1.10,0],.075,graphite);
   rod([.20,1.10,0],[.52,1.42,0],.062,graphite);
   const fly=cyl(.34,.10,.28,.52,0,graphite,48,.55);fly.rotation.z=Math.PI/2;
   const flyInner=cyl(.27,.115,.28,.52,0,steel,48,.6);flyInner.rotation.z=Math.PI/2;
   rod([-.40,.07,0],[-.40,1.12,0],.045,graphite);
   box(.36,.085,.24,-.42,1.17,0,rubber);
   rod([.48,1.38,-.35],[.48,1.38,.35],.027,graphite);
   for(const z of [-.35,.35])rod([.48,1.38,z],[.65,1.26,z],.03,rubber);
   rod([-.20,.38,0],[.17,.38,0],.03,graphite);
   for(const x of [-.22,.17])box(.15,.04,.10,x,.28,x>0?.17:-.17,rubber);
   box(.24,.16,.10,.51,1.52,0,graphite);
 }
 if(id==='boxingRing'){
   const half=2.4;
   box(5,.38,5,0,.39,0,graphite);box(4.85,.075,4.85,0,.62,0,0x326fa2);
   for(const x of [-half,half])for(const z of [-half,half]){
     box(.12,1.95,.12,x,1.39,z,graphite,.6);
     box(.22,.34,.22,x,1.36,z,x===-half?red:0x2368b4);
   }
   for(const y of [.93,1.20,1.47,1.74]){
     for(const z of [-half,half])rod([-half,y,z],[half,y,z],.025,y===1.74?0xf0eeee:0xc9cdd0);
     for(const x of [-half,half])rod([x,y,-half],[x,y,half],.025,y===1.74?0xf0eeee:0xc9cdd0);
   }
   for(let i=0;i<3;i++)box(.65,.11,.32,-2.80+i*.37,.14,2.6,steel);
 }
 const palisade=(gate:boolean,poor:boolean)=>{
   const width=gate?1.65:3,spacing=gate?.165:.17,n=Math.floor(width/spacing);
   for(const x of [-width/2,width/2])box(.085,2.15,.085,x,1.075,0,poor?0x705e50:steel,.7);
   for(const y of [.36,1.78])box(width,.065,.075,0,y,0,poor?0x755e4d:silver,.65);
   for(let i=0;i<=n;i++){
     if(poor&&i===3)continue;
     const x=-width/2+i*width/n;
     const tilt=poor&&i===n-2?.14:0;
     const pick=box(.056,1.83,.045,x,1.00,.035,poor&&i%3===0?0x795e4b:0x9ca4a7,.6);
     pick.rotation.z=tilt;
     const tip=new THREE.Mesh(new THREE.ConeGeometry(.047,.15,4),M(poor?0x846b57:0xa8b0b4,.65,.55));
     tip.position.set(x,1.99,.035);tip.rotation.y=Math.PI/4;g.add(tip);
   }
   if(gate){
     box(.045,.15,.10,width/2-.12,1.12,.12,graphite);
     for(const y of [.38,1.74])box(.12,.08,.18,-width/2,y,.08,graphite);
   }
 };
 const chain=(gate:boolean,poor:boolean)=>{
   const w=gate?1.45:3,h=1.90;
   for(const x of [-w/2,w/2])rod([x,0,0],[x,h+.16,0],.045,steel);
   for(const y of [.20,h])rod([-w/2,y,0],[w/2,y,0],.024,steel);
   // Actual diamond mesh, not a solid grey panel. Limit line count for mobile.
   const pitch=.17;
   for(let t=-h;t<w+h;t+=pitch){
     const ptsA:[number,number,number][]=[];
     const ptsB:[number,number,number][]=[];
     for(let x=-w/2;x<=w/2;x+=.04){
       const ya=(x+w/2)*1.0+t, yb=-(x+w/2)*1.0+t;
       if(ya>.2&&ya<h)ptsA.push([x,poor?ya-.04*Math.sin(x*6):ya,.008]);
       if(yb>.2&&yb<h)ptsB.push([x,yb,.008]);
     }
     for(const pts of [ptsA,ptsB])if(pts.length>1)rod(pts[0],pts[pts.length-1],.004,poor?0x8b8579:0xb5b9b8,.65);
   }
   if(gate){box(.08,.15,.08,w/2-.11,1.04,.11,graphite);for(const y of [.35,1.67])box(.10,.07,.15,-w/2,y,.10,steel);}
 };
 const timber=(poor:boolean,gate:boolean)=>{
   const w=gate?1.1:2.7;
   for(const x of [-w/2,w/2])box(.10,1.85,.12,x,.925,-.07,poor?0x655442:0x76583d);
   for(const y of [.35,1.45])box(w,.085,.09,0,y,-.09,poor?0x594d40:0x765b44);
   const count=gate?9:21;
   for(let i=0;i<count;i++){
     if(poor&&[2,5,6,12,17].includes(i))continue;
     const x=-w/2+(i+.5)*w/count;
     const height=poor&&i%5===0?1.22:poor&&i%7===0?1.50:1.78;
     const o=box(w/count-.008,height,.038,x,height/2,.04,poor&&i%3===0?0x625143:wood);
     if(poor&&i%4===0)o.rotation.z=.07;
   }
   if(gate)box(.07,.12,.09,w/2-.18,1.00,.11,graphite);
 };
 if(id==='palisadeFence')palisade(false,false);
 if(id==='palisadeGate')palisade(true,false);
 if(id==='poorPalisadeGate')palisade(true,true);
 if(id==='chainLinkFence')chain(false,false);
 if(id==='chainLinkGate')chain(true,false);
 if(id==='poorChainLinkFence')chain(false,true);
 if(id==='timberFence')timber(false,false);
 if(id==='poorTimberFence')timber(true,false);
 if(id==='poorTimberGate')timber(true,true);
 if(id.startsWith('safe')||id==='poorSafe'){
   const scale=id==='safeSmall'?.55:id==='safeMedium'?.82:id==='safeLarge'?1.28:.90;
   const poor=id==='poorSafe',c=poor?0x77706a:0xa0a4a7;
   box(scale,.98*scale,.80*scale,0,.49*scale,0,c,.55);
   box(scale*.83,.82*scale,.025,0,.52*scale,.413*scale,poor?0x6d6963:0xd0d3d4,.6);
   for(const y of [.30,.52,.74])cyl(.029*scale,.025*scale,scale*.32,y*scale,.433*scale,silver,16,.8).rotation.x=Math.PI/2;
   const dial=cyl(.12*scale,.04*scale,scale*.19,.61*scale,.44*scale,graphite,32,.65);dial.rotation.x=Math.PI/2;
   for(let i=0;i<12;i++){
     const a=i*Math.PI/6;
     const btn=cyl(.012*scale,.008*scale,scale*(.19+Math.sin(a)*.075),scale*(.61+Math.cos(a)*.075),scale*.466,silver,12,.5);
     btn.rotation.x=Math.PI/2;
   }
   rod([-.12*scale,.48*scale,.45*scale],[.07*scale,.48*scale,.45*scale],.025*scale,silver);
   for(const y of [.12,.90])box(scale*.90,.022,.02,0,y*scale,.416*scale,poor?0x514c49:steel);
   if(poor)for(let i=0;i<6;i++)box(.10*scale,.018,.015,(-.32+i*.12)*scale,(.23+i%3*.20)*scale,.438*scale,0x5d4d43);
 }
 g.updateMatrixWorld(true);
 const bb=new THREE.Box3().setFromObject(g);
 if(Number.isFinite(bb.min.y)&&Math.abs(bb.min.y)>.001)for(const child of g.children)child.position.y-=bb.min.y;
 g.userData={collection:'SFUK_expansion',standalone:true,id,category:entry.category,
   tags:('tags' in entry?[...entry.tags]:[]),districtTags:('tags' in entry?[...entry.tags]:[]),
   units:'metres',pivot:'ground-centre',referenceInspired:true};
 return g;
}
export function auditExpansionAsset(g:THREE.Group){
 let meshes=0,triangles=0;g.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;const a=o.geometry;triangles+=a.index?a.index.count/3:a.attributes.position.count/3;}});
 const size=new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
 return {meshes,triangles:Math.round(triangles),width:+size.x.toFixed(2),height:+size.y.toFixed(2),depth:+size.z.toFixed(2)};
}

/** Expansion V2: clean replacement geometry. Deliberately bypasses V1 builders.
 * Each part is physically connected and shares a restrained PBR palette.
 */
function buildExpansionV2(g:THREE.Group,id:ExpansionAssetId,entry:typeof EXPANSION_ASSETS[number]):THREE.Group{
 const mat=(c:number,metal=.1,rough=.58)=>new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:rough});
 const graphite=mat(0x252a30,.65,.38),black=mat(0x121619,.12,.8),rubber=mat(0x1d2024,.04,.9),
  brushed=mat(0x8e969a,.75,.34),zinc=mat(0x9fa8aa,.8,.48),red=mat(0xb52e32,.28,.47),
  blue=mat(0x2467a5,.2,.6),wood=mat(0x87684b,.03,.85),oldWood=mat(0x6a5b4b,.04,.96),
  rust=mat(0x765242,.3,.9),white=mat(0xe2e5e3,.04,.7);
 const B=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material)=>{
  const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
 const C=(r:number,h:number,x:number,y:number,z:number,m:THREE.Material,seg=24)=>{
  const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg),m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
 const R=(a:[number,number,number],b:[number,number,number],r:number,m:THREE.Material)=>{
  const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),v=q.clone().sub(p);
  const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),12),m);
  o.position.copy(p.add(q).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());o.castShadow=true;g.add(o);return o;};
 const disc=(x:number,y:number,z:number,r:number,t:number,m:THREE.Material)=>{
  const o=C(r,t,x,y,z,m,40);o.rotation.z=Math.PI/2;return o;};
 const sphere=(x:number,y:number,z:number,r:number,m:THREE.Material)=>{
  const o=new THREE.Mesh(new THREE.SphereGeometry(r,16,10),m);o.position.set(x,y,z);g.add(o);return o;};
 const decal=(txt:string,w:number,h:number,x:number,y:number,z:number,bg:string,fg:string,rot=0)=>{
  if(typeof document==='undefined')return;
  const can=document.createElement('canvas');can.width=512;can.height=128;
  const ctx=can.getContext('2d');if(!ctx)return;
  ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);ctx.fillStyle=fg;ctx.textAlign='center';
  ctx.textBaseline='middle';ctx.font='bold 65px Arial';ctx.fillText(txt,256,64,490);
  const tex=new THREE.CanvasTexture(can);tex.colorSpace=THREE.SRGBColorSpace;
  const o=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
  o.position.set(x,y,z);o.rotation.y=rot;g.add(o);
 };
 const dumbbell=(x:number,y:number,z:number,kg:number)=>{
  R([x-.19,y,z],[x+.19,y,z],.018,brushed);
  for(const dx of [-.135,.135]){
   const o=C(kg===20?.11:.082,.105,x+dx,y,z,rubber,6);o.rotation.z=Math.PI/2;
   const cap=disc(x+dx+(dx>0?.055:-.055),y,z,.038,.008,brushed);
  }
 };
 const barbell=(totalKg:number)=>{
  // Standard 20kg bar. All loads are symmetric, physically supported by sleeves.
  const barY=.265,plateMass=Math.max(0,(totalKg-20)/2);
  R([-1.10,barY,0],[1.10,barY,0],.014,brushed);
  for(const sign of [-1,1]){
   const sleeve=disc(sign*.87,barY,0,.024,.42,brushed);
   disc(sign*.665,barY,0,.038,.025,graphite);
   let remaining=plateMass,offset=.715;
   const options:[[number,number,THREE.Material],...Array<[number,number,THREE.Material]>]=[
    [25,.225,red],[20,.215,blue],[15,.20,mat(0xd2b93e,.12,.6)],
    [10,.18,mat(0x3e9857,.12,.65)],[5,.13,white],[2.5,.11,graphite]
   ];
   for(const [kg,r,m] of options){
    while(remaining>=kg-.001&&offset<1.02){
     disc(sign*(offset+.024),barY,0,r,.048,m);
     disc(sign*(offset+.024),barY,0,.032,.050,black);
     offset+=.051;remaining-=kg;
    }
   }
   disc(sign*(Math.min(offset+.025,1.075)),barY,0,.051,.035,graphite);
  }
 };
 // Shop inventory: each weight plate and bar is independently selectable and saleable.
 if(id==='olympicBar20kg')barbell(20);
 if(id==='olympicCollar'){
  const body=C(.055,.065,0,.065,0,graphite,32);
  const inner=C(.029,.068,0,.065,0,brushed,32);
  R([.045,.075,0],[.11,.075,0],.012,graphite);
 }
 if(/^plate(2_5|5|10|15|20|25)kg$/.test(id)){
  const kg=Number(id.match(/plate(.*?)kg/)?.[1].replace('_','.')||5);
  const radius=kg>=20?.225:kg===15?.20:kg===10?.18:kg===5?.14:.115;
  const colour=kg===25?red:kg===20?blue:kg===15?mat(0xd2b93e,.12,.6):kg===10?mat(0x3e9857,.12,.65):kg===5?white:graphite;
  const plate=C(radius,.055,0,radius,0,colour,48);plate.rotation.x=Math.PI/2;
  // Real through-bore: annular shape extruded, not a coloured disk painted over the centre.
  g.remove(plate);plate.geometry.dispose();
  const ring=new THREE.Shape();ring.absarc(0,0,radius,0,Math.PI*2,false);
  const bore=new THREE.Path();bore.absarc(0,0,.027,0,Math.PI*2,true);ring.holes.push(bore);
  const geom=new THREE.ExtrudeGeometry(ring,{depth:.052,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:2,curveSegments:48});
  const mesh=new THREE.Mesh(geom,colour);mesh.rotation.x=-Math.PI/2;mesh.position.y=radius;mesh.castShadow=true;g.add(mesh);
  const hub=C(.043,.06,0,radius,0,brushed,32);hub.rotation.x=Math.PI/2;
  g.remove(hub);hub.geometry.dispose();
  // Label printed onto the flat face.
  decal(kg+' KG',radius*.95,radius*.22,0,radius*.55,.064,'#1e242b','#ffffff');
 }
 if(id==='hexDumbbell10'||id==='hexDumbbell20')dumbbell(0,id==='hexDumbbell20'?.13:.11,0,id==='hexDumbbell20'?20:10);
 if(id==='dumbbellRack'){
  for(const x of [-.85,.85])for(const z of [-.27,.27])R([x,.03,z],[x,.95,z*.55],.035,graphite);
  for(const y of [.42,.84]){
   for(const z of [-.17,.17])B(1.9,.05,.09,0,y,z,graphite);
   for(let i=0;i<5;i++)dumbbell(-.66+i*.33,y+.105,.02,i>2?20:10);
  }
 }
 if(id==='olympicBarbell'||id==='loadedBarbell'||/^barbell\\d+kg$/.test(id))barbell(id==='olympicBarbell'?20:id==='loadedBarbell'?100:Number(id.match(/\\d+/)?.[0]||20));
 if(id==='squatRack'){
  for(const x of [-.90,.90]){
   B(.11,2.3,.12,x,1.15,0,graphite);B(.15,.075,1.3,x,.038,.1,graphite);
   B(.13,.06,.12,x,2.28,0,brushed);
   for(let i=0;i<18;i++)B(.016,.016,.014,x+(x>0?-.062:.062),.42+i*.1,.065,black);
   B(.24,.10,.32,x,1.35,.14,brushed);
   B(.11,.07,.44,x,1.02,.18,graphite);
  }
  R([-.90,2.25,-.42],[.90,2.25,-.42],.029,graphite);
  R([-.90,2.25,-.42],[-.90,2.25,.0],.028,graphite);
  R([.90,2.25,-.42],[.90,2.25,.0],.028,graphite);
  R([-.9,1.38,.15],[.9,1.38,.15],.019,brushed);
  for(const x of [-.90,.90])for(const z of [-.38,.55])B(.17,.025,.15,x,.015,z,black);
 }
 if(id==='gymMirror'){
  B(2.12,2.18,.08,0,1.10,0,graphite);
  B(1.98,2.04,.02,0,1.10,.05,mat(0xaabdc9,.85,.08));
  for(const x of [-1.025,1.025])B(.025,2.12,.09,x,1.10,.05,brushed);
  for(const y of [.04,2.16])B(2.07,.025,.09,0,y,.05,brushed);
 }
 if(id==='exerciseBike'){
  // Frame runs along X, stabiliser feet span Z. All members meet actual joints.
  const tyre=mat(0x101317,.12,.8),cast=mat(0x3e444b,.58,.42),display=mat(0x627d89,.16,.22);
  for(const x of [-.54,.57]){
    R([x,.085,-.43],[x,.085,.43],.038,graphite);
    for(const z of [-.43,.43])sphere(x,.085,z,.052,rubber);
  }
  // Triangulated central chassis and swept front mast.
  R([-.43,.13,0],[-.16,.54,0],.064,graphite);
  R([-.16,.54,0],[.34,.56,0],.080,graphite);
  R([.34,.56,0],[.57,.13,0],.072,graphite);
  R([-.16,.54,0],[.28,1.18,0],.095,graphite);
  R([-.43,.13,0],[-.43,1.12,0],.049,graphite);
  R([-.43,1.12,0],[-.50,1.26,0],.032,brushed);
  // Sculpted saddle, stem clamp and its visible mounting rails.
  const saddle=sphere(-.52,1.31,0,.19,rubber);saddle.scale.set(1.35,.30,.76);
  for(const z of [-.075,.075])R([-.63,1.25,z],[-.38,1.25,z],.010,brushed);
  C(.047,.065,-.43,1.11,0,graphite);
  // Flywheel axis points along Z; circular wheel must face the viewer.
  const wheel=C(.34,.105,.37,.57,0,tyre,48);wheel.rotation.x=Math.PI/2;
  const wheelFace=C(.288,.112,.37,.57,0,cast,48);wheelFace.rotation.x=Math.PI/2;
  for(const z of [-.064,.064]){
    const trim=C(.235,.008,.37,.57,z,brushed,48);trim.rotation.x=Math.PI/2;
    const hub=C(.047,.015,.37,.57,z+(z>0?.012:-.012),graphite,24);hub.rotation.x=Math.PI/2;
  }
  // Drive cover on right side, cranks and independent pedals.
  const drive=sphere(-.09,.44,.075,.26,graphite);drive.scale.set(1.36,.70,.42);
  for(const z of [-.19,.19]){
    const arm=R([-.12,.44,z],[-.30,.23,z],.022,brushed);
    B(.21,.045,.13,-.32,.23,z,rubber);
  }
  // Forward console and ergonomic curved handlebars.
  R([.28,1.18,0],[.44,1.45,0],.043,graphite);
  R([.44,1.45,-.33],[.44,1.45,.33],.031,graphite);
  for(const z of [-.33,.33]){
    R([.44,1.45,z],[.64,1.33,z],.027,graphite);
    R([.64,1.33,z],[.72,1.41,z],.027,rubber);
    R([.44,1.45,z],[.34,1.59,z*.80],.025,graphite);
  }
  // Display is landscape and faces the rider (towards -X), not sideways.
  // Mount screen and bezel together on the same tilted display housing.
  const monitor=new THREE.Group();monitor.position.set(.39,1.56,0);
  monitor.rotation.z=.22;
  const housing=new THREE.Mesh(new THREE.BoxGeometry(.065,.18,.28),graphite);
  housing.castShadow=true;monitor.add(housing);
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(.235,.125),display);
  screen.rotation.y=-Math.PI/2;screen.position.set(-.034,0,0);
  monitor.add(screen);
  const screenInset=new THREE.Mesh(new THREE.PlaneGeometry(.19,.085),mat(0x8cb1bb,.05,.18));
  screenInset.rotation.y=-Math.PI/2;screenInset.position.set(-.035,0,0);
  monitor.add(screenInset);
  g.add(monitor);
  B(.055,.05,.05,.20,1.06,.08,red);
 }
 if(id==='boxingRing'){
  // Regulation-inspired raised deck with inset canvas, four taut ropes,
  // attached turnbuckles and padded corners; entrance steps are connected.
  const canvas=mat(0x397fa8,.04,.86),skirt=mat(0x182a3a,.08,.8);
  B(5.12,.35,5.12,0,.36,0,graphite);
  B(5.03,.07,5.03,0,.565,0,canvas);
  for(const sign of [-1,1]){
    B(5.10,.30,.045,0,.35,sign*2.55,skirt);
    B(.045,.30,5.10,sign*2.55,.35,0,skirt);
  }
  const corners=[[-2.38,-2.38],[-2.38,2.38],[2.38,-2.38],[2.38,2.38]] as const;
  for(const [x,z] of corners){
    B(.12,1.63,.12,x,1.38,z,graphite);
    const pad=x<0?red:blue;
    // One vertical upholstered corner pad, not four disconnected blocks.
    B(.24,.92,.25,x,1.25,z,pad);
    for(const y of [.83,1.09,1.35,1.61]){
      // Turnbuckle sleeves bridge between posts and the start of each rope.
      const sx=x<0?1:-1,sz=z<0?1:-1;
      R([x,y,z],[x+sx*.21,y,z],.016,brushed);
      R([x,y,z],[x,y,z+sz*.21],.016,brushed);
      B(.08,.065,.07,x+sx*.18,y,z,graphite);
      B(.07,.065,.08,x,y,z+sz*.18,graphite);
    }
  }
  for(const y of [.83,1.09,1.35,1.61]){
    for(const z of [-2.38,2.38])R([-2.18,y,z],[2.18,y,z],.019,white);
    for(const x of [-2.38,2.38])R([x,y,-2.18],[x,y,2.18],.019,white);
  }
  // Three attached ascending treads, rising to the front deck edge.
  for(let i=0;i<3;i++){
    const height=.16*(i+1),z=3.14-i*.29;
    B(.90,height,.29,0,height/2,z,graphite);
    B(.90,.022,.29,0,height+.012,z,brushed);
  }
  decal('STREET FIGHT UK',1.60,.18,0,.35,2.579,'#172736','#edf1f3');
 }
 const palisade=(gate:boolean,poor:boolean)=>{
  const w=gate?1.7:3.05,n=gate?10:18;
  const metal=poor?rust:zinc;
  for(const x of [-w/2,w/2]){
   B(.095,2.12,.10,x,1.06,0,metal);
   B(.15,.05,.15,x,2.14,0,graphite);
  }
  for(const y of [.34,1.76])B(w-.13,.055,.075,0,y,-.055,metal);
  for(let i=0;i<n;i++){
   if(poor&&i===3)continue;
   const x=-w/2+.12+i*(w-.24)/(n-1);
   // Vertical folded V-section picket: raised spine and flanking lips.
   const pick=B(.057,1.75,.035,x,1.05,.012,poor&&i%4===0?rust:zinc);
   B(.020,1.73,.025,x-.026,1.05,-.009,metal);
   B(.020,1.73,.025,x+.026,1.05,-.009,metal);
   if(poor&&i===n-2)pick.rotation.z=.12;
   // Two-pronged pointed head, closer to real UK palisade than cone spikes.
   for(const dx of [-.023,.023]){
    const tip=new THREE.Mesh(new THREE.ConeGeometry(.022,.12,4),metal);
    tip.position.set(x+dx,1.99,.012);tip.rotation.y=Math.PI/4;g.add(tip);
   }
   for(const y of [.34,1.76])sphere(x,y,.064,.018,brushed);
  }
  if(gate){
   for(const y of [.32,1.72]){
    B(.16,.065,.17,-w/2,y,.08,graphite);
    C(.04,.16,-w/2,y,.11,brushed);
   }
   B(.16,.12,.11,w/2-.12,1.10,.13,graphite);
   R([w/2-.12,1.10,.13],[w/2+.02,1.10,.13],.016,brushed);
   B(.12,.15,.13,w/2+.04,1.10,.10,metal);
  }
 };
 const chain=(gate:boolean,poor:boolean)=>{
  const w=gate?1.5:3.05,h=1.9;
  const x0=-w/2+.045,x1=w/2-.045,y0=.205,y1=h-.025;
  for(const x of [-w/2,w/2]){
   R([x,.03,0],[x,h+.14,0],.043,zinc);
   sphere(x,h+.14,0,.049,brushed);
  }
  for(const y of [.18,h])R([-w/2,y,0],[w/2,y,0],.024,zinc);
  // Clip every diagonal to the inside of the rectangular frame.
  // This produces complete diamond links without overshooting or free-floating lines.
  const pitch=.145;
  for(const slope of [-1,1]){
   for(let t=y0-(x1-x0);t<=y1+(x1-x0);t+=pitch){
    const hits:[number,number][]=[];
    const test=(x:number,y:number)=>{
     if(x>=x0-1e-6&&x<=x1+1e-6&&y>=y0-1e-6&&y<=y1+1e-6)hits.push([x,y]);
    };
    test(x0,t);test(x1,t+slope*(x1-x0));
    if(slope!==0){test(x0+(y0-t)/slope,y0);test(x0+(y1-t)/slope,y1);}
    const unique=hits.filter((p,i)=>hits.findIndex(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-5)===i);
    if(unique.length<2)continue;
    const p=unique[0],q=unique[1];
    if(poor){
     // Only the explicitly poor variant has small, localised missing links.
     const mx=(p[0]+q[0])/2,my=(p[1]+q[1])/2;
     if(mx>.15&&mx<.65&&my>.65&&my<1.10)continue;
    }
    R([p[0],p[1],0],[q[0],q[1],0],.0045,poor?rust:zinc);
   }
  }
  // Tension bars bind the wire mesh to the gate/fence posts.
  for(const x of [x0,x1])R([x,y0,0],[x,y1,0],.012,poor?rust:brushed);
  if(gate){
   B(.10,.12,.10,w/2-.13,1.05,.09,graphite);
   for(const y of [.33,1.68])B(.12,.07,.17,-w/2,y,.09,brushed);
  }
  if(poor)R([-.9,.16,.06],[.15,.07,.08],.012,rust);
 };
 const timber=(poor:boolean,gate:boolean)=>{
  const w=gate?1.1:2.75,n=gate?10:22;
  for(const x of [-w/2,w/2])B(.12,1.87,.14,x,.935,-.09,poor?oldWood:wood);
  for(const y of [.36,1.40])B(w,.095,.09,0,y,-.09,poor?oldWood:wood);
  if(gate)R([-w/2,.32,-.16],[w/2,1.5,-.16],.026,graphite);
  for(let i=0;i<n;i++){
   if(poor&&[2,5,6,12,17].includes(i))continue;
   const x=-w/2+(i+.5)*w/n;
   const h=poor&&i%5===0?1.25:poor&&i%7===0?1.5:1.79;
   const plank=B(w/n-.009,h,.046,x,h/2,.04,poor&&i%3===0?oldWood:wood);
   if(poor&&i%4===0)plank.rotation.z=.06;
   for(const y of [.36,1.4])if(y<h-.08)sphere(x,y,.073,.008,graphite);
  }
  if(gate){
   B(.11,.11,.10,w/2-.13,1.02,.11,graphite);
   for(const y of [.35,1.43])B(.12,.055,.15,-w/2,y,.07,brushed);
  }
 };
 if(id==='palisadeFence')palisade(false,false);
 if(id==='palisadeGate')palisade(true,false);
 if(id==='poorPalisadeGate')palisade(true,true);
 if(id==='chainLinkFence')chain(false,false);
 if(id==='chainLinkGate')chain(true,false);
 if(id==='poorChainLinkFence')chain(false,true);
 if(id==='timberFence')timber(false,false);
 if(id==='poorTimberFence')timber(true,false);
 if(id==='poorTimberGate')timber(true,true);
 if(id.startsWith('safe')||id==='poorSafe'){
  const scale=id==='safeSmall'?.55:id==='safeMedium'?.85:id==='safeLarge'?1.35:.90;
  const bad=id==='poorSafe',body=bad?oldWood:mat(0x9ba1a4,.55,.42);
  B(scale,scale*1.05,scale*.82,0,scale*.525,0,body);
  B(scale*.87,scale*.91,.04,0,scale*.54,scale*.425,graphite);
  B(scale*.81,scale*.85,.035,0,scale*.54,scale*.452,bad?rust:brushed);
  for(const y of [.27,.53,.79]){
   const bolt=C(.03*scale,.04*scale,scale*.32,y*scale,scale*.48,brushed,16);
   bolt.rotation.x=Math.PI/2;
  }
  const keypad=B(.24*scale,.29*scale,.035,scale*.13,scale*.69,scale*.48,graphite);
  for(let i=0;i<12;i++){
   const x=scale*(.05+(i%3)*.075),y=scale*(.78-Math.floor(i/3)*.065);
   B(.04*scale,.032*scale,.015,x,y,scale*.505,brushed);
  }
  const hub=C(.075*scale,.04*scale,-scale*.18,scale*.52,scale*.48,brushed,32);hub.rotation.x=Math.PI/2;
  R([-scale*.18,scale*.52,scale*.50],[0,scale*.52,scale*.50],.022*scale,brushed);
  for(const x of [-.38,.38])for(const y of [.12,.94])B(.045*scale,.025*scale,.05*scale,x*scale,y*scale,scale*.46,graphite);
  if(bad)for(let i=0;i<8;i++)B(.09*scale,.014*scale,.012*scale,(i%4-.9)*.20*scale,(.18+Math.floor(i/4)*.58)*scale,scale*.478,rust);
  decal(id==='safeLarge'?'SECURE':id==='safeSmall'?'HOME':'SAFE',scale*.26,scale*.07,-scale*.18,scale*.87,scale*.483,'#b6babb','#1b2328');
 }
 // Ground the entire assembly as a single group, preserving relative positions.
 g.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(g);
 if(Number.isFinite(bounds.min.y)&&Math.abs(bounds.min.y)>.001)
   for(const o of g.children)o.position.y-=bounds.min.y;
 const poor='tags' in entry&&entry.tags.includes('poor' as never);
 g.userData={collection:'SFUK_expansion',standalone:true,id,category:entry.category,
  tags:poor?['poor']:[],districtTags:poor?['poor']:[],units:'metres',pivot:'ground-centre',
  referenceInspired:true,storeItem:'storeItem' in entry?entry.storeItem:false,weightKg:'weightKg' in entry?entry.weightKg:(id==='olympicBarbell'?20:id==='loadedBarbell'?100:undefined),minStrengthLevel:'minStrengthLevel' in entry?entry.minStrengthLevel:undefined,revision:6,quality:'procedural-work-in-progress'};
 return g;
}
