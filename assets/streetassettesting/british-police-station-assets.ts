import * as THREE from 'three';
/** British police station assets. V3 geometry and material polish. Three models only. Pending visual approval. pr-dev only. */
export const POLICE_ASSETS=[
{id:'policeCustodyCell',name:'British custody cell',category:'Custody'},
{id:'policeCustodyDesk',name:'Custody sergeant booking desk',category:'Custody'},
{id:'policeStationFront',name:'British police station entrance',category:'Exterior'}
] as const;
export function createPoliceAsset(id:string):THREE.Group{
 const g=new THREE.Group();g.name=id;
 const mat=(c:number,metalness=0)=>new THREE.MeshStandardMaterial({color:c,roughness:metalness?.36:.78,metalness});
 const concrete=new THREE.MeshStandardMaterial({color:0xa8aa9f,roughness:.94});const grout=mat(0x686b68);const brushed=mat(0xa5b0b6,.65);const glass=new THREE.MeshStandardMaterial({color:0x7c9aaa,metalness:.2,roughness:.22,transparent:true,opacity:.64});const warm=mat(0xb6a78b),rubber=mat(0x34383a);const brick=mat(0x835b52),mortar=mat(0xb2aba1),stone=mat(0x9b9d9c),dark=mat(0x222a31),black=mat(0x11161a),steel=mat(0x858e96,.7),blue=mat(0x184c98),white=mat(0xe8e9e4),floor=mat(0x737a7d),wood=mat(0x6c5445),paper=mat(0xdeddd4),screen=mat(0x274756),yellow=mat(0xd1bb52);
 function box(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o}
 function cyl(r:number,h:number,x:number,y:number,z:number,m:THREE.Material){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,16),m);o.position.set(x,y,z);g.add(o);return o}
 function rod(a:[number,number,number],b:[number,number,number],r:number,m:THREE.Material){const v=new THREE.Vector3(...a),q=new THREE.Vector3(...b),delta=q.clone().sub(v),o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),10),m);o.position.copy(v.add(q).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());g.add(o);return o}
 function panel(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material,r=.08){const o=new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape().moveTo(-w/2+r,-h/2).lineTo(w/2-r,-h/2).quadraticCurveTo(w/2,-h/2,w/2,-h/2+r).lineTo(w/2,h/2-r).quadraticCurveTo(w/2,h/2,w/2-r,h/2).lineTo(-w/2+r,h/2).quadraticCurveTo(-w/2,h/2,-w/2,h/2-r).lineTo(-w/2,-h/2+r).quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2),{depth:d,bevelEnabled:true,bevelSize:.012,bevelThickness:.008,bevelSegments:2,steps:1}),m);o.position.set(x,y,z);g.add(o);return o}
 function label(t:string,w:number,h:number,x:number,y:number,z:number,rot=0){const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d')!;ctx.fillStyle='#12305b';ctx.fillRect(0,0,1024,256);ctx.strokeStyle='#d4e2f1';ctx.lineWidth=12;ctx.strokeRect(12,12,1000,232);ctx.fillStyle='white';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 100px Arial';ctx.fillText(t,512,130,950);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const o=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));o.position.set(x,y,z);o.rotation.y=rot;g.add(o)}
 if(id==='policeCustodyCell'){
  // Room open at front for inspection; door is an independent solid custody barrier, not a retail grille.
  box(3.5,.13,3.8,0,.065,0,floor);box(3.5,2.65,.17,0,1.39,-1.82,concrete);
  box(.15,2.65,3.8,-1.69,1.39,0,concrete);box(.15,2.65,3.8,1.69,1.39,0,concrete);
  // Ceiling intentionally omitted for an unobstructed inspection of the cell interior.
  // Rear-wall concrete panel seams and skirting.
  for(let x=-1.2;x<1.5;x+=1.2)box(.012,2.5,.012,x,1.35,-1.72,mortar);
  box(3.25,.12,.05,0,.17,-1.7,dark);
  // Short front returns create the cell doorway; door has full-height closely spaced steel bars.
  box(.85,2.5,.15,-1.29,1.36,1.8,concrete);box(.85,2.5,.15,1.29,1.36,1.8,concrete);
  box(1.75,.24,.17,0,2.53,1.8,concrete);
  const doorZ=1.84;box(.065,2.35,.09,-.78,1.31,doorZ,steel);box(.065,2.35,.09,.78,1.31,doorZ,steel);
  box(1.6,.07,.09,0,.18,doorZ,steel);box(1.6,.07,.09,0,2.47,doorZ,steel);
  // Security door uses heavy upright bars, horizontal bracing, hinge blocks and a lockcase.
  for(let i=0;i<9;i++)rod([-.64+i*.16,.22,doorZ],[-.64+i*.16,2.44,doorZ],.026,steel);
  box(1.55,.055,.075,0,1.28,doorZ,steel);
  for(const y of [.43,1.94])box(.15,.17,.18,-.83,y,doorZ,black);
  box(.19,.32,.17,.62,1.13,1.94,black);
  box(.15,.06,.04,.65,1.12,2.04,steel);
  // Flush-mounted observation panel beside the door.
  box(.30,.32,.05,1.24,1.61,1.91,dark);box(.22,.19,.012,1.24,1.61,1.94,glass);
  // Fixed custody bench, robust slab on wall-mounted brackets.
  panel(1.95,.12,.60,-.18,.61,-1.65,brushed,.045);box(.16,.53,.48,-1.03,.33,-1.35,stone);box(.16,.53,.48,.67,.33,-1.35,stone);
  // Stainless custodial toilet at rear, flush panel and low partition.
  box(.75,1.05,.11,1.21,.58,-.96,concrete);cyl(.25,.35,1.16,.32,-1.35,steel);
  const bowl=new THREE.Mesh(new THREE.TorusGeometry(.21,.045,8,24),steel);bowl.rotation.x=Math.PI/2;bowl.position.set(1.16,.52,-1.35);g.add(bowl);
  box(.21,.16,.035,1.12,1.17,-1.71,steel);
  // Bolted floor drain and recessed ceiling-height lighting fixture.
  box(.19,.007,.19,-1.16,.138,.88,steel);
  for(let i=0;i<4;i++)box(.012,.009,.17,-1.23+i*.045,.145,.88,black);
  box(.95,.08,.21,0,2.54,-1.60,white);
  // Tamper-resistant inspection hatch and wall-mounted ventilation grille.
  panel(.46,.29,.035,-.89,1.66,-1.70,steel,.03);
  for(let i=0;i<6;i++)box(.30,.009,.008,-.89,1.56+i*.036,-1.654,black);
  for(const z of [-.92,.02,.96])box(.02,2.50,.015,-1.605,1.35,z,grout);
  box(.34,.26,.05,0,2.23,-1.7,dark);box(.25,.17,.02,0,2.23,-1.66,screen);
 }else if(id==='policeCustodyDesk'){
  // Deep laminate booking counter with rounded fascia and reinforced service edge.
  box(2.65,.11,.93,0,1.06,0,wood);box(2.65,.91,.16,0,.55,.36,wood);box(.16,.92,.85,-1.23,.55,0,wood);box(.16,.92,.85,1.23,.55,0,wood);
  box(2.7,.06,.99,0,1.13,0,stone);
  panel(2.51,.64,.025,0,.66,.445,dark,.045);
  for(const x of [-1.12,1.12])box(.035,.68,.035,x,.68,.48,brushed);
  // Booking counter front with flush drawer faces, recessed plinth and metal edge trim.
  box(2.43,.13,.09,0,.14,.43,dark);
  for(const x of [-.72,0,.72]){panel(.59,.25,.025,x,.76,.49,wood,.025);box(.16,.025,.03,x,.76,.53,steel)}
  box(2.72,.025,.035,0,1.16,.46,steel);box(.68,.48,.07,-.48,1.49,-.14,black);box(.61,.38,.016,-.48,1.5,-.096,screen);
  box(.11,.32,.09,-.48,1.22,-.15,black);box(.61,.035,.24,-.48,1.22,.09,dark);box(.22,.04,.17,.48,1.21,.13,black);
  for(let i=0;i<5;i++)for(let j=0;j<3;j++)box(.023,.007,.02,.38+i*.047,1.238,.07+j*.038,steel);
  box(.55,.024,.37,.42,1.2,-.29,paper);box(.46,.012,.28,.47,1.23,-.32,white);
  for(let i=0;i<7;i++)box(.33,.004,.006,.45,1.24,-.43+i*.039,stone);
  box(.29,.27,.26,1.03,1.3,-.23,dark);box(.20,.16,.012,1.03,1.33,-.087,screen);
  box(.3,.08,.08,1.03,1.52,-.22,black);rod([1.03,1.52,-.22],[1.03,1.63,-.22],.014,steel);
  // Booking-in microphone, pen tray, card reader and desktop equipment.
  cyl(.085,.028,-1.03,1.19,-.23,black);rod([-1.03,1.2,-.23],[-1.01,1.55,-.25],.013,steel);
  const mic=new THREE.Mesh(new THREE.SphereGeometry(.035,12,8),black);mic.position.set(-1.01,1.57,-.25);g.add(mic);
  // Two-part booking telephone with receiver sitting on its cradle.
  box(.26,.06,.18,-.09,1.22,.27,black);rod([-.18,1.30,.27],[0,1.30,.27],.025,rubber);
  box(.26,.04,.13,-.07,1.20,.27,black);box(.14,.025,.1,-.07,1.23,.27,steel);
  // Under-counter filing cabinet, handles and kickboard.
  box(.55,.64,.43,.85,.47,-.12,dark);
  for(const y of [.33,.55,.76]){box(.47,.16,.02,.85,y,.115,steel);box(.18,.016,.023,.85,y,.137,black)}
  label('CUSTODY',.95,.24,0,.69,.45);
 }else if(id==='policeStationFront'){
  box(5.6,.2,1.5,0,.1,0,stone);
  // Build the masonry as actual piers, lintel and upper wall: no opaque wall behind glazing.
  box(1.82,3.9,.65,-1.89,2.05,-.38,brick);box(1.82,3.9,.65,1.89,2.05,-.38,brick);
  box(1.96,1.05,.65,0,3.51,-.38,brick);
  box(1.96,.20,.65,0,.23,-.38,brick);
  // British brickwork courses with staggered joints and pale mortar.
  for(let y=.32,row=0;y<3.95;y+=.17,row++)for(let x=-2.73+(row%2)*.25;x<2.72;x+=.52){
   if(Math.abs(x)<1.02&&y<3.03)continue;
   box(.49,.012,.012,x,y,-.045,mortar);
  }
  // Entrance recess with two glazed security doors.
  // Open entrance reveal, framed glazing rather than a solid black slab.
  for(const x of [-.94,.94])box(.09,2.85,.16,x,1.57,-.05,dark);
  box(1.9,.12,.16,0,2.95,-.05,dark);
  for(const x of [-.44,.44]){
   box(.83,.08,.07,x,.22,.045,steel);box(.83,.08,.07,x,2.70,.045,steel);
   for(const dx of [-.38,.38])box(.055,2.48,.07,x+dx,1.46,.045,steel);
   box(.69,1.72,.014,x,1.73,.087,glass);
   panel(.69,.69,.018,x,.59,.085,blue,.018);box(.04,.28,.08,x+(x<0?.26:-.26),1.34,.13,steel);
  }
  box(2.3,.34,.31,0,3.24,-.02,blue);label('POLICE',2.16,.29,0,3.25,.15);
  // Traditional projecting illuminated blue lamp mounted to facade.
  rod([1.99,2.96,.03],[1.99,2.96,.51],.045,black);
  cyl(.20,.08,1.99,3.03,.55,black);cyl(.17,.43,1.99,3.29,.55,new THREE.MeshStandardMaterial({color:0x1458c7,emissive:0x062a72,emissiveIntensity:.6,roughness:.18,metalness:.18}));cyl(.20,.08,1.99,3.53,.55,black);
  box(.45,.05,.45,1.99,3.58,.55,black);
  // Side windows and sill lintels.
  for(const x of [-1.95,1.95]){box(1.02,.07,.07,x,1.24,.005,stone);box(1.02,.07,.07,x,2.66,.005,stone);for(const dx of [-.48,.48])box(.07,1.42,.07,x+dx,1.95,.005,stone);box(.86,1.28,.017,x,1.95,.049,glass);box(.07,1.3,.04,x,1.95,.07,white);box(.9,.07,.04,x,1.95,.07,white);box(1.16,.12,.29,x,1.16,.12,stone);box(1.18,.15,.32,x,2.76,.10,stone)}
  // Entrance canopy, exterior wall lights, stone steps and police-blue lamp housing.
  box(2.48,.13,.85,0,3.00,.36,stone);
  for(const x of [-1.13,1.13]){box(.15,.28,.16,x,2.58,.06,black);box(.10,.17,.10,x,2.58,.16,warm)}
  box(2.24,.15,.69,0,.17,.55,stone);box(2.24,.13,.45,0,.10,.95,stone);
  // Stone keystones, exterior name plaque and brick header course.
  for(const x of [-1.95,1.95])box(1.14,.09,.12,x,2.77,.01,stone);
  box(.52,.34,.045,-2.17,3.32,.005,blue);
  box(5.8,.16,.85,0,4.06,-.32,stone);
 }else throw new Error('Unknown police asset '+id);
 g.userData={id,status:'pending-review',branch:'pr-dev',gameplayIntegrated:false};
 return g;
}
