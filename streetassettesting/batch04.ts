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
 const side=new T.Shape();side.moveTo(-.86,0);side.lineTo(.86,0);side.lineTo(1.03,.90);side.lineTo(-1.03,.90);side.closePath();
 const geo=new T.ExtrudeGeometry(side,{depth:1.06,bevelEnabled:false});const shell=new T.Mesh(geo,orange);shell.position.set(0,.09,-.53);g.add(shell);
 B(1.65,.10,.92,0,.96,0,dark);
 for(const x of [-.91,.91])for(const z of [-.43,.43])B(.16,.14,.20,x,.85,z,steel);
 for(const x of [-.55,0,.55])B(.07,.69,.014,x,.49,.542,rust);
}
if(id==='trafficCone'){
 C(.25,.065,0,.034,0,black,4);const cone=new T.Mesh(new T.ConeGeometry(.155,.69,32),orange);cone.position.y=.41;g.add(cone);
 for(const y of [.34,.55]){const band=new T.Mesh(new T.CylinderGeometry(.155*(.76-y*.62),.155*(.90-y*.62),.09,32),white);band.position.y=y;g.add(band);}
}
if(id==='roadBarrier'){
 for(const x of [-.91,.91]){R([x,.07,0],[x,1.08,0],.032,steel);B(.39,.045,.33,x,.045,0,dark);}
 for(const y of [.24,.99])R([-.93,y,0],[.93,y,0],.033,steel);
 for(let i=0;i<11;i++)R([-.83+i*.166,.24,0],[-.83+i*.166,.99,0],.016,steel);
}
if(id==='shoppingTrolley'){
 const wire=mat(0x9ca5a6,.78,.32);
 for(const y of [.35,.78])for(const z of [-.29,.29])R([-.55,y,z],[.55,y,z],.014,wire);
 for(const y of [.35,.78])for(const x of [-.55,.55])R([x,y,-.29],[x,y,.29],.014,wire);
 for(let i=0;i<11;i++){const x=-.50+i*.10;for(const z of [-.29,.29])R([x,.35,z],[x,.78,z],.009,wire);}
 for(let i=0;i<7;i++){const z=-.25+i*.083;for(const x of [-.55,.55])R([x,.35,z],[x,.78,z],.009,wire);}
 for(const x of [-.42,.42]){R([x,.34,0],[x,.11,0],.024,wire);for(const z of [-.22,.22]){const w=C(.085,.035,x,.105,z,black,24);w.rotation.x=Math.PI/2;}}
 R([-.55,.83,-.29],[-.55,.83,.29],.025,dark);
}
if(id==='pubBarrel'){
 C(.29,.78,0,.40,0,steel,48);
 for(const y of [.08,.18,.62,.73])C(.302,.035,0,y,0,dark,48);
 C(.09,.025,0,.802,0,dark);
}
if(id==='woodenCrate'){
 B(.94,.66,.76,0,.36,0,wood);
 for(const x of [-.46,.46])for(const z of [-.36,.36])B(.055,.72,.055,x,.36,z,dark);
 for(const y of [.10,.62]){B(.97,.05,.05,0,y,.40,dark);B(.97,.05,.05,0,y,-.40,dark);}
 for(const x of [-.30,0,.30])B(.022,.55,.018,x,.36,.403,rust);
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
g.userData={collection:'streetassettesting',batch:4,id,units:'metres',status:'review-required',revision:'initial-v1'};
return g;
}