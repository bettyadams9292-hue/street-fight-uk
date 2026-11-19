/** Batch 04 — isolated British neighbourhood and industrial props. Approval required before promotion. */
import * as THREE from 'three';
export const ASSETS=[
{id:'skipBin',label:'Builders steel skip',gameId:'skip'},
{id:'trafficCone',label:'Roadworks traffic cone',gameId:'cone'},
{id:'roadBarrier',label:'Roadworks pedestrian barrier',gameId:'barrier'},
{id:'shoppingTrolley',label:'Abandoned supermarket trolley',gameId:'trolley'},
{id:'pubBarrel',label:'Pub beer barrel',gameId:'barrel'},
{id:'woodenCrate',label:'Industrial timber crate',gameId:'crate'},
{id:'securityCamera',label:'Wall-mounted CCTV camera',gameId:'cctv'},
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
 const yellow=mat(0xe5a01b,.28,.52),edge=mat(0xb87912,.48,.54);
 // Open-topped, tapered steel builders skip with sloping end profiles.
 B(1.60,.075,.92,0,.075,0,yellow);
 const wall=(points:number[][],depth:number,z:number,m:T.Material)=>{const sh=new T.Shape();sh.moveTo(points[0][0],points[0][1]);for(const p of points.slice(1))sh.lineTo(p[0],p[1]);sh.closePath();const o=new T.Mesh(new T.ExtrudeGeometry(sh,{depth,bevelEnabled:false}),m);o.position.z=z;g.add(o)};
 wall([[-.79,.08],[.79,.08],[1.07,.91],[-1.07,.91]],.045,-.52,yellow);
 wall([[-.79,.08],[.79,.08],[1.07,.91],[-1.07,.91]],.045,.475,yellow);
 for(const x of [-1,1]){const sh=new T.Shape();sh.moveTo(-.46,.08);sh.lineTo(.46,.08);sh.lineTo(.53,.91);sh.lineTo(-.53,.91);sh.closePath();const o=new T.Mesh(new T.ExtrudeGeometry(sh,{depth:.045,bevelEnabled:false}),yellow);o.rotation.y=Math.PI/2;o.position.x=x*.79;g.add(o);}
 for(const z of [-.53,.53]){R([-1.07,.92,z],[1.07,.92,z],.027,edge);for(const x of [-.67,0,.67])R([x,.12,z],[x,.84,z],.015,edge);}
 for(const x of [-.93,.93])for(const z of [-.42,.42]){B(.18,.12,.15,x,.79,z,edge);B(.25,.08,.20,x,.16,z,dark);}
 // End tipping pivots and lifting lugs.
 for(const x of [-.96,.96])for(const z of [-.46,.46]){const lug=B(.14,.17,.085,x,.89,z,edge);lug.rotation.z=x>0?-.17:.17;}
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
 const wire=mat(0xabb3b6,.82,.32),handle=mat(0x252e35,.1,.64);
 // Tapered wire basket, sloping front and continuous chassis.
 const back=-.53,front=.55;
 for(const y of [.40,.83]){const w=y>.6?.34:.27;for(const z of [-w,w])R([back,y,z],[front,y,z],.013,wire);for(const x of [back,front])R([x,y,-w],[x,y,w],.013,wire);}
 for(let i=0;i<=11;i++){const x=back+i*(front-back)/11;for(const z of [-1,1])R([x,.40,z*.27],[x,.83,z*.34],.007,wire);}
 for(let i=0;i<=8;i++){const t=i/8,z=-.34+t*.68;for(const x of [back,front])R([x,.40,z*.27/.34],[x,.83,z],.008,wire);}
 for(let i=0;i<=10;i++){const x=back+i*(front-back)/10;R([x,.40,-.27],[x,.40,.27],.009,wire);}
 for(const z of [-.25,.25]){R([-.42,.40,z],[-.44,.13,z],.026,wire);R([.44,.40,z],[.40,.13,z],.026,wire);R([-.44,.14,z],[.40,.14,z],.024,wire);}
 for(const x of [-.44,.40])R([x,.14,-.25],[x,.14,.25],.023,wire);
 for(const x of [-.44,.40])for(const z of [-.25,.25]){R([x,.14,z],[x,.105,z],.018,wire);const w=C(.073,.035,x,.078,z,handle,24);w.rotation.z=Math.PI/2;}
 R([-.60,.90,-.38],[-.60,.90,.38],.028,handle);for(const z of [-.34,.34])R([-.60,.90,z],[-.53,.83,z],.019,wire);
}
if(id==='pubBarrel'){
 const stainless=mat(0xaab6b9,.9,.23),shadow=mat(0x667477,.72,.38);
 C(.285,.72,0,.40,0,stainless,64);
 // Pressed steel rolling hoops, raised chimes and recessed valve.
 for(const y of [.07,.18,.32,.47,.61,.73]){const ring=new T.Mesh(new T.TorusGeometry(.285,.018,10,64),stainless);ring.rotation.x=Math.PI/2;ring.position.y=y;g.add(ring);}
 for(const y of [.075,.755]){const lip=new T.Mesh(new T.TorusGeometry(.263,.025,10,64),shadow);lip.rotation.x=Math.PI/2;lip.position.y=y;g.add(lip);}
 C(.245,.014,0,.767,0,stainless,64);
 C(.050,.015,0,.784,0,shadow,32);C(.025,.019,0,.795,0,black,24);
 // Recessed carry handles near upper rim.
 for(const x of [-.20,.20]){B(.09,.045,.11,x,.695,0,shadow);B(.065,.02,.07,x,.717,0,stainless);}
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
if(id==='securityCamera'){
 B(.17,.24,.17,0,.83,-.31,steel);
 R([0,.84,-.28],[0,.84,.05],.025,steel);
 B(.31,.19,.49,0,.88,.29,white);
 B(.35,.035,.55,0,.995,.29,steel);
 const lens=C(.065,.025,0,.88,.549,black,32);lens.rotation.x=Math.PI/2;
 C(.018,.018,0,.88,.566,steel,20).rotation.x=Math.PI/2;
}
if(id==='parkPicnicTable'){
 B(1.72,.08,.72,0,.76,0,wood);
 for(const z of [-.56,.56])B(1.72,.065,.28,0,.46,z,wood);
 for(const x of [-.59,.59])for(const z of [-.25,.25])R([x,.72,z],[x*1.15,.05,z*1.65],.035,steel);
 for(const x of [-.59,.59])R([x,.45,-.65],[x,.45,.65],.027,steel);
 for(let i=0;i<4;i++)B(1.68,.008,.009,0,.807,-.27+i*.18,dark);
}
g.userData={collection:'streetassettesting',batch:4,id,units:'metres',status:'review-required',revision:'reference-rebuild-v2'};
return g;
}