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

  // Three separate complete UK/EUR-style timber pallets, staggered but not exploded.
  const plank=[m(0x8b7359),m(0x76614b),m(0x9a8060),m(0x695441)];
  for(let k=0;k<3;k++){
   const ox=k===1?.028:k===2?-.024:0,oz=k===1?-.018:k===2?.022:0,base=k*.155;
   for(let j=0;j<5;j++) B(.18,.024,.79,ox-.40+j*.20,base+.132,oz,plank[(j+k)%4]);
   for(const x of [-.39,0,.39])for(const z of [-.30,.30])B(.16,.088,.17,ox+x,base+.072,oz+z,woodDark);
   for(const x of [-.39,0,.39])B(.16,.023,.79,ox+x,base+.018,oz,plank[(k+1)%4]);
   for(const z of [-.32,.32])B(1.0,.025,.12,ox,base+.114,oz+z,woodDark);
  }

 }
 if(id==='scrapHeap'){

  // A compact, overlapping heap of discarded British domestic electronics.
  const plastic=[m(0xb3a99a),m(0x4c5355),m(0x7c766c),m(0x8b624a),m(0x34434b)];
  const device=(x:number,y:number,z:number,w:number,h:number,d:number,angle:number,kind:number)=>{
   const body=B(w,h,d,x,y,z,plastic[kind%plastic.length]);body.rotation.z=angle;
   const screen=B(w*.72,h*.57,.009,x,y+.02,z+d*.505,kind%3===0?glass:dark);screen.rotation.z=angle;
   B(w*.22,.015,.013,x,y-h*.35,z+d*.52,steel).rotation.z=angle;
   for(let t=0;t<3;t++) C(.014,.008,x+w*.30,y+h*(t-1)*.18,z+d*.53,black,12).rotation.x=Math.PI/2;
  };
  device(-.43,.28,.05,.77,.43,.35,-.16,0);
  device(.31,.34,-.18,.66,.49,.30,.13,1);
  device(-.15,.73,-.12,.55,.38,.30,.19,2);
  device(.42,.73,.13,.49,.34,.26,-.18,3);
  device(-.46,.67,-.30,.35,.24,.28,.22,4);
  for(let i=0;i<5;i++){const x=-.7+i*.35;const box=B(.29,.13,.29,x,.12,.42,plastic[(i+2)%5]);box.rotation.y=i*.27;}
  for(let i=0;i<7;i++){const x=-.64+i*.19,z=.3+Math.sin(i*2)*.19;R([x,.20,z],[x+.12,.38,z+.09],.008,black);}

 }
 if(id==='storageRack'){
  for(const x of [-1.08,1.08])for(const z of [-.38,.38])B(.065,2.22,.065,x,1.11,z,blue);
  for(const y of [.18,.88,1.58,2.17]){B(2.2,.055,.85,0,y,0,wood);for(const z of [-.40,.40])B(2.22,.065,.035,0,y-.065,z,steel);}
  for(let i=0;i<6;i++){const x=-.83+(i%3)*.80,y=.23+Math.floor(i/3)*.7;B(.53,.37,.58,x,y+.185,0,i%2?woodDark:wood);B(.32,.08,.008,x,y+.2,.298,white);}
 }
 if(id==='chestTrunk'){

  // Traditional wooden trunk with raised framed panels and working-looking hinges.
  B(1.17,.53,.66,0,.33,0,woodDark);
  B(1.11,.47,.62,0,.34,0,wood);
  for(const x of [-.51,.51])B(.065,.48,.68,x,.34,0,woodDark);
  for(const y of [.13,.56])B(1.17,.045,.68,0,y,0,woodDark);
  for(const x of [-.32,.32])B(.39,.32,.014,x,.34,.322,woodDark);
  for(const x of [-.32,.32])B(.34,.27,.018,x,.34,.336,wood);
  B(1.22,.11,.72,0,.67,0,woodDark);
  B(1.16,.033,.66,0,.73,0,wood);
  for(const x of [-.46,.46]){B(.095,.045,.055,x,.64,-.35,brass);B(.065,.16,.018,x,.57,-.345,steel);}
  B(.14,.15,.025,0,.46,.352,brass);B(.042,.058,.028,0,.44,.372,black);
  for(const x of [-.52,.52])B(.045,.52,.70,x,.35,0,steel);

 }
 if(id==='rubbishBags'){

  // Irregular soft sacks: tapered, wrinkled silhouettes and gathered twisted necks.
  const bagMat=m(0x1c2024,.02,.31),crease=m(0x30343a,.02,.40);
  for(let i=0;i<5;i++){
   const x=(i%3-1)*.39,z=Math.floor(i/3)*.40-.20,r=.19+(i%2)*.03,h=.44+(i%3)*.045;
   const profile=[new T.Vector2(0,0),new T.Vector2(r*.80,.012),new T.Vector2(r*1.05,.08),new T.Vector2(r*.97,h*.35),new T.Vector2(r*.89,h*.66),new T.Vector2(r*.61,h*.86),new T.Vector2(.042,h*.95),new T.Vector2(.025,h*1.03),new T.Vector2(0,h*1.05)];
   const mesh=new T.Mesh(new T.LatheGeometry(profile,13),bagMat);mesh.position.set(x,0,z);mesh.scale.x=1.04;mesh.scale.z=.84;mesh.rotation.y=i*.8;g.add(mesh);
   const knot=S(.047,x,h*1.035,z,bagMat);knot.scale.set(.8,.45,.65);
   for(let k=0;k<7;k++){const a=k*Math.PI*2/7;R([x+Math.cos(a)*r*.81,.09,z+Math.sin(a)*r*.69],[x+Math.cos(a)*r*.56,h*.77,z+Math.sin(a)*r*.48],.004,crease);}
   R([x-.038,h*1.04,z],[x+.048,h*1.08,z+.016],.015,bagMat);
  }

 }
 if(id==='shippingContainer'){

  // Corrugated 20-foot-style shipping container, door at its short end.
  const faded=m(0x547687,.42,.72),edge=m(0x465158,.7,.46),mark=m(0xb4b9ad);
  B(3.35,2.23,1.42,0,1.15,0,faded);
  for(const z of [-.715,.715])for(let i=0;i<23;i++)B(.034,2.09,.028,-1.59+i*.144,1.15,z,edge);
  for(const x of [-1.67,1.67])for(let i=0;i<9;i++)B(.025,2.09,.11,x,1.15,-.59+i*.147,edge);
  for(const x of [-1.67,1.67])for(const z of [-.71,.71])B(.10,2.29,.105,x,1.145,z,edge);
  B(3.36,.085,1.44,0,2.29,0,edge);
  B(3.36,.075,1.44,0,.04,0,edge);
  // Two proper hinged doors, seam, vertical locking bars, hinges and handles.
  for(const x of [-.355,.355]){
   B(.69,2.12,.032,1.698,1.15,x,faded);
   for(const z of [x-.24,x+.24])R([1.75,.22,z],[1.75,2.08,z],.019,steel);
   for(const y of [.32,1.88])B(.11,.11,.055,1.75,y,x-.29,edge);
   B(.075,.13,.10,1.79,1.12,x+.21,brass);
  }
  B(.04,2.17,.09,1.72,1.15,0,edge);
  for(let i=0;i<4;i++)B(.28,.018,.012,-.75+i*.23,1.38,.737,mark);

 }
 if(id==='tyreStack'){

  // Stacked tyres with open centres, deep sidewalls and repeated tread blocks.
  for(let j=0;j<2;j++)for(let i=0;i<4;i++){
   const x=j*.58-.29,y=.115+i*.225,z=j===0?-.035:.045;
   const tyre=new T.Mesh(new T.TorusGeometry(.225,.095,14,40),rubber);
   tyre.rotation.x=Math.PI/2;tyre.position.set(x,y,z);g.add(tyre);
   const side=new T.Mesh(new T.TorusGeometry(.155,.024,10,40),dark);side.rotation.x=Math.PI/2;side.position.set(x,y+.081,z);g.add(side);
   for(let k=0;k<24;k++){const a=k*Math.PI/12;const o=B(.058,.032,.085,x+Math.cos(a)*.288,y,z+Math.sin(a)*.288,rubber);o.rotation.y=-a;}
  }

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

  // UK pub fruit machine: tall illuminated header, slanted play deck and detailed reel window.
  const magenta=m(0xc03787,.05,.32),gold=m(0xe6aa3c,.3,.3),navy=m(0x1b2635),lime=m(0x72b653);
  B(.73,1.55,.52,0,.81,0,black);
  B(.76,.62,.55,0,1.53,-.015,magenta);
  B(.66,.48,.018,0,1.54,.273,navy);
  for(let i=0;i<9;i++){const x=-.25+(i%3)*.25,y=1.70-Math.floor(i/3)*.135;
   B(.17,.09,.021,x,y,.288,i%3===0?gold:i%3===1?lime:magenta);}
  B(.70,.52,.52,0,1.00,0,navy);
  const deck=B(.68,.29,.38,0,.93,.295,magenta);deck.rotation.x=-.58;
  for(let i=0;i<3;i++){const x=-.205+i*.205;
   B(.17,.17,.026,x,1.05,.474,white);
   B(.10,.09,.029,x,1.05,.491,i===0?red:i===1?gold:lime);
  }
  for(let i=0;i<8;i++){const x=-.25+(i%4)*.17,y=.87-Math.floor(i/4)*.09;B(.11,.045,.025,x,y,.483,i%2?lime:gold);}
  B(.62,.13,.05,0,.63,.285,black);
  B(.50,.03,.055,0,.61,.32,steel);
  B(.63,.27,.027,0,.28,.275,magenta);
  for(let i=0;i<6;i++)B(.075,.025,.02,-.25+i*.10,.28,.297,i%2?gold:lime);
  B(.72,.065,.55,0,.065,0,dark);

 }
 if(id==='washBasin'){
  // Wall-hung ceramic basin with visible recessed bowl and realistic plumbing.
  const porcelain=m(0xe5e7e2,.03,.22);
  B(.73,.095,.47,0,.88,0,porcelain);
  const rim=new T.Mesh(new T.TorusGeometry(.205,.036,12,40),porcelain);
  rim.rotation.x=Math.PI/2;rim.scale.set(1.42,.83,1);rim.position.set(0,.935,.05);g.add(rim);
  const inner=new T.Mesh(new T.SphereGeometry(.205,32,14,0,Math.PI*2,Math.PI*.48,Math.PI*.48),porcelain);
  inner.scale.set(1.42,.48,.83);inner.position.set(0,.933,.05);g.add(inner);
  C(.027,.009,0,.823,.05,steel,24);
  B(.71,.13,.07,0,.91,-.26,porcelain);
  C(.035,.15,0,1.02,-.20,steel,24);
  R([0,1.08,-.20],[0,1.08,-.04],.019,steel);
  R([0,1.08,-.04],[0,1.015,-.025],.018,steel);
  for(const x of [-.12,.12]){C(.032,.022,x,.987,-.20,steel,20);B(.08,.014,.025,x,1.003,-.20,steel);}
  C(.055,.15,0,.69,-.12,white,24);
  R([0,.62,-.12],[0,.44,-.12],.033,white);
  R([0,.44,-.12],[0,.44,-.30],.033,white);
 }
 g.userData={collection:'streetassettesting',batch:3,id,units:'metres',status:'review-required',revision:'structural-rebuild-v2',style:'British streets and interiors'};
 return g;
}
