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
 // Raised handset cradle on left side of console.
 box(.066,.031,.078,.047,.062,.103,plastic);
 box(.052,.009,.041,.047,.081,.106,dark);
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
 // Receiver standing upright to left of base, like the supplied reference.
 // Curved receiver silhouette with thicker ear and mouth sections.
 box(.043,.184,.038,-.145,.160,-.020,plastic);
 const upper=cyl(.029,.043,-.145,.265,-.020,plastic);upper.rotation.z=Math.PI/2;
 const lower=cyl(.026,.041,-.145,.070,-.020,plastic);lower.rotation.z=Math.PI/2;
 box(.033,.041,.038,-.145,.265,-.020,face);
 box(.035,.037,.038,-.145,.073,-.020,face);
 // Earpiece diagonal grill slots on front.
 for(let i=0;i<5;i++){const slot=box(.002,.013,.001,-.158+i*.006,.272,-.0002,dark);slot.rotation.z=-.35}
 // Microphone recess.
 box(.027,.012,.001,-.145,.073,.0004,dark);
 // Cable, including distinct visible tightly wound coil between handset and console.
 const pathPts:THREE.Vector3[]=[];
 const start=new THREE.Vector3(-.145,.042,.007),coilStart=new THREE.Vector3(-.173,.019,.150);
 pathPts.push(start,new THREE.Vector3(-.163,.017,.060),coilStart);
 const n=155,turns=25;
 for(let i=0;i<=n;i++){const t=i/n;pathPts.push(new THREE.Vector3(-.173+t*.23,.018+Math.sin(t*turns*Math.PI*2)*.006,.150+Math.cos(t*turns*Math.PI*2)*.009))}
 pathPts.push(new THREE.Vector3(.065,.019,.150),new THREE.Vector3(.075,.022,.128));
 const cable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pathPts),550,.0028,6,false),cord);g.add(cable);
 // Small rubber feet.
 for(const x of [.035,.265])for(const z of [-.060,.127])box(.024,.006,.018,x,.005,z,dark);
 g.userData={collection:'SFUK_telephone_review',id,units:'metres',status:'pending-review',source:'user reference photograph',standalone:true};
 return g;
}
