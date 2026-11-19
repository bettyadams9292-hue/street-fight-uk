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

  const shell=[m(0xbbb7a8),m(0x4d585b),m(0x7a7770),m(0x836f59),m(0x39444a)];
  const screen=m(0x222e32,.15,.35),copper=m(0x987453,.6,.65);
  // Uneven underlying scrap pile: no rectangular floor and no repeated display grid.
  for(let i=0;i<13;i++){const x=Math.sin(i*2.17)*.67,z=Math.cos(i*2.91)*.42;
   const y=.13+(i%4)*.115;const o=B(.22+(i%3)*.12,.11+(i%4)*.045,.19+(i%2)*.13,x,y,z,shell[i%5]);o.rotation.set((i%3-1)*.15,i*.74,(i%5-2)*.18);}
  // Distinct appliances: television, microwave, washing-machine face, PC tower and stereo.
  const tv=B(.71,.47,.33,-.39,.56,-.16,shell[0]);tv.rotation.z=-.17;
  const tvGlass=B(.53,.31,.013,-.39,.58,.014,screen);tvGlass.rotation.z=-.17;
  const microwave=B(.56,.32,.34,.35,.48,.08,shell[1]);microwave.rotation.z=.16;
  B(.36,.22,.015,.30,.49,.257,screen).rotation.z=.16;
  for(let i=0;i<2;i++){const knob=C(.028,.016,.57,.54-i*.10,.26,steel,16);knob.rotation.x=Math.PI/2;}
  const washer=B(.51,.49,.43,.05,.84,-.28,shell[0]);washer.rotation.z=-.13;
  const glassDoor=C(.16,.025,.06,.85,-.047,screen,32);glassDoor.rotation.x=Math.PI/2;
  const ring=new T.Mesh(new T.TorusGeometry(.165,.018,8,32),steel);ring.position.set(.06,.85,-.023);g.add(ring);
  const tower=B(.25,.59,.33,-.66,.34,.31,shell[2]);tower.rotation.z=.38;
  B(.12,.017,.013,-.61,.47,.485,screen);
  const radio=B(.53,.19,.20,.41,.89,.20,shell[3]);radio.rotation.z=-.21;
  for(let i=0;i<2;i++){const speaker=C(.067,.012,.24+i*.31,.89,.306,dark,24);speaker.rotation.x=Math.PI/2;}
  // Loose cables and rusted metal lengths are partly buried, not floating.
  for(let i=0;i<9;i++){const x=Math.sin(i*1.8)*.61,z=Math.cos(i*1.3)*.37;
   R([x,.11,z],[x+.16,.20+(i%3)*.07,z+.09],.007,i%3?black:copper);}
  for(let i=0;i<4;i++){const x=-.52+i*.33;const p=B(.31,.022,.06,x,.14,.47,i%2?rust:steel);p.rotation.y=i*.53;}

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

  // Closed, flush, structurally connected ISO-style container. X axis is its length.
  const paint=m(0x4c7482,.46,.7),frame=m(0x35434b,.7,.48),ridge=m(0x355967,.45,.73),whiteMark=m(0xb8b9a8);
  B(3.28,2.15,1.36,0,1.13,0,paint);
  // Narrow corrugation strips are bonded to each side, not detached.
  for(const z of [-.689,.689])for(let i=0;i<24;i++)B(.038,2.03,.028,-1.57+i*.136,1.14,z,ridge);
  for(const x of [-1.64,1.64])for(let i=0;i<9;i++)B(.022,2.04,.095,x,1.14,-.55+i*.137,ridge);
  for(const x of [-1.64,1.64])for(const z of [-.68,.68])B(.092,2.25,.09,x,1.125,z,frame);
  for(const y of [.048,2.245])B(3.38,.085,1.45,0,y,0,frame);
  // The end face is divided along Z, not along the length of the container.
  for(const z of [-.342,.342]){
   B(.045,2.06,.664,1.674,1.13,z,paint);
   for(let i=0;i<4;i++)B(.014,1.94,.025,1.702,1.13,z-.245+i*.163,ridge);
   for(const rodZ of [z-.21,z+.21]){
    R([1.724,.19,rodZ],[1.724,2.05,rodZ],.014,steel);
    for(const y of [.27,1.98])B(.075,.07,.06,1.725,y,rodZ,frame);
   }
   for(const y of [.35,.94,1.55,1.96])B(.07,.065,.055,1.72,y,z+(z>0?.30:-.30),frame);
   B(.055,.085,.12,1.76,1.03,z+.16,steel);
  }
  B(.055,2.14,.035,1.72,1.13,0,frame);
  for(let i=0;i<4;i++)B(.21,.012,.013,-.95+i*.25,1.47,.71,whiteMark);

 }
 if(id==='tyreStack'){

  // Car tyres with squared shoulders, real hollow centre and recessed tread.
  const sidewall=m(0x242528,.02,.95),tread=m(0x191b1d,.01,.99),groove=m(0x333437);
  for(let j=0;j<2;j++)for(let i=0;i<4;i++){
   const x=j*.61-.305,z=j===0?-.035:.05,y=.105+i*.205;
   // Lathe cross-section defines a broad flat tread and hollow central aperture.
   const p=[[.135,-.083],[.17,-.085],[.22,-.083],[.265,-.069],[.272,-.038],[.272,.038],[.265,.069],[.22,.083],[.17,.085],[.135,.083],[.125,.052],[.125,-.052]].map(v=>new T.Vector2(v[0],v[1]+y));
   const tyre=new T.Mesh(new T.LatheGeometry(p,48),sidewall);tyre.position.set(x,0,z);g.add(tyre);
   for(let k=0;k<36;k++){const a=k*Math.PI/18;
    for(const off of [-.043,.043]){const block=B(.065,.042,.047,x+Math.cos(a)*.269,y+off,z+Math.sin(a)*.269,tread);block.rotation.y=-a;}
   }
   for(const off of [-.037,.037]){const band=new T.Mesh(new T.TorusGeometry(.268,.004,6,48),groove);band.rotation.x=Math.PI/2;band.position.set(x,y+off,z);g.add(band);}
   const rim=new T.Mesh(new T.TorusGeometry(.143,.012,8,40),dark);rim.rotation.x=Math.PI/2;rim.position.set(x,y+.087,z);g.add(rim);
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

  // Recognisable UK pub fruit machine: curved-style fascia, reel window, prize grid, button deck.
  const mag=m(0xa51d65,.15,.38),gold=m(0xd5a64a,.25,.38),lime=m(0x79b33d),navy=m(0x182333),lit=m(0xede3ba,.02,.32),orange=m(0xd66c32);
  B(.75,1.64,.50,0,.84,0,black);
  B(.76,.11,.53,0,1.71,0,mag);
  B(.71,.48,.024,0,1.43,.265,navy);
  // Illuminated jackpot/feature trail, smaller symbols and illuminated perimeter.
  B(.65,.065,.032,0,1.65,.29,gold);
  for(let i=0;i<20;i++){const x=-.264+(i%5)*.132,y=1.57-Math.floor(i/5)*.088;
   B(.104,.062,.016,x,y,.29,i%5===0?orange:i%4===0?lime:i%3===0?gold:mag);
   B(.038,.023,.018,x,y,.301,lit);}
  for(const x of [-.346,.346])B(.016,.44,.024,x,1.44,.289,mag);
  // Slanted play deck, with matching reel windows and staggered push buttons.
  const deck=B(.72,.24,.36,0,.93,.285,mag);deck.rotation.x=-.49;
  B(.62,.19,.026,0,1.035,.458,navy);
  for(let i=0;i<3;i++){const x=-.204+i*.204;
   B(.17,.14,.028,x,1.044,.478,lit);
   B(.075,.072,.03,x,1.046,.497,i===0?orange:i===1?lime:gold);
  }
  for(let i=0;i<10;i++){const x=-.255+(i%5)*.127,y=.86-Math.floor(i/5)*.063;
   B(.092,.036,.03,x,y,.457,i%4===0?orange:i%3===0?lime:gold);}
  B(.56,.06,.06,0,.65,.294,navy);
  B(.44,.013,.017,0,.659,.333,steel);
  B(.67,.34,.023,0,.32,.264,mag);
  B(.57,.25,.025,0,.33,.282,navy);
  for(let i=0;i<12;i++){const x=-.23+(i%4)*.155,y=.405-Math.floor(i/4)*.07;
   B(.105,.041,.017,x,y,.299,i%3===0?gold:i%3===1?mag:lime);}
  B(.76,.07,.53,0,.045,0,dark);

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
 g.userData={collection:'streetassettesting',batch:3,id,units:'metres',status:'review-required',revision:'polish-v3',style:'British streets and interiors'};
 return g;
}
