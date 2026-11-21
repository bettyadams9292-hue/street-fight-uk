import * as THREE from 'three';
/** British police station assets. Pending visual approval. pr-dev only. */
export const POLICE_ASSETS=[
{id:'policeCustodyCell',name:'British custody cell',category:'Custody'},
{id:'policeCustodyDesk',name:'Custody sergeant booking desk',category:'Custody'},
{id:'policeStationFront',name:'British police station entrance',category:'Exterior'},
{id:'policeUniform',name:'British police uniform display',category:'Clothing'}
] as const;
export function createPoliceAsset(id:string):THREE.Group{
 const g=new THREE.Group();g.name=id;
 const mat=(c:number,metalness=0)=>new THREE.MeshStandardMaterial({color:c,roughness:metalness?.36:.78,metalness});
 const brick=mat(0x835b52),mortar=mat(0xb2aba1),stone=mat(0x9b9d9c),dark=mat(0x222a31),black=mat(0x11161a),steel=mat(0x858e96,.7),blue=mat(0x184c98),white=mat(0xe8e9e4),floor=mat(0x737a7d),wood=mat(0x6c5445),paper=mat(0xdeddd4),screen=mat(0x274756),yellow=mat(0xd1bb52);
 function box(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o}
 function cyl(r:number,h:number,x:number,y:number,z:number,m:THREE.Material){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,16),m);o.position.set(x,y,z);g.add(o);return o}
 function rod(a:[number,number,number],b:[number,number,number],r:number,m:THREE.Material){const v=new THREE.Vector3(...a),q=new THREE.Vector3(...b),delta=q.clone().sub(v),o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),10),m);o.position.copy(v.add(q).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());g.add(o);return o}
 function label(t:string,w:number,h:number,x:number,y:number,z:number,rot=0){const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d')!;ctx.fillStyle='#12305b';ctx.fillRect(0,0,1024,256);ctx.strokeStyle='#d4e2f1';ctx.lineWidth=12;ctx.strokeRect(12,12,1000,232);ctx.fillStyle='white';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 100px Arial';ctx.fillText(t,512,130,950);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const o=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));o.position.set(x,y,z);o.rotation.y=rot;g.add(o)}
 if(id==='policeCustodyCell'){
  // Room open at front for inspection; door is an independent solid custody barrier, not a retail grille.
  box(3.5,.13,3.8,0,.065,0,floor);box(3.5,2.65,.17,0,1.39,-1.82,stone);
  box(.15,2.65,3.8,-1.69,1.39,0,stone);box(.15,2.65,3.8,1.69,1.39,0,stone);
  box(3.5,.14,3.8,0,2.72,0,stone);
  // Short front returns create the cell doorway; door has full-height closely spaced steel bars.
  box(.85,2.5,.15,-1.29,1.36,1.8,stone);box(.85,2.5,.15,1.29,1.36,1.8,stone);
  box(1.75,.24,.17,0,2.53,1.8,stone);
  const doorZ=1.84;box(.065,2.35,.09,-.78,1.31,doorZ,steel);box(.065,2.35,.09,.78,1.31,doorZ,steel);
  box(1.6,.07,.09,0,.18,doorZ,steel);box(1.6,.07,.09,0,2.47,doorZ,steel);
  for(let i=0;i<11;i++)rod([-.69+i*.138,.22,doorZ],[ -.69+i*.138,2.44,doorZ],.017,steel);
  box(.19,.12,.14,.63,1.12,1.95,dark);box(.13,.06,.04,.65,1.12,2.04,steel);
  // Fixed custody bench, robust slab on wall-mounted brackets.
  box(1.95,.12,.62,-.18,.61,-1.35,stone);box(.16,.53,.48,-1.03,.33,-1.35,stone);box(.16,.53,.48,.67,.33,-1.35,stone);
  // Stainless custodial toilet at rear, flush panel and low partition.
  box(.75,1.05,.11,1.21,.58,-.96,stone);cyl(.25,.35,1.16,.32,-1.35,steel);
  const bowl=new THREE.Mesh(new THREE.TorusGeometry(.21,.045,8,24),steel);bowl.rotation.x=Math.PI/2;bowl.position.set(1.16,.52,-1.35);g.add(bowl);
  box(.21,.16,.035,1.12,1.17,-1.71,steel);
  box(.34,.26,.05,0,2.23,-1.7,dark);box(.25,.17,.02,0,2.23,-1.66,screen);
 }else if(id==='policeCustodyDesk'){
  box(2.65,.11,.93,0,1.06,0,wood);box(2.65,.91,.16,0,.55,.36,wood);box(.16,.92,.85,-1.23,.55,0,wood);box(.16,.92,.85,1.23,.55,0,wood);
  box(2.7,.06,.99,0,1.13,0,stone);box(.68,.48,.07,-.48,1.49,-.14,black);box(.61,.38,.016,-.48,1.5,-.096,screen);
  box(.61,.035,.24,-.48,1.22,.09,dark);box(.22,.04,.17,.48,1.21,.13,black);
  for(let i=0;i<5;i++)for(let j=0;j<3;j++)box(.023,.007,.02,.38+i*.047,1.238,.07+j*.038,steel);
  box(.55,.024,.37,.42,1.2,-.29,paper);box(.46,.012,.28,.47,1.23,-.32,white);
  for(let i=0;i<7;i++)box(.33,.004,.006,.45,1.24,-.43+i*.039,stone);
  box(.29,.27,.26,1.03,1.3,-.23,dark);box(.20,.16,.012,1.03,1.33,-.087,screen);
  box(.3,.08,.08,1.03,1.52,-.22,black);rod([1.03,1.52,-.22],[1.03,1.63,-.22],.014,steel);
  label('CUSTODY',.95,.24,0,.69,.45);
 }else if(id==='policeStationFront'){
  box(5.6,.2,1.5,0,.1,0,stone);box(5.6,3.9,.65,0,2.05,-.38,brick);
  // British brickwork courses with staggered joints and pale mortar.
  for(let y=.32,row=0;y<3.95;y+=.17,row++)for(let x=-2.73+(row%2)*.25;x<2.72;x+=.52){
   if(Math.abs(x)<.92&&y<2.85)continue;
   box(.49,.012,.012,x,y,-.045,mortar);
  }
  // Entrance recess with two glazed security doors.
  box(1.85,2.95,.15,0,1.54,-.06,dark);
  for(const x of [-.44,.44]){
   box(.83,2.55,.07,x,1.45,.045,steel);box(.69,1.72,.014,x,1.73,.087,screen);
   box(.7,.7,.014,x,.59,.087,blue);box(.04,.28,.08,x+(x<0?.26:-.26),1.34,.13,steel);
  }
  box(2.3,.34,.31,0,3.24,-.02,blue);label('POLICE',2.16,.29,0,3.25,.15);
  // Traditional projecting illuminated blue lamp mounted to facade.
  rod([1.99,2.96,.03],[1.99,2.96,.51],.045,black);
  cyl(.20,.08,1.99,3.03,.55,black);cyl(.17,.43,1.99,3.29,.55,blue);cyl(.20,.08,1.99,3.53,.55,black);
  box(.45,.05,.45,1.99,3.58,.55,black);
  // Side windows and sill lintels.
  for(const x of [-1.95,1.95]){box(1.02,1.46,.07,x,1.95,.005,stone);box(.86,1.28,.017,x,1.95,.049,screen);box(.07,1.3,.04,x,1.95,.07,white);box(.9,.07,.04,x,1.95,.07,white);box(1.16,.12,.29,x,1.16,.12,stone);box(1.18,.15,.32,x,2.76,.10,stone)}
  box(5.8,.16,.85,0,4.06,-.32,stone);
 }else if(id==='policeUniform'){
  // Uniform on display mannequin, not a wearable/skinned rig.
  const skin=mat(0xb9a28e),navy=mat(0x171e29),vest=mat(0x222c39);
  cyl(.32,.08,0,.04,0,black);rod([0,.08,0],[0,1.73,0],.024,steel);
  box(.61,.79,.29,0,1.36,0,navy);box(.69,.58,.34,0,1.42,.05,vest);
  for(const x of [-.18,.18]){box(.18,.16,.035,x,1.49,.236,black);box(.16,.21,.15,x,1.06,.08,black)}
  box(.73,.09,.33,0,1.02,0,black);
  for(const x of [-.19,.19]){box(.25,.77,.27,x,.64,0,navy);box(.24,.43,.28,x,.25,0,navy)}
  for(const x of [-.43,.43]){const arm=box(.23,.68,.26,x,1.45,0,navy);arm.rotation.z=x>0?.12:-.12;box(.12,.13,.13,x,1.05,.03,skin)}
  cyl(.13,.23,0,1.93,0,skin);const head=new THREE.Mesh(new THREE.SphereGeometry(.19,16,12),skin);head.position.y=2.15;g.add(head);
  box(.29,.075,.29,0,2.34,0,black);box(.23,.06,.20,0,2.39,0,black);
  box(.18,.25,.09,.34,1.47,.23,black);box(.12,.06,.05,.34,1.57,.29,steel);
  box(.24,.11,.026,-.14,1.64,.226,white);box(.12,.13,.035,.18,1.65,.225,yellow);
  box(.13,.22,.08,.31,.94,.19,black);box(.13,.22,.08,-.31,.94,.19,black);
 }else throw new Error('Unknown police asset '+id);
 g.userData={id,status:'pending-review',branch:'pr-dev',gameplayIntegrated:false};
 return g;
}
