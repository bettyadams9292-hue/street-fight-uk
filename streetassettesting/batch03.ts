/** Street Fight UK — Batch 03 isolated world-prop prototypes. British industrial and high-street aesthetic. */
import * as THREE from 'three';
export const ASSETS=[
{id:'palletStack',label:'Weathered timber pallet stack',gameId:'pallets'},
{id:'scrapHeap',label:'British scrapyard metal heap',gameId:'scrap'},
{id:'storageRack',label:'Industrial warehouse storage rack',gameId:'rack'},
{id:'chestTrunk',label:'Old storage chest',gameId:'chest'},
{id:'rubbishBags',label:'Black bin bags',gameId:'rubbish_bags'},
{id:'shippingContainer',label:'Weathered shipping container',gameId:'container'},
{id:'tyreStack',label:'Used tyre stack',gameId:'tyre_stack'},
{id:'poolTable',label:'British pub pool table',gameId:'pool_table'},
{id:'fruitMachine',label:'British pub fruit machine',gameId:'fruit_machine'},
{id:'washBasin',label:'Wall-mounted wash basin',gameId:'basin'}
] as const;
export type AssetId=typeof ASSETS[number]['id'];
export function createAsset(id:AssetId):THREE.Group{
 const T=THREE,g=new T.Group();g.name='SFUK_B03_'+id;
 const m=(c:number,metal=0,rough=.7)=>new T.MeshStandardMaterial({color:c,metalness:metal,roughness:rough});
 const wood=m(0x81664b),woodDark=m(0x574431),steel=m(0x8b969a,.75,.45),dark=m(0x282d30),rubber=m(0x202225),green=m(0x24584a),felt=m(0x1b6b4e),white=m(0xd8d6ce),brass=m(0xa78b52,.7),blue=m(0x446b80),red=m(0x9c4b3e),rust=m(0x8a5a41),glass=m(0x9fbac0,.2,.25),black=m(0x121718);
 const B=(w:number,h:number,d:number,x:number,y:number,z:number,mat:T.Material)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o};
 const C=(r:number,h:number,x:number,y:number,z:number,mat:T.Material,n=24)=>{const o=new T.Mesh(new T.CylinderGeometry(r,r,h,n),mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o};
 const S=(r:number,x:number,y:number,z:number,mat:T.Material)=>{const o=new T.Mesh(new T.IcosahedronGeometry(r,2),mat);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o};
 const R=(a:number[],b:number[],r:number,mat:T.Material)=>{const p=new T.Vector3(...a),q=new T.Vector3(...b),v=q.clone().sub(p);const o=new T.Mesh(new T.CylinderGeometry(r,r,v.length(),10),mat);o.position.copy(p.add(q).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());g.add(o);return o};
 if(id==='palletStack'){
  for(let k=0;k<3;k++){const y=k*.16;for(const z of [-.39,0,.39])B(1.17,.035,.17,0,y+.13,z,wood);
   for(const x of [-.46,0,.46])for(const z of [-.36,.36])B(.16,.09,.17,x,y+.065,z,woodDark);
   for(const z of [-.35,.35])B(1.15,.028,.17,0,y+.018,z,woodDark);
   for(let i=0;i<5;i++)B(.15,.014,.018,-.48+i*.24,y+.15,.48,steel);
  }
 }
 if(id==='scrapHeap'){
  B(2.2,.06,1.4,0,.03,0,dark);
  for(let i=0;i<18;i++){const x=Math.sin(i*2.4)*.8,z=Math.cos(i*1.9)*.5,y=.12+(i%5)*.14;const o=B(.24+(i%4)*.13,.035,.08,x,y,z,i%4===0?rust:steel);o.rotation.y=i*.43;o.rotation.z=(i%3-1)*.18;}
  for(let i=0;i<4;i++){const x=-.65+i*.43;const o=C(.16,.05,x,.18,.35,rubber,20);o.rotation.z=Math.PI/2;}
 }
 if(id==='storageRack'){
  for(const x of [-1.08,1.08])for(const z of [-.38,.38])B(.065,2.22,.065,x,1.11,z,blue);
  for(const y of [.18,.88,1.58,2.17]){B(2.2,.055,.85,0,y,0,wood);for(const z of [-.40,.40])B(2.22,.065,.035,0,y-.065,z,steel);}
  for(let i=0;i<6;i++){const x=-.83+(i%3)*.80,y=.23+Math.floor(i/3)*.7;B(.53,.37,.58,x,y+.185,0,i%2?woodDark:wood);B(.32,.08,.008,x,y+.2,.298,white);}
 }
 if(id==='chestTrunk'){
  B(1.18,.56,.65,0,.32,0,woodDark);B(1.14,.48,.63,0,.33,0,wood);
  B(1.24,.15,.70,0,.67,0,woodDark);
  for(const x of [-.46,.46]){B(.045,.66,.69,x,.38,0,steel);B(.13,.07,.035,x,.69,-.34,brass);}
  B(.15,.14,.035,0,.42,.344,brass);B(.06,.07,.04,0,.41,.365,dark);
  for(const z of [-.27,.27])B(1.20,.045,.055,0,.14,z,woodDark);
 }
 if(id==='rubbishBags'){
  for(let i=0;i<5;i++){const x=(i%3-1)*.45,z=Math.floor(i/3)*.43-.15;const r=.21+(i%2)*.045;const o=S(r,x,r,z,rubber);o.scale.set(1,1.22,.88);C(.075,.06,x,r*2.05,z,black,12);R([x-.05,r*2.08,z],[x+.055,r*2.15,z],.019,black);}
 }
 if(id==='shippingContainer'){
  B(3.3,2.22,1.35,0,1.13,0,blue);
  for(const side of [-1,1])for(let i=0;i<17;i++)B(.038,2.04,.014,-1.52+i*.19,1.12,side*.686,i%5===0?steel:blue);
  for(const x of [-1.62,1.62])for(const z of [-.67,.67])B(.11,2.26,.10,x,1.13,z,steel);
  for(const x of [-.81,.81]){B(.035,2.02,.022,x,1.12,.71,steel);for(const y of [.38,1.75])B(.11,.12,.04,x,y,.735,brass);}
  B(3.25,.085,1.40,0,2.27,0,dark);
 }
 if(id==='tyreStack'){
  for(let j=0;j<2;j++)for(let i=0;i<4;i++){const x=j*.55-.275,y=.13+i*.24;const t=new T.Mesh(new T.TorusGeometry(.22,.09,12,32),rubber);t.rotation.x=Math.PI/2;t.position.set(x,y,0);g.add(t);C(.105,.012,x,y,0,steel,24);}
 }
 if(id==='poolTable'){
  B(2.15,.22,1.18,0,.82,0,woodDark);B(1.95,.025,.98,0,.945,0,felt);
  for(const x of [-.99,.99])B(.10,.09,1.14,x,.99,0,wood);
  for(const z of [-.55,.55])B(2.10,.09,.10,0,.99,z,wood);
  for(const x of [-.92,0,.92])for(const z of [-.46,.46])C(.068,.02,x,.96,z,black,20);
  for(const x of [-.82,.82])for(const z of [-.43,.43])B(.14,.73,.14,x,.39,z,woodDark);
  for(let i=0;i<8;i++)S(.034,-.43+(i%4)*.19,.997,-.13+Math.floor(i/4)*.17,i===0?white:i%2?red:brass);
 }
 if(id==='fruitMachine'){
  B(.72,1.61,.50,0,.88,0,black);B(.76,.18,.54,0,1.72,0,red);
  B(.65,.37,.025,0,1.40,.267,blue);
  for(let i=0;i<3;i++){B(.16,.23,.028,-.20+i*.20,1.39,.285,white);C(.035,.014,-.20+i*.20,1.40,.305,red,12).rotation.x=Math.PI/2;}
  B(.62,.24,.024,0,1.06,.27,brass);
  for(let i=0;i<5;i++)C(.033,.019,-.22+i*.11,.90,.27,red,16).rotation.x=Math.PI/2;
  B(.47,.05,.09,0,.65,.29,dark);B(.62,.30,.035,0,.34,.275,blue);
  for(const x of [-.26,.26])B(.09,.11,.07,x,.07,0,dark);
 }
 if(id==='washBasin'){
  B(.79,.12,.46,0,.82,0,white);
  const bowl=new T.Mesh(new T.TorusGeometry(.24,.048,12,36),white);bowl.rotation.x=Math.PI/2;bowl.scale.set(1.38,.77,1);bowl.position.set(0,.895,.02);g.add(bowl);
  C(.038,.012,0,.84,.03,steel,20);
  B(.14,.24,.08,0,.69,-.15,white);C(.045,.20,0,.99,-.17,steel,20);
  R([0,1.08,-.17],[0,1.08,-.045],.022,steel);
  for(const x of [-.13,.13])C(.028,.02,x,.93,-.17,brass,16);
  B(.11,.37,.11,0,.46,-.14,white);B(.58,.055,.16,0,.27,-.24,white);
 }
 g.userData={collection:'streetassettesting',batch:3,id,units:'metres',status:'review-required',style:'British streets and interiors'};
 return g;
}
