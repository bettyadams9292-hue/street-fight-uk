/** Street Fight UK — isolated Gym, Security & Neighbourhood Props.
 * Units metres, Y-up, front faces +Z. No game imports or registrations.
 * Use createExpansionAsset(id). userData.tags includes 'poor' for decay props.
 */
import * as THREE from 'three';
export const EXPANSION_ASSETS = [
{id:'hexDumbbell10',label:'10 kg hex dumbbell',category:'gym'},
{id:'hexDumbbell20',label:'20 kg hex dumbbell',category:'gym'},
{id:'dumbbellRack',label:'Commercial dumbbell rack',category:'gym'},
{id:'olympicBarbell',label:'Olympic barbell',category:'gym'},
{id:'loadedBarbell',label:'Loaded bumper-plate barbell',category:'gym'},
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
