/** Batch 04 — isolated British neighbourhood and industrial props. Approval required before promotion. */
import * as THREE from 'three';
export const ASSETS=[
{id:'skipBin',label:'Builders steel skip',gameId:'skip'},
{id:'trafficCone',label:'Roadworks traffic cone',gameId:'cone'},
{id:'roadBarrier',label:'Roadworks pedestrian barrier',gameId:'barrier'},
{id:'shoppingTrolley',label:'Abandoned supermarket trolley',gameId:'trolley'},
{id:'pubBarrel',label:'Pub beer barrel',gameId:'barrel'},
{id:'woodenCrate',label:'Industrial timber crate',gameId:'crate'},
{id:'parkPicnicTable',label:'Weathered picnic table',gameId:'picnic_table'}
] as const;
export type AssetId=typeof ASSETS[number]['id'];
export function createAsset(id:AssetId):THREE.Group{
const T=THREE,g=new T.Group();g.name='SFUK_B04_'+id;
const mat=(c:number,metal=0,rough=.7)=>new T.MeshStandardMaterial({color:c,metalness:metal,roughness:rough});
const steel=mat(0x69777d,.65,.48),dark=mat(0x283036,.32,.78),rust=mat(0x87523d,.25,.84),orange=mat(0xd75b25,.12,.72),white=mat(0xe8e4d8),wood=mat(0x846a4e),black=mat(0x171c20);
const B=(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o};
const C=(r:number,h:number,x:number,y:number,z:number,m:T.Material,n=32)=>{const o=new T.Mesh(new T.CylinderGeometry(r,r,h,n),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o};
const R=(a:number[],b:number[],r:number,m:T.Material)=>{const p=new T.Vector3(...a),q=new T.Vector3(...b),v=q.clone().sub(p);const o=new T.Mesh(new T.CylinderGeometry(r,r,v.length(),10),m);o.position.copy(p.add(q).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());g.add(o);return o};
if(id==='skipBin'){
 const body=mat(0xd89a1c,.32,.59),rim=mat(0xb47c19,.48,.54),inside=mat(0x9e741e,.35,.74);
 // Five separate thin steel panels; no solid extruded box or loose blocks.
 const panel=(pts:number[][],z:number)=>{const sh=new T.Shape();sh.moveTo(pts[0][0],pts[0][1]);for(const p of pts.slice(1))sh.lineTo(p[0],p[1]);sh.closePath();const mesh=new T.Mesh(new T.ExtrudeGeometry(sh,{depth:.026,bevelEnabled:false}),body);mesh.position.z=z;g.add(mesh);};
 B(1.54,.045,.90,0,.075,0,inside);
 const side=[[-.77,.08],[.77,.08],[1.02,.89],[-1.02,.89]];
 panel(side,-.47);panel(side,.444);
 // End panels are sloped and fit flush between the long walls.
 for(const x of [-1,1]){const sh=new T.Shape();sh.moveTo(-.45,.08);sh.lineTo(.45,.08);sh.lineTo(.45,.89);sh.lineTo(-.45,.89);sh.closePath();const mesh=new T.Mesh(new T.ExtrudeGeometry(sh,{depth:.028,bevelEnabled:false}),body);mesh.rotation.y=Math.PI/2;mesh.position.x=x*.76;g.add(mesh);}
 for(const z of [-.47,.47]){R([-1.02,.895,z],[1.02,.895,z],.014,rim);for(const x of [-.62,0,.62])B(.035,.56,.018,x,.48,z+(z>0?.018:-.018),rim);}
 // Small welded lifting eyes remain on outer upper corners, not huge protruding blocks.
 for(const x of [-.78,.78])for(const z of [-.48,.48]){const eye=new T.Mesh(new T.TorusGeometry(.045,.012,8,20),rim);eye.rotation.y=Math.PI/2;eye.position.set(x,.82,z);g.add(eye);}
}
if(id==='trafficCone'){
 const reflective=mat(0xf3f3e9,.08,.37),coneH=.69,baseR=.165,topR=.023;
 B(.46,.055,.46,0,.028,0,black);
 const body=new T.Mesh(new T.CylinderGeometry(topR,baseR,coneH,48),orange);body.position.y=.055+coneH/2;g.add(body);
 const radius=(y:number)=>baseR+(topR-baseR)*(y-.055)/coneH;
 for(const [y,h] of [[.27,.115],[.52,.105]]){const r1=radius(y+h/2)+.0015,r2=radius(y-h/2)+.0015;const band=new T.Mesh(new T.CylinderGeometry(r1,r2,h,48,1,true),reflective);band.position.y=y;g.add(band);}
 for(const x of [-.175,.175])for(const z of [-.175,.175])B(.055,.009,.055,x,.061,z,dark);
}
if(id==='roadBarrier'){
 const plastic=mat(0xc6322b,.05,.62),reflect=mat(0xe9e9e2,.08,.4),foot=mat(0x34393c,.15,.75);
 // One moulded red plastic pedestrian barrier with rectangular apertures.
 const outline=new T.Shape();outline.moveTo(-1.06,.20);outline.lineTo(1.06,.20);outline.lineTo(1.06,.91);outline.lineTo(.85,1.09);outline.lineTo(-.85,1.09);outline.lineTo(-1.06,.91);outline.closePath();
 for(let i=0;i<8;i++){const x=-.89+i*.252;const hole=new T.Path();hole.moveTo(x,.39);hole.lineTo(x+.15,.39);hole.lineTo(x+.15,.84);hole.lineTo(x,.84);hole.closePath();outline.holes.push(hole);}
 const mesh=new T.Mesh(new T.ExtrudeGeometry(outline,{depth:.065,bevelEnabled:true,bevelSize:.012,bevelThickness:.008,bevelSegments:1}),plastic);mesh.position.z=-.032;g.add(mesh);
 for(const x of [-.45,0,.45])B(.26,.095,.009,x,.986,.046,reflect);
 for(const x of [-.77,.77]){B(.115,.14,.10,x,.19,0,foot);B(.28,.07,.48,x,.065,0,foot);B(.095,.19,.07,x,.20,.02,plastic);}
 B(.11,.09,.11,-1.105,.74,0,plastic);
}
if(id==='shoppingTrolley'){
 const wire=mat(0xa5afb2,.8,.32),grip=mat(0x29323a,.08,.65),basketBottom=.40,basketTop=.83;
 // Conventional trolley footprint: 1.06 m long, .60 m wide, .98 m tall.
 const rear=-.48,front=.56;
 for(const y of [basketBottom,basketTop]){const half=y===basketTop?.30:.245;for(const z of [-half,half])R([rear,y,z],[front,y,z],.010,wire);for(const x of [rear,front])R([x,y,-half],[x,y,half],.010,wire);}
 for(let i=0;i<=13;i++){const x=rear+(front-rear)*i/13;for(const side of [-1,1])R([x,basketBottom,side*.245],[x,basketTop,side*.30],.0055,wire);}
 for(let i=0;i<=9;i++){const t=-1+i*2/9;for(const x of [rear,front])R([x,basketBottom,t*.245],[x,basketTop,t*.30],.0055,wire);}
 for(let i=0;i<=12;i++){const x=rear+(front-rear)*i/12;R([x,basketBottom,-.245],[x,basketBottom,.245],.007,wire);}
 for(const z of [-.19,.19]){R([-.39,.40,z],[-.37,.17,z],.019,wire);R([.42,.40,z],[.38,.17,z],.019,wire);R([-.37,.17,z],[.38,.17,z],.017,wire);}
 for(const x of [-.37,.38])R([x,.17,-.19],[x,.17,.19],.016,wire);
 // Four visible swivel wheels: axes along Z, wheels tucked directly beneath chassis.
 for(const x of [-.37,.38])for(const z of [-.19,.19]){R([x,.17,z],[x,.095,z],.012,wire);const w=C(.055,.029,x,.067,z,grip,24);w.rotation.x=Math.PI/2;}
 R([-.54,.88,-.33],[-.54,.88,.33],.021,grip);
 for(const z of [-.30,.30])R([-.54,.88,z],[-.48,.83,z],.014,wire);
}
if(id==='pubBarrel'){
 const metal=mat(0xb9c2c4,.88,.24),darkMetal=mat(0x707d82,.77,.37);
 // Standard stainless pub keg with rolled top/bottom chimes and subtle pressed ribs.
 C(.275,.63,0,.405,0,metal,64);
 for(const y of [.19,.33,.47,.61]){const hoop=new T.Mesh(new T.TorusGeometry(.275,.007,8,64),metal);hoop.rotation.x=Math.PI/2;hoop.position.y=y;g.add(hoop);}
 for(const y of [.082,.725]){const chime=new T.Mesh(new T.TorusGeometry(.271,.018,12,64),metal);chime.rotation.x=Math.PI/2;chime.position.y=y;g.add(chime);}
 // Rolled upper and lower protective collars, with inset flat lid.
 C(.275,.065,0,.755,0,metal,64);C(.242,.012,0,.792,0,darkMetal,64);
 C(.275,.062,0,.045,0,metal,64);
 // Sankey coupler socket, small and recessed.
 C(.047,.013,0,.801,0,metal,32);C(.023,.012,0,.809,0,darkMetal,24);
 // Horizontal oval carry apertures on collar, facing front and rear.
 for(const z of [-.274,.274]){const handle=B(.125,.033,.005,0,.755,z,darkMetal);handle.rotation.y=0;}
}
if(id==='woodenCrate'){
 const plank=mat(0x9b7953),plankAlt=mat(0x866343),nail=mat(0x44494a,.5);
 // Individually joined timber boards rather than one solid cuboid.
 for(const z of [-.37,.37])for(let i=0;i<5;i++){B(.93,.116,.035,0,.15+i*.121,z,i%2?plankAlt:plank);}
 for(const x of [-.46,.46])for(let i=0;i<5;i++){B(.035,.116,.70,x,.15+i*.121,0,i%2?plank:plankAlt);}
 for(let i=0;i<6;i++)B(.145,.035,.75,-.39+i*.156,.77,0,i%2?plank:plankAlt);
 for(const x of [-.40,.40])for(const z of [-.39,.39])B(.06,.74,.055,x,.41,z,plankAlt);
 for(const z of [-.405,.405]){R([-.40,.12,z],[.40,.70,z],.022,plankAlt);R([-.40,.70,z],[.40,.12,z],.022,plankAlt);}
 for(const x of [-.37,.37])for(const z of [-.41,.41])for(const y of [.16,.67])B(.018,.018,.008,x,y,z,nail);
}

if(id==='parkPicnicTable'){
 B(1.72,.08,.72,0,.76,0,wood);
 for(const z of [-.56,.56])B(1.72,.065,.28,0,.46,z,wood);
 for(const x of [-.59,.59])for(const z of [-.25,.25])R([x,.72,z],[x*1.15,.05,z*1.65],.035,steel);
 for(const x of [-.59,.59])R([x,.45,-.65],[x,.45,.65],.027,steel);
 for(let i=0;i<4;i++)B(1.68,.008,.009,0,.807,-.27+i*.18,dark);
}
g.userData={collection:'streetassettesting',batch:4,id,units:'metres',status:'review-required',revision:'reference-rebuild-v3'};
return g;
}