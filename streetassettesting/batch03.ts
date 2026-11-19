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
  // Distinct salvaged objects in a stable heap; no interpenetrating appliances.
  const enamel=m(0xb6b4a9,.12,.74),grey=m(0x657078,.32,.68),screen=m(0x202b32,.16,.32),rusted=m(0x775d4d,.34,.82);
  // Large washing machine at the back, front face toward +Z.
  B(.62,.69,.52,-.48,.38,-.31,enamel);
  B(.56,.12,.03,-.48,.65,-.028,grey);
  const washerDoor=C(.225,.025,-.48,.33,-.024,screen,48);washerDoor.rotation.x=Math.PI/2;
  const ring=new T.Mesh(new T.TorusGeometry(.225,.019,10,48),steel);ring.position.set(-.48,.33,-.004);g.add(ring);
  // CRT television on its own footprint at the right.
  B(.62,.49,.47,.40,.31,-.29,grey);
  B(.51,.36,.024,.38,.34,-.039,screen);
  for(let i=0;i<2;i++){const knob=C(.025,.016,.67,.36-i*.095,-.019,dark,20);knob.rotation.x=Math.PI/2;}
  // Radio and dismantled metal pieces at ground level in front.
  B(.54,.20,.22,-.38,.15,.34,rusted);
  for(const x of [-.57,-.20]){const speaker=C(.065,.014,x,.16,.46,dark,24);speaker.rotation.x=Math.PI/2;}
  B(.46,.12,.25,.37,.105,.34,grey);
  B(.32,.045,.17,.24,.19,.42,rusted).rotation.y=.16;
  B(.25,.038,.12,.63,.18,.34,steel).rotation.y=-.28;
  B(.34,.035,.13,-.04,.075,.59,grey).rotation.y=.27;
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
  B(3.28,2.15,2.28,0,1.13,0,paint);
  // Narrow corrugation strips are bonded to each side, not detached.
  for(const z of [-1.149,1.149])for(let i=0;i<24;i++)B(.038,2.03,.028,-1.57+i*.136,1.14,z,ridge);
  for(const x of [-1.64,1.64])for(let i=0;i<9;i++)B(.022,2.04,.095,x,1.14,-.99+i*.247,ridge);
  for(const x of [-1.64,1.64])for(const z of [-1.14,1.14])B(.092,2.25,.09,x,1.125,z,frame);
  for(const y of [.048,2.245])B(3.38,.085,2.37,0,y,0,frame);
  // The end face is divided along Z, not along the length of the container.
  for(const z of [-.552,.552]){
   B(.045,2.06,.108,1.674,1.13,z,paint);
   for(let i=0;i<4;i++)B(.014,1.94,.025,1.702,1.13,z-.405+i*.27,ridge);
   for(const rodZ of [z-.39,z+.39]){
    R([1.724,.19,rodZ],[1.724,2.05,rodZ],.014,steel);
    for(const y of [.27,1.98])B(.075,.07,.06,1.725,y,rodZ,frame);
   }
   for(const y of [.35,.94,1.55,1.96])B(.07,.065,.055,1.72,y,z+(z>0?.50:-.50),frame);
   B(.055,.085,.12,1.76,1.03,z+.30,steel);
  }
  B(.055,2.14,.035,1.72,1.13,0,frame);
  // No floating white side marks.

 }
 if(id==='tyreStack'){
  const rubber=m(0x242527,.01,.94),groove=m(0x202123,.01,.98);
  for(let j=0;j<2;j++)for(let i=0;i<4;i++){
   const x=j*.61-.305,z=j===0?-.035:.05,y=.105+i*.205;
   const p=[[.135,-.083],[.17,-.085],[.22,-.083],[.265,-.069],[.272,-.038],[.272,.038],[.265,.069],[.22,.083],[.17,.085],[.135,.083],[.125,.052],[.125,-.052]].map(v=>new T.Vector2(v[0],v[1]+y));
   const tyre=new T.Mesh(new T.LatheGeometry(p,64),rubber);tyre.position.set(x,0,z);g.add(tyre);
   // Thin inset chevrons in near-identical rubber tone, rather than raised block belts.
   for(let k=0;k<40;k++){const a=k*Math.PI/20;
    for(const off of [-.034,.034]){
     const mark=B(.026,.049,.003,x+Math.sin(a)*.273,y+off,z+Math.cos(a)*.273,groove);
     mark.rotation.y=a;mark.rotation.z=off<0?-.43:.43;
    }
   }
   const rim=new T.Mesh(new T.TorusGeometry(.143,.012,8,40),rubber);rim.rotation.x=Math.PI/2;rim.position.set(x,y+.087,z);g.add(rim);
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
  // Actual fruit-symbol shapes: cherries, lemon slices, sevens and stars.
  const symbol=(x:number,y:number,z:number,kind:number,scale=.032)=>{
   if(kind===0){for(const dx of [-scale*.5,scale*.5])S(scale*.55,x+dx,y-scale*.25,z,red);R([x,y,z],[x+scale*.3,y+scale*1.25,z],.003,green);}
   if(kind===1){const o=C(scale,.009,x,y,z,gold,20);o.rotation.x=Math.PI/2;for(let q=0;q<4;q++){const a=q*Math.PI/2;R([x,y,z+.008],[x+Math.cos(a)*scale*.75,y+Math.sin(a)*scale*.75,z+.008],.002,white);}}
   if(kind===2){B(scale*.3,scale*1.5,.012,x+scale*.30,y,z,red);B(scale,scale*.3,.012,x,y+scale*.6,z,red);}
   if(kind===3){const star=new T.Mesh(new T.OctahedronGeometry(scale),gold);star.position.set(x,y,z);g.add(star);}
   if(kind===4){S(scale,x,y,z,green);B(scale*.55,scale*.18,.012,x,y+scale*.18,z+.014,white);}
  };
  B(.65,.065,.032,0,1.65,.29,gold);
  // Single main reel window below; upper panel is decorative prize information.
  B(.60,.34,.014,0,1.44,.287,mag);
  for(let i=0;i<7;i++){const x=-.25+i*.083;
   B(.061,.025,.014,x,1.53,.30,i%2?gold:lit);
   B(.061,.025,.014,x,1.44,.30,i%2?lit:gold);
  }
  B(.51,.044,.015,0,1.33,.301,gold);
  for(const x of [-.346,.346])B(.016,.44,.024,x,1.44,.289,mag);
  // Slanted play deck, with matching reel windows and staggered push buttons.
  const deck=B(.72,.24,.36,0,.93,.285,mag);deck.rotation.x=-.49;
  B(.62,.19,.026,0,1.035,.458,navy);
  for(let i=0;i<3;i++){const x=-.204+i*.204;
   B(.17,.14,.028,x,1.044,.478,lit);
   symbol(x,1.046,.504,i,.049);
  }
  for(let i=0;i<10;i++){const x=-.255+(i%5)*.127,y=.86-Math.floor(i/5)*.063;
   const btn=B(.081,.028,.027,x,y,.457,i%4===0?orange:i%3===0?lime:gold);btn.rotation.x=-.49;}
  B(.56,.06,.06,0,.65,.294,navy);
  B(.44,.013,.017,0,.659,.333,steel);
  B(.67,.34,.023,0,.32,.264,mag);
  B(.57,.25,.025,0,.33,.282,navy);
  // Lower cabinet is a payout access panel, not another symbol display.
  B(.46,.15,.014,0,.34,.299,mag);
  B(.29,.013,.019,0,.34,.312,steel);
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
 g.userData={collection:'streetassettesting',batch:3,id,units:'metres',status:'review-required',revision:'polish-v5',style:'British streets and interiors'};
 return g;
}
