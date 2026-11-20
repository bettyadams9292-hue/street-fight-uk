/** Street Fight UK — reference-matched black office desk telephone.
 * Isolated review model; not approved or registered in gameplay.
 * Units metres, Y up. Front is +Z. */
import * as THREE from 'three';
export const TELEPHONE_ASSETS=[{id:'blackDeskTelephone',label:'Black corded office desk telephone',category:'office',status:'pending-review'}] as const;
export function createTelephoneAsset(id:string):THREE.Group {
 if(id!=='blackDeskTelephone')throw new Error('Unknown telephone asset '+id);
 const g=new THREE.Group();g.name=id;
 const plastic=new THREE.MeshStandardMaterial({color:0x222326,roughness:.83,metalness:.03});
 const face=new THREE.MeshStandardMaterial({color:0x36383b,roughness:.78,metalness:.03});
 const edge=new THREE.MeshStandardMaterial({color:0x101114,roughness:.88});
 const button=new THREE.MeshStandardMaterial({color:0x17191b,roughness:.66});
 const display=new THREE.MeshStandardMaterial({color:0x7d8484,roughness:.5,metalness:.04});
 const dark=new THREE.MeshStandardMaterial({color:0x090a0c,roughness:.95});
 const cord=new THREE.MeshStandardMaterial({color:0x101113,roughness:.95});
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material,r=0)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.rotation.x=r;g.add(mesh);return mesh};
 const cyl=(r:number,h:number,x:number,y:number,z:number,m:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,18),m);mesh.position.set(x,y,z);g.add(mesh);return mesh};
 // Low rectangular desk console with gently sloping upper control surface.
 box(.285,.027,.225,.15,.023,.035,edge);
 box(.278,.018,.214,.15,.041,.029,face,-.12);
 // Two physical cradle supports under the handset at the left edge of the console.
 // The handset rests horizontally along the depth of the telephone, not beside it.
 for(const z of [-.050,.111]){
   box(.057,.025,.032,.040,.063,z,plastic);
   box(.046,.006,.023,.040,.078,z,dark);
   // Raised outer lips retain the receiver in the hook.
   for(const x of [.012,.068])box(.008,.015,.033,x,.081,z,plastic);
 }
 // Speaker grill (small dark slits).
 for(let row=0;row<3;row++)for(let col=0;col<8;col++)box(.0024,.0015,.008,.075+col*.006,.052,-.018+row*.007,dark);
 // LCD at upper rear right with black inset.
 box(.093,.003,.039,.192,.058,-.050,edge,-.12);
 box(.083,.004,.030,.192,.060,-.050,display,-.12);
 // Number keypad: 3 columns, 4 rows, visibly separated rounded dark keys.
 for(let row=0;row<4;row++)for(let col=0;col<3;col++){
 const x=.157+col*.033,z=.018+row*.028;
 const k=box(.024,.006,.014,x,.061+row*.001,z,button,-.12);
 k.geometry.dispose();k.geometry=new THREE.BoxGeometry(.024,.006,.015);
 }
 // Function buttons, right-side volume rocker and dial.
 for(let i=0;i<4;i++)box(.017,.005,.011,.113+i*.026,.061,-.003,button);
 const dial=cyl(.012,.005,.260,.061,-.011,button);dial.rotation.x=Math.PI/2;
 box(.036,.006,.014,.261,.062,.110,button);
 // Handset resting on the cradle, oriented front-to-back.
 // The underside touches both cradle supports; nothing floats in space.
 const receiver=new THREE.Group();receiver.name='Handset seated on hook';
 const handsetBox=(w:number,h:number,depth:number,x:number,y:number,z:number,m:THREE.Material)=>{
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,depth),m);
   mesh.position.set(x,y,z);receiver.add(mesh);return mesh;
 };
 const handsetCylinder=(radius:number,depth:number,z:number,m:THREE.Material)=>{
   const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,depth,24),m);
   mesh.rotation.x=Math.PI/2;mesh.position.set(.040,.103,z);receiver.add(mesh);return mesh;
 };
 handsetBox(.038,.026,.159,.040,.102,.031,plastic);
 handsetCylinder(.026,.037,-.057,plastic);
 handsetCylinder(.026,.037,.119,plastic);
 handsetBox(.044,.022,.037,.040,.105,-.057,face);
 handsetBox(.044,.022,.037,.040,.105,.119,face);
 // Visible earpiece grille on top of the rear end.
 for(let i=0;i<5;i++)handsetBox(.002,.001,.014,.026+i*.007,.119,-.057,dark);
 // Microphone slot at the front end.
 handsetBox(.024,.001,.007,.040,.119,.119,dark);
 g.add(receiver);
 // Cable, including distinct visible tightly wound coil between handset and console.
 const pathPts:THREE.Vector3[]=[];
 // Cable exits the handset at the front, loops outside the left of the phone,
 // then coils back into the console near its front-left edge.
 pathPts.push(new THREE.Vector3(.040,.099,.143),new THREE.Vector3(-.006,.063,.167),new THREE.Vector3(-.046,.026,.170));
 const n=180,turns=22;
 for(let i=0;i<=n;i++){
   const t=i/n,angle=t*turns*Math.PI*2;
   pathPts.push(new THREE.Vector3(-.046+t*.103,.018+Math.sin(angle)*.006,.175+Math.cos(angle)*.008));
 }
 pathPts.push(new THREE.Vector3(.068,.020,.161),new THREE.Vector3(.075,.024,.133));
 const cable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pathPts),550,.0028,6,false),cord);g.add(cable);
 // Small rubber feet.
 for(const x of [.035,.265])for(const z of [-.060,.127])box(.024,.006,.018,x,.005,z,dark);
 g.userData={collection:'SFUK_telephone_review',id,units:'metres',status:'pending-review',source:'user reference photograph',standalone:true};
 return g;
}
