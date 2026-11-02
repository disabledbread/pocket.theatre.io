(function(){
"use strict";
const $=i=>document.getElementById(i);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast=m=>{const t=$("toast");t.textContent=m;t.classList.add("on");clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove("on"),2600)};
const copy=t=>{const f=()=>{const a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();try{document.execCommand("copy")}catch(e){}a.remove()};
 navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(t).catch(f):f()};
const today=()=>new Date().toLocaleDateString("sv-SE");
const uid=()=>Date.now()+Math.floor(Math.random()*100000);
const BELL='<svg class="i" style="width:14px;height:14px;vertical-align:-2px" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';
const CHEV='<svg class="i chev" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>';
const KEY="lt-app-v3";
/* saját párbeszédablak: a natív confirm/prompt beágyazott nézetekben (és egyes böngészőkben) le van tiltva */
function dialog(o){return new Promise(res=>{
 const L=$("dlg"),I=$("di2"),Y=$("dyes"),N=$("dno");
 $("dm").textContent=o.msg;I.style.display=o.input?"block":"none";I.value=o.def==null?"":o.def;
 Y.textContent=o.ok||"OK";Y.className="btn "+(o.danger?"rd":"pr");
 L.classList.add("on");if(o.input)setTimeout(()=>{I.focus();I.select()},60);
 const done=v=>{L.classList.remove("on");Y.onclick=N.onclick=L.onclick=null;document.removeEventListener("keydown",kd);res(v)};
 const kd=e=>{if(e.key==="Escape")done(null);if(e.key==="Enter"&&o.input)done(I.value)};
 document.addEventListener("keydown",kd);
 Y.onclick=()=>done(o.input?I.value:true);N.onclick=()=>done(null);L.onclick=e=>{if(e.target===L)done(null)};
})}
const ask=(msg,ok,danger)=>dialog({msg,ok:ok||"Igen",danger:danger!==false}).then(v=>v===true);
const askText=(msg,def)=>dialog({msg,input:true,def,ok:"Mentés"});

/* ---- képek: IndexedDB (nagyobb hely, mint a localStorage) ---- */
const DB=new Promise((res,rej)=>{const r=indexedDB.open("pocket-theatre",1);r.onupgradeneeded=()=>r.result.createObjectStore("img");r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const idb=(mode,fn)=>DB.then(db=>new Promise((res,rej)=>{const t=db.transaction("img",mode),q=fn(t.objectStore("img"));t.oncomplete=()=>res(q&&q.result);t.onerror=t.onabort=()=>rej(t.error)}));
const imgPut=(k,v)=>idb("readwrite",s=>s.put(v,k));
const imgGet=k=>idb("readonly",s=>s.get(k));
const imgDel=k=>idb("readwrite",s=>s.delete(k));
const shrink=f=>new Promise((res,rej)=>{const r=new FileReader();r.onerror=rej;
 r.onload=()=>{const im=new Image();im.onerror=rej;
  im.onload=()=>{const k=Math.min(1,1400/Math.max(im.width,im.height)),c=document.createElement("canvas");c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext("2d").drawImage(im,0,0,c.width,c.height);res(c.toDataURL("image/jpeg",0.75))};
  im.src=r.result};
 r.readAsDataURL(f)});

/* A makrók (S.macros) és a beosztás (S.plan) adatai nem törlődnek: a tárban maradnak, ha később visszahozzuk őket. */
const D={venues:[{n:"Nagyszínpad",ip:"192.168.0.100"},{n:"Kisfaludy Színpad",ip:"192.168.0.120"}],
 dd:"down",gep:[],shows:[],notes:[],theatres:[],rigs:[],chOv:{},ot:[],tours:[],set:{wage:0},tax:{e:false,u:false}};
let S;try{S=JSON.parse(localStorage.getItem(KEY))}catch(e){}
if(!S||typeof S!=="object")S={};
/* átállás a korábbi verziókról */
if(Array.isArray(S.patch)&&S.patch.length&&!S.stages){
 const fl=S.patch[0].fx?S.patch:[{id:uid(),name:"Korábbi import",fx:S.patch}];
 S.stages=[{id:uid(),n:"Általános",files:fl.map(f=>({id:f.id,n:f.name,fx:f.fx}))}];
}
delete S.patch;
if(Array.isArray(S.rig)&&S.rig.length&&!S.rigs)S.rigs=[{id:uid(),n:"Korábbi lista",items:S.rig}];
delete S.rig;
Object.keys(D).forEach(k=>{if(S[k]===undefined)S[k]=JSON.parse(JSON.stringify(D[k]))});
if(typeof S.set.wage!=="number")S.set.wage=+S.set.wage||0;
/* átállás a színház > színpad > fájl szerkezetre: a beépített patch saját színházat kap, a többi színpad a „Saját” alá kerül; a beépített nem törölhető */
if(Array.isArray(S.stages)){
 const own=[];
 S.stages.forEach(s=>{
  const f=s.files.find(x=>x.n==="Nagyszínpad"||x.n==="Nagyszínpad.xml");
  if(f&&(s.b||(S.nszSeed&&s.n==="Győri Nemzeti Színház"))){f.b=true;S.theatres.push({id:s.id,n:s.n,b:true,stages:[{id:uid(),n:"Nagyszínpad",b:true,files:s.files}]})}
  else own.push(s);
 });
 if(own.length)S.theatres.push({id:uid(),n:"Saját",stages:own});
 delete S.stages;
}
S.theatres.forEach(t=>t.stages.forEach(s=>s.files.forEach(f=>{f.n=String(f.n).replace(/\.xml$/i,"")})));
/* a Drive-kapcsolat külön kulcson van, így a mentésfájlba nem kerül bele */
const DK="lt-drive";
let DR={};try{DR=JSON.parse(localStorage.getItem(DK))||{}}catch(e){}
let DJ=null;
const save=()=>{try{const j=JSON.stringify(S);localStorage.setItem(KEY,j);if(DJ!==null&&j!==DJ){DJ=j;driveTouch()}}catch(e){toast("A tár megtelt")}};
/* korábbi egyképes jegyzetek átemelése az új, többképes tárolóba */
S.notes.forEach(n=>{
 if(n.imgs)return;
 n.imgs=[];
 if(n.img){let v=null;try{v=localStorage.getItem("lt-img-"+n.id)}catch(e){}
  if(v){const k=n.id+"-0";n.imgs=[k];imgPut(k,v).then(()=>{try{localStorage.removeItem("lt-img-"+n.id)}catch(e){}}).catch(()=>{})}}
 delete n.img;
});
save();
DJ=JSON.stringify(S);
/* tartós tárhely kérése, hogy a böngésző helyhiány esetén se törölje az adatokat (a döntés a böngészőé, ezért indításonként újra próbáljuk) */
if(navigator.storage&&navigator.storage.persist)navigator.storage.persisted().then(p=>p||navigator.storage.persist()).then(p=>{$("sto").textContent=p?"Tartós tárhely: bekapcsolva.":"Tartós tárhely: a böngésző még nem engedélyezte, a következő indításkor újra kérjük."}).catch(()=>{});

/* ---- mentés fájlba / visszatöltés ---- */
async function backupBlob(){
 const keys=await idb("readonly",s=>s.getAllKeys()),vals=await idb("readonly",s=>s.getAll()),imgs={};
 keys.forEach((k,i)=>imgs[k]=vals[i]);
 return new Blob([JSON.stringify({app:"pocket-theatre",v:1,at:new Date().toISOString(),state:S,imgs})],{type:"application/json"});
}
$("bks").onclick=async()=>{
 try{
  const name="pocket-theatre-mentes-"+today()+".json",blob=await backupBlob();
  const f=new File([blob],name,{type:"application/json"});
  /* telefonon a megosztás menü a megbízható út, különösen a kezdőképernyős iPhone-appban */
  if(matchMedia("(pointer:coarse)").matches&&navigator.canShare&&navigator.canShare({files:[f]})){
   try{await navigator.share({files:[f]})}catch(e){if(e.name!=="AbortError")toast("A mentés nem sikerült")}
   return}
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),10000);toast("Mentés kész");
 }catch(e){toast("A mentés nem sikerült")}
};
$("bkl").onclick=()=>$("bkf").click();
$("bkf").onchange=async()=>{
 const f=$("bkf").files[0];$("bkf").value="";if(!f)return;
 restoreBackup(await f.text());
};
async function restoreBackup(txt){
 let b;try{b=JSON.parse(txt)}catch(e){}
 const imgs=b&&b.imgs;
 if(!b||b.app!=="pocket-theatre"||!b.state||typeof b.state!=="object"||Array.isArray(b.state)||!imgs||typeof imgs!=="object"||Object.values(imgs).some(v=>typeof v!=="string"||!v.startsWith("data:image/"))){toast("Ez nem Pocket Theatre mentés");return}
 if(!await ask("Visszatöltöd a mentést ("+String(b.at||"").slice(0,10)+")?\n\nA mostani adatok helyére a fájl tartalma kerül.","Visszatöltés"))return;
 /* előbb az adatok, utána a képek (egy tranzakcióban): ha bármelyik hibázik, a régi állapot marad */
 const old=localStorage.getItem(KEY);
 try{
  localStorage.setItem(KEY,JSON.stringify(b.state));
  await idb("readwrite",s=>{s.clear();Object.keys(imgs).forEach(k=>s.put(imgs[k],k))});
  DJ=null;DR.dirty=false;driveStore();
  location.reload();
 }catch(e){
  try{localStorage.setItem(KEY,old)}catch(e2){}
  toast("A visszatöltés nem sikerült, a régi adatok maradtak");
 }
}

/* ---- Google Drive mentés: a felhasználó saját Drive-jába, szerver nélkül. Csak a saját fájljait látja (drive.file). Nem ment magától: változás esetén wifin 3, mobilneten 7 nap után a Konzol fülön felajánlja a mentést. Naponta és eszközönként egy fájl, eszközönként az utolsó 2 marad. ---- */
const DRIVE_ID="625403851691-lbe1b86urdojd0m24e2sggiljnl9k7i1.apps.googleusercontent.com";
const DRIVE_DIR="Pocket Theatre",DRIVE_KEEP=2,DRIVE_DAYS=3,DRIVE_DAYS_MOBILE=7,DRIVE_API="https://www.googleapis.com";
if(!DR.dev)DR.dev=Math.random().toString(36).slice(2,8);
let driveTc=null,driveWait=null,driveBusy=false,driveGen=0,driveListOn=false,driveCardOff=false;
function driveStore(){try{localStorage.setItem(DK,JSON.stringify(DR))}catch(e){}}
const driveHasTok=()=>DR.tok&&DR.exp>Date.now()+60000;
function driveLoad(){
 if(!DRIVE_ID)return Promise.resolve();
 if(!driveLoad.p)driveLoad.p=new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://accounts.google.com/gsi/client";s.onload=res;s.onerror=()=>{driveLoad.p=null;rej(new Error("offline"))};document.head.appendChild(s)}).then(()=>{
  driveTc=google.accounts.oauth2.initTokenClient({client_id:DRIVE_ID,scope:"https://www.googleapis.com/auth/drive.file",
   callback:r=>{const w=driveWait;driveWait=null;if(!r.error){DR.tok=r.access_token;DR.exp=Date.now()+r.expires_in*1000;driveStore()}if(w){if(r.error)w.rej(new Error(r.error));else w.res()}},
   error_callback:e=>{const w=driveWait;driveWait=null;if(w)w.rej(new Error(e.type||"popup"))}});
 });
 return driveLoad.p;
}
/* a Google új bejelentkezést csak koppintásra enged megnyitni, ezért ezt mindig gombnyomásból hívjuk */
/* a bezárt Google-ablakról a böngésző nem mindig szól, ezért idővel feladjuk a várakozást */
function driveLogin(prompt){return driveLoad().then(()=>new Promise((res,rej)=>{const w=driveWait={res,rej};setTimeout(()=>{if(driveWait===w){driveWait=null;rej(new Error("popup_closed"))}},120000);driveTc.requestAccessToken({prompt})}))}
async function driveApi(path,opt){
 opt=opt||{};
 const r=await fetch(DRIVE_API+path,Object.assign({},opt,{headers:Object.assign({Authorization:"Bearer "+DR.tok},opt.headers)}));
 if(!r.ok){const e=new Error("drive "+r.status);e.status=r.status;try{e.reason=((await r.json()).error.errors[0]||{}).reason}catch(x){}throw e}
 return r;
}
/* nem végleges törlés: a Drive kukájába kerül, onnan a felhasználó visszahozhatja */
const driveTrash=id=>driveApi(`/drive/v3/files/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({trashed:true})});
async function driveDir(make){
 const q=encodeURIComponent(`name='${DRIVE_DIR}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
 const f=(await (await driveApi(`/drive/v3/files?q=${q}&fields=files(id)`)).json()).files[0];
 if(f||!make)return f&&f.id;
 return (await (await driveApi("/drive/v3/files?fields=id",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:DRIVE_DIR,mimeType:"application/vnd.google-apps.folder"})})).json()).id;
}
async function driveFiles(dir){
 const q=encodeURIComponent(`'${dir}' in parents and trashed=false`);
 return (await (await driveApi(`/drive/v3/files?q=${q}&orderBy=modifiedTime desc&pageSize=100&fields=files(id,name,modifiedTime,size)`)).json()).files.filter(f=>/^pocket-theatre-.*\.json$/.test(f.name));
}
function driveFail(e){
 if(e.status===401){DR.tok=null;driveStore();driveNote="A Drive-kapcsolat megszakadt, jelentkezz be újra."}
 else if(e.status===403&&e.reason==="storageQuotaExceeded")driveNote="A Google Drive megtelt, a mentés nem sikerült.";
 else if(e.status===403||e.status===404)driveNote="A Drive nem engedte a mentést, próbáld újra később.";
 else driveNote="A mentés nem sikerült, internet esetén újrapróbáljuk.";
 renderDrive();
}
let driveNote="";
async function driveUpload(){
 if(driveBusy||!DR.on||!driveHasTok())return false;
 driveBusy=true;const gen=driveGen;
 try{
  const name=`pocket-theatre-${today()}-${DR.dev}.json`,tail=`-${DR.dev}.json`,dir=await driveDir(true),files=await driveFiles(dir),old=files.find(f=>f.name===name);
  const blob=await backupBlob();
  const st=await driveApi(old?`/upload/drive/v3/files/${old.id}?uploadType=resumable`:"/upload/drive/v3/files?uploadType=resumable",{method:old?"PATCH":"POST",headers:{"Content-Type":"application/json; charset=UTF-8","X-Upload-Content-Type":"application/json","X-Upload-Content-Length":String(blob.size)},body:JSON.stringify(old?{}:{name,parents:[dir]})});
  const up=await fetch(st.headers.get("Location"),{method:"PUT",body:blob});
  if(!up.ok){const e=new Error("feltöltés "+up.status);e.status=up.status;throw e}
  const mine=files.filter(f=>f.name.endsWith(tail)&&f.name!==name).sort((a,b)=>b.name.localeCompare(a.name));
  for(const f of mine.slice(DRIVE_KEEP-1))await driveTrash(f.id);
  try{DR.list=await driveFiles(dir)}catch(x){}
  DR.last=new Date().toISOString();if(gen===driveGen)DR.dirty=false;driveNote="";driveCardOff=false;driveListOn=false;driveStore();renderDrive();
  return true;
 }catch(e){driveFail(e);return false}
 finally{driveBusy=false}
}
/* mobilnetet csak ott tudunk kizárni, ahol a böngésző megmondja a kapcsolat típusát (iPhone-on nem) */
const driveWifi=()=>{const t=navigator.connection&&navigator.connection.type;return !t||["wifi","ethernet","unknown","other"].includes(t)};
const driveNext=()=>DR.last?new Date(DR.last).getTime()+(driveWifi()?DRIVE_DAYS:DRIVE_DAYS_MOBILE)*864e5:0;
const driveDue=()=>DR.on&&DR.dirty&&navigator.onLine!==false&&Date.now()>=driveNext();
/* a változás jelölve marad akkor is, ha közben bezárul az app */
function driveTouch(){
 if(!DR.on)return;
 driveGen++;DR.dirty=true;driveStore();
 renderDrive();
}
async function driveShowList(){
 const dir=await driveDir(false),files=dir?await driveFiles(dir):[];
 DR.list=files;driveListOn=true;driveStore();renderDrive();
 return files;
}
function renderDrive(){
 const on=DRIVE_ID&&DR.on;
 const lastT=DR.last?"Utolsó mentés: "+new Date(DR.last).toLocaleString("hu-HU",{dateStyle:"short",timeStyle:"short"}):"Még nincs mentés a Drive-on.";
 const nextT=!DR.dirty?"":Date.now()<driveNext()?"\nKövetkező felajánlás: "+new Date(driveNext()).toLocaleDateString("hu-HU"):"\nVan új változás.";
 $("gdc").style.display=on?"none":"";$("gdc").disabled=!DRIVE_ID;$("gdc").style.opacity=DRIVE_ID?"":".5";
 $("gdc").textContent=DRIVE_ID?"Csatlakozás a Google Drive-hoz":"Csatlakozás a Google Drive-hoz (hamarosan)";
 $("gdo").style.display=on?"":"none";
 $("gds").textContent=driveNote||(!DRIVE_ID?"Google Drive integráció: fejlesztés alatt.":!on?"Tesztelés alatt: egyelőre csak a felvett tesztelők tudnak csatlakozni.\nA saját Drive-odra ment, egy „Pocket Theatre” mappába. A többi fájlodat az app nem látja.":lastT+nextT);
 $("gdx").style.display=on?"":"none";
 $("gdk").style.display=on&&driveDue()&&!driveCardOff?"":"none";
 $("gdt").textContent=driveWifi()?"Van új változás.":"Régóta nincs mentés. Mobilnetet használsz.";
 $("gdr").textContent=driveListOn?"Mégse":"Visszatöltés";
 /* a lista mindig látszik, de kiválasztani csak a Visszatöltés gomb után lehet belőle */
 $("gdl").innerHTML=!on||!DR.list?"":!DR.list.length?(driveListOn?'<p class="sub" style="margin:10px 0 0">Nincs még mentés a Drive-on.</p>':""):`<p class="sub" style="margin:12px 0 8px">${driveListOn?"Melyiket töltsük vissza?":"Mentések a Drive-on"}</p>`+DR.list.map(f=>`<button class="bkr" ${driveListOn?"":"disabled"} data-gdf="${esc(f.id)}"><b>${esc(new Date(f.modifiedTime).toLocaleString("hu-HU",{dateStyle:"short",timeStyle:"short"}))}</b><span>${Math.max(1,Math.round((+f.size||0)/1024))} KB${f.name.endsWith(`-${DR.dev}.json`)?" · ez az eszköz":" · másik eszköz"}</span></button>`).join("");
}
const driveOffMsg=e=>e.message==="offline"?"Nem érhető el a Google, ellenőrizd az internetet":e.message==="popup_failed_to_open"||e.message==="popup_closed"?"A bejelentkezés nem fejeződött be":"A Google-bejelentkezés nem sikerült";
/* érvényes hozzáférés kell: ha lejárt, koppintásra újra kér (már engedélyezett fióknál jóváhagyás nélkül) */
async function driveEnsure(){if(!driveHasTok())await driveLogin(DR.on?"":"consent")}
$("gdc").onclick=async()=>{
 try{
  await driveLogin("consent");
  DR.on=true;DR.dirty=false;driveNote="";driveStore();
  const files=await driveShowList();
  if(files.length)toast("Találtam korábbi mentést, alul visszatöltheted");
  else if(await driveUpload())toast("Első mentés kész");
 }catch(e){e.status?driveFail(e):toast(driveOffMsg(e))}
};
$("gdn").onclick=async()=>{
 try{await driveEnsure();if(await driveUpload())toast("Mentés kész")}
 catch(e){e.status?driveFail(e):toast(driveOffMsg(e))}
};
/* a kártya a gombnyomásra azonnal eltűnik; sikertelen mentésnél a következő megnyitáskor jön vissza */
$("gdb").onclick=async()=>{
 driveCardOff=true;renderDrive();
 try{await driveEnsure();toast(await driveUpload()?"Mentés kész":driveNote||"A mentés nem sikerült")}
 catch(e){e.status?driveFail(e):toast(driveOffMsg(e))}
};
$("gdr").onclick=async()=>{
 if(driveListOn){driveListOn=false;renderDrive();return}
 try{await driveEnsure();await driveShowList()}
 catch(e){e.status?driveFail(e):toast(driveOffMsg(e))}
};
$("gdl").addEventListener("click",async e=>{
 const b=e.target.closest("[data-gdf]");if(!b)return;
 try{await driveEnsure();restoreBackup(await (await driveApi(`/drive/v3/files/${encodeURIComponent(b.dataset.gdf)}?alt=media`)).text())}
 catch(x){x.status?driveFail(x):toast(driveOffMsg(x))}
});
$("gdx").onclick=async()=>{
 if(!await ask("Leválasztod a Google Drive-ot?\n\nA mentés leáll, a telefonon lévő adatok megmaradnak.","Leválasztás"))return;
 let wipe=false,gone=false;
 try{
  await driveEnsure();
  wipe=await ask("A Drive kukájába teszed az ezzel az appal készült összes mentést is?\n\nA Google általában 30 nap után véglegesen törli őket, addig onnan visszahozhatók.","Kukába");
  if(wipe){const dir=await driveDir(false);if(dir)for(const f of await driveFiles(dir))await driveTrash(f.id)}
  await driveLoad();await new Promise(res=>google.accounts.oauth2.revoke(DR.tok,res));gone=true;
 }catch(e){}
 DR={dev:DR.dev};driveNote="";driveListOn=false;driveStore();renderDrive();
 toast(gone?(wipe?"Leválasztva, a mentések a Drive kukájában vannak":"Leválasztva"):"Leválasztva ezen a telefonon. A hozzáférést a Google-fiókodban is visszavonhatod");
};
document.addEventListener("visibilitychange",renderDrive);
if(navigator.connection&&navigator.connection.addEventListener)navigator.connection.addEventListener("change",renderDrive);
setInterval(renderDrive,600000);
driveStore();renderDrive();
if(DR.on)driveLoad().catch(()=>{});

/* ---- navigáció ---- */
const TT={"v-console":"Konzol","v-dmx":"DMX","v-shows":"Előadások","v-misc":"Egyebek","v-notes":"Jegyzetek","v-patch":"Patch sheet","v-calc":"Patch számoló","v-rig":"Színpad","v-gep":"Gépállás","v-set":"Beállítások","v-hours":"Bérkalkulátor","v-map":"Térkép","v-tiri":"Tirisztor"};
const SUB=["v-notes","v-patch","v-calc","v-rig","v-gep","v-hours","v-map","v-set","v-tiri"];
function go(id){
 document.querySelectorAll(".view").forEach(v=>v.classList.toggle("on",v.id===id));
 const root=SUB.includes(id)?"v-misc":id;
 document.querySelectorAll(".side button").forEach(b=>b.classList.toggle("on",b.dataset.t===root));
 $("ttl").textContent=TT[id];
 $("back").style.display=SUB.includes(id)?"":"none";
 $("newShow").style.display=id==="v-shows"?"":"none";
 if(id==="v-hours")renderHours();
 if(id==="v-set")driveLoad().catch(()=>{});
 if(id==="v-tiri")$("tq").value="",renderTiri();
 if(id==="v-map")renderMap();
 window.scrollTo(0,0);
}
document.addEventListener("click",e=>{const t=e.target.closest("[data-t],[data-go]");if(t)go(t.dataset.t||t.dataset.go)});
/* teljes képernyős térképnél a csípés ne az oldalt nagyítsa (a térkép saját nagyítása a saját kezelőjén át továbbra is működik) */
function noPageZoom(d){
 const stop=e=>{if($("mp").classList.contains("full")&&(e.type==="gesturestart"||e.touches.length>1))e.preventDefault()};
 d.addEventListener("gesturestart",stop);
 d.addEventListener("touchmove",stop,{passive:false});
}
noPageZoom(document);
/* a térkép kibontva, ugyanezen az oldalon belül töltődik be, ezért betöltés után kitöltjük vele a keretet (a térkép a saját méretfigyelőjével igazodik) */
$("mf").addEventListener("load",()=>{
 try{
  const d=$("mf").contentDocument;if(!d||!d.getElementById("ns")||d.getElementById("pt-fit"))return;
  const s=d.createElement("style");s.id="pt-fit";
  s.textContent="html,body{margin:0!important;height:100%!important;overflow:hidden!important;background:#14141b!important}#vis-container{height:100%!important}#ns{height:100%!important;border-radius:0!important}";
  d.head.appendChild(s);
  noPageZoom(d);
 }catch(e){}
});
$("mre").onclick=()=>{if(MAP)$("mf").srcdoc=MAP.html};
const VP=document.querySelector('meta[name="viewport"]'),VP0=VP.content;
const setMapFull=v=>{$("mp").classList.toggle("full",v);document.body.classList.toggle("noscroll",v);VP.content=v?VP0+", maximum-scale=1, user-scalable=no":VP0};
$("mff").onclick=()=>setMapFull(true);
$("mfc").onclick=()=>setMapFull(false);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("mp").classList.contains("full"))setMapFull(false)});

/* ---- konzol + remote ---- */
const url=v=>{v=v.trim();if(!v)return"";return /^https?:\/\//i.test(v)?v:"http://"+v};
const DEMO='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;font:16px system-ui;background:#111;color:#eee;display:flex;flex-direction:column;height:100vh"><div style="padding:14px;background:#222;font-weight:700">grandMA2 Web Remote (DEMÓ)</div><div style="flex:1;padding:14px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;align-content:start">'+[1,2,3,4,5,6,7,8].map(n=>'<div style="background:#2d3748;border-radius:8px;padding:18px 0;text-align:center">Exec '+n+'</div>').join("")+'</div><input id="cmdline-input" placeholder="Command line" style="margin:14px;padding:14px;font-size:16px;border-radius:8px;border:0"></body>';
let cur="";
const setFull=v=>{$("rm").classList.toggle("full",v);document.body.classList.toggle("noscroll",v)};
function conn(ip){
 const raw=ip.trim();if(!raw){toast("Add meg az IP címet");return}
 const demo=raw.toLowerCase()==="demo",u=url(raw);
 cur=raw;renderVenues();
 const f=$("fr");
 if(demo){f.removeAttribute("src");f.srcdoc=DEMO}else{f.removeAttribute("srcdoc");f.src=u}
 $("rm").style.display="";$("rmt").textContent=demo?"Demó remote":u;setFull(false);$("rm").scrollIntoView({behavior:"smooth",block:"nearest"});
 /* a böngészők az https oldalba ágyazott http tartalmat letilthatják, ilyenkor az Új lapon gomb marad */
 $("cnote").textContent="Betöltés: "+(demo?"demó":u)+". Ha üres marad, használd az Új lapon gombot, és ellenőrizd a Wi-Fit."+(!demo&&location.protocol==="https:"&&u.indexOf("http:")===0?" A böngésző biztonsági okból letilthatja a http-s remote beágyazását ezen a https oldalon.":"");
}
function renderVenues(){
 $("venues").innerHTML=S.venues.map((v,i)=>`<span class="chip${v.ip===cur?" act":""}"><button data-v="${i}">${esc(v.n)} <i>${esc(v.ip)}</i></button><button class="cx" data-dv="${i}" title="Törlés" aria-label="Törlés">✕</button></span>`).join("");
}
$("venues").addEventListener("click",async e=>{
 const d=e.target.closest("[data-dv]");
 if(d){const v=S.venues[+d.dataset.dv];if(!await ask("Biztosan törlöd a(z) „"+v.n+"” mentett remote-ot?","Törlés"))return;S.venues=S.venues.filter(x=>x!==v);save();renderVenues();return}
 const b=e.target.closest("[data-v]");
 if(b){const i=b.dataset.v,v=S.venues[+i];$("ip").value=v.ip;conn(v.ip);const nb=document.querySelector(`[data-v="${i}"]`);if(nb){const c=nb.parentNode;c.classList.add("go");setTimeout(()=>c.classList.remove("go"),700)}}
});
$("vs").onclick=()=>{const n=$("vn").value.trim(),ip=$("vi").value.trim();if(!n||!ip){toast("Név és IP kell");return}S.venues.push({n,ip});save();renderVenues();$("vn").value=$("vi").value=""};
$("cn").onclick=()=>conn($("ip").value);
$("nt").onclick=()=>{const u=url($("ip").value);u?window.open(u,"_blank"):toast("Add meg az IP címet")};
$("rmc").onclick=()=>setFull(false);
$("rmf").onclick=()=>setFull(true);
function resetRemote(){
 const f=$("fr");f.removeAttribute("srcdoc");f.src="about:blank";
 $("rm").style.display="none";setFull(false);cur="";$("ip").value="";$("rmt").textContent="";$("cnote").textContent="";
 renderVenues();toast("Remote bezárva");
}
$("rmx").onclick=async()=>{
 if(!await ask("Biztosan bezárod a remote-ot?\n\nA kapcsolat megszakad, és a konzol oldal újra az elejéről indul.","Bezárás"))return;
 resetRemote();
};
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("rm").classList.contains("full"))setFull(false)});
renderVenues();

/* ---- DMX (0-ról indul, ON irány alapból lefelé, legfeljebb 3 számjegy) ---- */
let ad=0;
function renderDip(){
 const dir=S.dd==="up"?"up":"down";
 $("dip").className="dip "+dir;
 if(!$("dip").children.length){let h="";for(let i=0;i<9;i++)h+=`<div class="sw" data-b="${i}"><b>${i+1}</b><div class="trk"><u>ON</u><div class="kn"></div></div><em>${1<<i}</em></div>`;$("dip").innerHTML=h}
 [...$("dip").children].forEach((s,i)=>s.classList.toggle("on",!!((ad>>i)&1)));
 document.querySelectorAll("#dir button").forEach(b=>b.classList.toggle("on",b.dataset.d===dir));
 const on=[];for(let i=0;i<9;i++)if((ad>>i)&1)on.push(i+1);
 $("dss").textContent="ON kapcsolók: "+(on.join(", ")||"nincs")+" · ON = "+(dir==="up"?"fent ▲":"lent ▼");
 ["da","dsv"].forEach(i=>{if(document.activeElement!==$(i))$(i).value=ad});
}
$("dip").addEventListener("click",e=>{const s=e.target.closest(".sw");if(s){ad^=1<<+s.dataset.b;renderDip()}});
/* a cím a mezőben és a nagy számra koppintva is beírható */
["da","dsv"].forEach(i=>{const el=$(i);
 el.oninput=()=>{
  const s=el.value.replace(/\D/g,"").slice(0,3);
  ad=Math.min(511,s===""?0:parseInt(s,10));
  el.value=s===""?"":(parseInt(s,10)>511?"511":s);
  renderDip();
 };
 el.onfocus=()=>{if(i==="dsv"||el.value==="0")el.select()};
 el.onblur=()=>{el.value=ad};
});
$("dir").onclick=e=>{const b=e.target.closest("button");if(b){S.dd=b.dataset.d;save();renderDip()}};
renderDip();

/* ---- patch számoló ---- */
let ptxt="";
$("pc").onclick=()=>{
 const g=(i,a,b)=>Math.min(b,Math.max(a,parseInt($(i).value,10)||a));
 const u=g("pu",1,9999),a=g("pa",1,512),f=g("pf",1,512),n=g("pn",1,500);let c=(u-1)*512+a-1,L=[];
 for(let i=0;i<n;i++){if(c%512+f>512)c=(Math.floor(c/512)+1)*512;L.push(`#${i+1}   ${Math.floor(c/512)+1}.${String(c%512+1).padStart(3,"0")}`);c+=f}
 ptxt=L.join("\n");$("po").textContent=ptxt};
$("pcp").onclick=()=>{if(ptxt){copy(ptxt);toast("Másolva")}else toast("Előbb számolj")};

/* ---- táj: előadások ---- */
const showF=v=>{$("sf").style.display=v?"block":"none";if(v)$("sn").focus()};
$("newShow").onclick=()=>showF($("sf").style.display==="none");
$("sc").onclick=()=>showF(false);
$("ss").onclick=()=>{const n=$("sn").value.trim();if(!n){toast("Adj nevet");return}
 S.shows.push({id:uid(),n,v:$("sv").value.trim(),d:$("sd").value,t:$("st").value,it:[],f1:false,f2:false});save();
 if(window.Notification&&Notification.permission==="default")Notification.requestPermission();
 ["sn","sv","sd","st"].forEach(i=>$(i).value="");showF(false);renderShows()};
const prog=s=>{const dn=s.it.filter(x=>x.d).length;return {dn,p:s.it.length?Math.round(dn/s.it.length*100):0}};
const SO=new Set();
function renderShows(){
 if(!S.shows.length){$("shows").innerHTML='<div class="card"><p class="meta" style="text-align:center">Még nincs előadás. Kattints a „＋ Új előadás” gombra.</p></div>';return}
 /* elöl a legutóbb létrehozott (az id időbélyeg alapú), a dátum szerint elmúltak összecsukva a lista végén, a legfrissebb elöl */
 const td=today(),isPast=s=>s.d&&s.d<td;
 const L=S.shows.filter(s=>!isPast(s)).sort((a,b)=>b.id-a.id),P=S.shows.filter(isPast).sort((a,b)=>a.d<b.d?1:-1);
 const meta=s=>esc([s.v,s.d,s.t?"indulás "+s.t:""].filter(Boolean).join(" · "));
 const body=s=>{const pr=prog(s);return `<div class="bar"><div data-bar="${s.id}" style="width:${pr.p}%"></div></div><div class="meta" data-bt="${s.id}">${pr.dn} / ${s.it.length} kész</div>
  ${s.it.map((x,i)=>`<label class="it${x.d?" d":""}"><input type="checkbox" data-s="${s.id}" data-i="${i}" ${x.d?"checked":""}><span><span class="tx">${esc(x.t)}</span></span><button class="x2" data-r="${s.id}" data-i="${i}" type="button">✕</button></label>`).join("")}
  <div class="row" style="margin-top:10px"><input data-in="${s.id}" placeholder="Új checklist pont..."><button class="btn sm a" data-ab="${s.id}">Hozzáad</button></div>`};
 $("shows").innerHTML=L.map(s=>`<div class="card t"><div style="display:flex;justify-content:space-between;gap:8px"><div><h2>${esc(s.n)}</h2><div class="meta">${meta(s)}</div></div><button class="btn dg sm" data-sd="${s.id}" style="align-self:flex-start">Törlés</button></div>
  ${body(s)}</div>`).join("")+P.map(s=>`<details class="fg past" data-ps="${s.id}" ${SO.has(String(s.id))?"open":""}><summary>${CHEV}<b>${esc(s.n)}</b><span class="tp">${meta(s)}</span><span class="gr"></span></summary><div class="fgb"><button class="btn dg sm" data-sd="${s.id}" style="margin-bottom:10px">Törlés</button>${body(s)}</div></details>`).join("");
}
$("shows").addEventListener("toggle",e=>{const id=e.target.dataset&&e.target.dataset.ps;if(id){if(e.target.open)SO.add(id);else SO.delete(id)}},true);
const fs=id=>S.shows.find(s=>String(s.id)===String(id));
$("shows").addEventListener("change",e=>{
 const c=e.target;if(!c.dataset.s)return;
 const s=fs(c.dataset.s);s.it[+c.dataset.i].d=c.checked;save();
 const lb=c.closest(".it");lb.classList.toggle("d",c.checked);lb.classList.remove("pop");void lb.offsetWidth;lb.classList.add("pop");
 const pr=prog(s);document.querySelector(`[data-bar="${s.id}"]`).style.width=pr.p+"%";
 document.querySelector(`[data-bt="${s.id}"]`).textContent=pr.dn+" / "+s.it.length+" kész";
});
$("shows").addEventListener("click",async e=>{
 const t=e.target;
 if(t.dataset.sd){if(await ask("Törlöd az előadást?")){S.shows=S.shows.filter(s=>String(s.id)!==t.dataset.sd);save();renderShows()}}
 else if(t.dataset.r){e.preventDefault();fs(t.dataset.r).it.splice(+t.dataset.i,1);save();renderShows()}
 else if(t.dataset.ab){const i=document.querySelector(`[data-in="${t.dataset.ab}"]`),v=i.value.trim();if(v){fs(t.dataset.ab).it.push({t:v,d:false});save();renderShows();document.querySelector(`[data-in="${t.dataset.ab}"]`).focus()}}
});
$("shows").addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.dataset.in)document.querySelector(`[data-ab="${e.target.dataset.in}"]`).click()});
renderShows();

/* ---- színpad: előadásonként mi mire van dugva ---- */
const RO=new Set();
function renderRig(){
 $("rigl").innerHTML=S.rigs.map(r=>`<details class="fg" data-rg="${r.id}" ${RO.has(String(r.id))?"open":""}><summary>${CHEV}<b>${esc(r.n)}</b><span class="tp">${r.items.length} tétel</span><span class="gr"></span><button class="btn sm" data-rr="${r.id}">✎</button><button class="btn sm dg" data-rx="${r.id}">✕</button></summary>
  <div class="fgb">${r.items.map((it,i)=>`<div class="rg"><span class="n">${i+1}</span><div class="tt" data-re="${it.id}" data-of="${r.id}"><b>${esc(it.n)}</b> <span class="meta" style="margin:0">–</span> ${esc(it.w)}</div><button class="x2" data-rd="${it.id}" data-of="${r.id}">✕</button></div>`).join("")||'<p class="meta">Még nincs tétel ebben az előadásban.</p>'}
  <div class="row" style="margin-top:10px"><input data-rn="${r.id}" placeholder="Eszköz, pl. Fresnel 650 [Szín]"><input data-rw="${r.id}" placeholder="Hova van dugva, pl. Channel 88"><button class="btn pr a" data-ra="${r.id}">Hozzáad</button></div></div></details>`).join("")||'<div class="card"><p class="meta" style="text-align:center">Még nincs mentett előadás.</p></div>';
}
const fr=id=>S.rigs.find(r=>String(r.id)===String(id));
$("ga").onclick=()=>{const n=$("gn2").value.trim();if(!n){toast("Adj nevet");return}const r={id:uid(),n,items:[]};S.rigs.push(r);RO.add(String(r.id));save();$("gn2").value="";renderRig()};
$("rigl").addEventListener("toggle",e=>{const d=e.target;if(d.dataset&&d.dataset.rg){d.open?RO.add(d.dataset.rg):RO.delete(d.dataset.rg)}},true);
$("rigl").addEventListener("click",async e=>{
 const t=e.target.closest("[data-rr],[data-rx],[data-ra],[data-re],[data-rd]");if(!t)return;
 const d=t.dataset;
 if(d.rr){e.preventDefault();const r=fr(d.rr),n=await askText("Előadás új neve:",r.n);if(n&&n.trim()){r.n=n.trim();save();renderRig()}}
 else if(d.rx){e.preventDefault();if(await ask("Törlöd ezt az előadást a tételeivel?")){S.rigs=S.rigs.filter(r=>String(r.id)!==d.rx);save();renderRig()}}
 else if(d.ra){const a=document.querySelector(`[data-rn="${d.ra}"]`),b=document.querySelector(`[data-rw="${d.ra}"]`),n=a.value.trim();if(!n){toast("Add meg az eszközt");return}
  fr(d.ra).items.push({id:uid(),n,w:b.value.trim()});save();renderRig();document.querySelector(`[data-rn="${d.ra}"]`).focus()}
 else if(d.rd){const r=fr(d.of);r.items=r.items.filter(i=>String(i.id)!==d.rd);save();renderRig()}
 else if(d.re){const r=fr(d.of),it=r.items.find(i=>String(i.id)===d.re),n=await askText("Eszköz:",it.n);if(n===null)return;const w=await askText("Hova van dugva:",it.w);if(w===null)return;it.n=n.trim()||it.n;it.w=w.trim();save();renderRig()}
});
$("rigl").addEventListener("keydown",e=>{if(e.key==="Enter"&&(e.target.dataset.rn||e.target.dataset.rw)){const id=e.target.dataset.rn||e.target.dataset.rw;document.querySelector(`[data-ra="${id}"]`).click()}});
renderRig();

/* ---- gépállás: előadás > lámpák (hova néz, képek) ---- */
const GO=new Set();let gTarget=null;
const gp=id=>S.gep.find(g=>String(g.id)===String(id));
function renderGep(){
 $("gepl").innerHTML=S.gep.map(g=>`<details class="fg" data-gp="${g.id}" ${GO.has(String(g.id))?"open":""}><summary>${CHEV}<b>${esc(g.n)}</b><span class="tp">${g.items.length} lámpa</span><span class="gr"></span><button class="btn sm" data-gr="${g.id}">✎</button><button class="btn sm dg" data-gx="${g.id}">✕</button></summary>
 <div class="fgb">${g.items.map((it,i)=>`<div class="rg" style="align-items:flex-start"><span class="n">${i+1}</span><div class="tt" data-ge="${it.id}" data-of="${g.id}"><b>${esc(it.n)}</b>${it.w?`<div class="meta" style="margin:2px 0 0">Hova néz: ${esc(it.w)}</div>`:""}${(it.imgs||[]).length?`<div class="ims">${it.imgs.map((k,j)=>`<img class="ni" data-gk="${esc(k)}" data-it="${it.id}" data-of="${g.id}" data-j="${j}" alt="Kép">`).join("")}</div>`:""}</div><div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end"><button class="btn sm" data-gi="${it.id}" data-of="${g.id}">＋ Kép</button><button class="x2" data-gd="${it.id}" data-of="${g.id}">✕</button></div></div>`).join("")||'<p class="meta">Még nincs lámpa ebben az előadásban.</p>'}
 <div class="row" style="margin-top:10px"><input data-gn="${g.id}" placeholder="Lámpa, pl. Fresnel 650 [Szín]"><input data-gw="${g.id}" placeholder="Hova néz, pl. DSL, 3 m mélyen"><button class="btn pr a" data-ga="${g.id}">Hozzáad</button></div></div></details>`).join("")||'<div class="card"><p class="meta" style="text-align:center">Még nincs mentett előadás.</p></div>';
 document.querySelectorAll("#gepl img[data-gk]").forEach(im=>imgGet(im.dataset.gk).then(v=>{if(v)im.src=v}).catch(()=>{}));
}
$("gpa").onclick=()=>{const n=$("gp2").value.trim();if(!n){toast("Adj nevet");return}const g={id:uid(),n,items:[]};S.gep.push(g);GO.add(String(g.id));save();$("gp2").value="";renderGep()};
$("gepl").addEventListener("toggle",e=>{const d=e.target;if(d.dataset&&d.dataset.gp){d.open?GO.add(d.dataset.gp):GO.delete(d.dataset.gp)}},true);
$("gepl").addEventListener("click",async e=>{
 const im=e.target.closest(".ni");
 if(im){const g=gp(im.dataset.of),it=g.items.find(x=>String(x.id)===im.dataset.it);openLb(it.imgs,+im.dataset.j);return}
 const t=e.target.closest("[data-gr],[data-gx],[data-ga],[data-ge],[data-gd],[data-gi]");if(!t)return;
 const d=t.dataset;
 if(d.gr){e.preventDefault();const g=gp(d.gr),n=await askText("Előadás új neve:",g.n);if(n&&n.trim()){g.n=n.trim();save();renderGep()}}
 else if(d.gx){e.preventDefault();if(await ask("Biztosan törlöd ezt az előadást a lámpáival és képeivel együtt?","Törlés")){const g=gp(d.gx);g.items.forEach(it=>(it.imgs||[]).forEach(k=>imgDel(k).catch(()=>{})));S.gep=S.gep.filter(x=>x!==g);save();renderGep()}}
 else if(d.ga){const a=document.querySelector(`[data-gn="${d.ga}"]`),b=document.querySelector(`[data-gw="${d.ga}"]`),n=a.value.trim();if(!n){toast("Add meg a lámpát");return}gp(d.ga).items.push({id:uid(),n,w:b.value.trim(),imgs:[]});save();renderGep();document.querySelector(`[data-gn="${d.ga}"]`).focus()}
 else if(d.gd){const g=gp(d.of),it=g.items.find(x=>String(x.id)===d.gd);if(!await ask("Biztosan törlöd ezt a lámpát?","Törlés"))return;(it.imgs||[]).forEach(k=>imgDel(k).catch(()=>{}));g.items=g.items.filter(x=>x!==it);save();renderGep()}
 else if(d.gi){gTarget={g:d.of,it:d.gi};$("gf").click()}
 else if(d.ge){const g=gp(d.of),it=g.items.find(x=>String(x.id)===d.ge),n=await askText("Lámpa:",it.n);if(n===null)return;const w=await askText("Hova néz:",it.w||"");if(w===null)return;it.n=n.trim()||it.n;it.w=w.trim();save();renderGep()}
});
$("gepl").addEventListener("keydown",e=>{if(e.key==="Enter"&&(e.target.dataset.gn||e.target.dataset.gw)){const id=e.target.dataset.gn||e.target.dataset.gw;document.querySelector(`[data-ga="${id}"]`).click()}});
$("gf").onchange=async()=>{
 const fl=[...$("gf").files];$("gf").value="";if(!gTarget||!fl.length)return;
 const g=gp(gTarget.g),it=g&&g.items.find(x=>String(x.id)===gTarget.it);if(!it)return;
 let bad=0;it.imgs=it.imgs||[];
 for(const f of fl){try{const k=it.id+"-"+uid();await imgPut(k,await shrink(f));it.imgs.push(k)}catch(e){bad++}}
 save();GO.add(String(g.id));renderGep();if(bad)toast(bad+" képet nem sikerült menteni");
};
renderGep();

/* ---- jegyzetek (több képpel, lapozható nézegetővel) ---- */
const COL=["#00a597","#3b82f6","#8b5cf6","#f59e0b","#ef4444","#6b7280"];let nc=COL[0],pend=[];
$("sws").innerHTML=COL.map(c=>`<i data-c="${c}" style="background:${c}"></i>`).join("");
const markC=()=>document.querySelectorAll("#sws i").forEach(i=>i.classList.toggle("on",i.dataset.c===nc));
$("sws").onclick=e=>{const i=e.target.closest("i");if(i){nc=i.dataset.c;markC()}};markC();
$("ni").onchange=()=>$("rw2").style.display=$("ni").checked?"":"none";
function renderPend(){$("npw").innerHTML=pend.map((p,i)=>`<div class="p"><img src="${p}" alt=""><button data-pp="${i}" type="button">✕</button></div>`).join("")}
$("npw").addEventListener("click",e=>{const b=e.target.closest("[data-pp]");if(b){pend.splice(+b.dataset.pp,1);renderPend()}});
$("nsc").onclick=()=>$("nf").click();
$("nf").onchange=async()=>{
 const fl=[...$("nf").files];$("nf").value="";
 let bad=0;
 for(const f of fl){try{pend.push(await shrink(f))}catch(e){bad++}}
 renderPend();
 if(bad)toast(bad+" képet nem sikerült megnyitni");
};
$("nsv").onclick=async()=>{
 const t=$("nx").value.trim();
 if(!t&&!pend.length){toast("Írj jegyzetet, vagy tölts fel képet");return}
 const imp=$("ni").checked,id=uid(),keys=pend.map((_,i)=>id+"-"+i);
 try{await Promise.all(pend.map((p,i)=>imgPut(keys[i],p)))}catch(e){toast("Nincs elég hely a képek mentéséhez");return}
 S.notes.unshift({id,t:t||"Kép",c:nc,i:imp,r:imp?$("nr").value:"",d:false,f:false,imgs:keys});save();
 if(imp&&$("nr").value&&window.Notification&&Notification.permission==="default")Notification.requestPermission();
 $("nx").value="";$("nr").value="";$("ni").checked=false;$("rw2").style.display="none";pend=[];renderPend();renderNotes();
};
function renderNotes(){
 $("notes").innerHTML=S.notes.map(n=>{const im=n.imgs||[];
  return `<div class="nt${n.d?" d":""}" style="border-color:${n.c};background:${n.c}1a"><div class="h"><input type="checkbox" data-nd="${n.id}" ${n.d?"checked":""}><div class="nb">${n.i?BELL+" ":""}<span class="tx">${esc(n.t)}</span>${n.r?`<div class="meta" style="margin:2px 0 0">${esc(n.r.replace("T"," "))}</div>`:""}${im.length?`<div class="ims">${im.map((k,i)=>`<img class="ni" data-k="${esc(k)}" data-n="${n.id}" data-i="${i}" alt="Csatolt kép">`).join("")}</div>`:""}</div><button class="x2" data-nx="${n.id}">✕</button></div></div>`}).join("")||'<p class="meta" style="text-align:center">Még nincs jegyzet.</p>';
 document.querySelectorAll("#notes img[data-k]").forEach(im=>imgGet(im.dataset.k).then(v=>{if(v)im.src=v}).catch(()=>{}));
}
$("notes").addEventListener("change",e=>{const c=e.target;if(!c.dataset.nd)return;
 S.notes.find(n=>String(n.id)===c.dataset.nd).d=c.checked;save();
 const b=c.closest(".nt");b.classList.toggle("d",c.checked);b.classList.remove("pop");void b.offsetWidth;b.classList.add("pop")});
$("notes").addEventListener("click",e=>{
 const x=e.target.closest("[data-nx]"),b=e.target.closest(".ni");
 if(x){const n=S.notes.find(o=>String(o.id)===x.dataset.nx);(n.imgs||[]).forEach(k=>imgDel(k).catch(()=>{}));S.notes=S.notes.filter(o=>o!==n);save();renderNotes()}
 else if(b){const n=S.notes.find(o=>String(o.id)===b.dataset.n);openLb(n.imgs,+b.dataset.i)}
});
/* nézegető */
let lbL=[],lbI=0;
async function openLb(keys,i){
 try{lbL=(await Promise.all(keys.map(imgGet))).filter(Boolean)}catch(e){lbL=[]}
 if(!lbL.length){toast("A kép nem található");return}
 lbI=Math.min(i,lbL.length-1);showLb();$("lb").classList.add("on");
}
function showLb(){
 $("lbi").src=lbL[lbI];$("lbc").textContent=(lbI+1)+" / "+lbL.length;
 $("lbp").style.display=$("lbn").style.display=lbL.length>1?"":"none";
}
const stepLb=d=>{if(lbL.length<2)return;lbI=(lbI+d+lbL.length)%lbL.length;showLb()};
const closeLb=()=>{$("lb").classList.remove("on");$("lbi").removeAttribute("src")};
$("lbp").onclick=e=>{e.stopPropagation();stepLb(-1)};
$("lbn").onclick=e=>{e.stopPropagation();stepLb(1)};
$("lbx").onclick=e=>{e.stopPropagation();closeLb()};
$("lb").onclick=e=>{if(e.target===$("lb"))closeLb()};
let tx0=null;
$("lb").addEventListener("touchstart",e=>{tx0=e.touches[0].clientX},{passive:true});
$("lb").addEventListener("touchend",e=>{if(tx0===null)return;const dx=e.changedTouches[0].clientX-tx0;tx0=null;if(Math.abs(dx)>40)stepLb(dx<0?1:-1)});
document.addEventListener("keydown",e=>{if(!$("lb").classList.contains("on"))return;if(e.key==="Escape")closeLb();if(e.key==="ArrowLeft")stepLb(-1);if(e.key==="ArrowRight")stepLb(1)});
renderNotes();

/* ---- értesítések (jegyzet + táj), amíg az oldal nyitva van ---- */
/* telefonon a new Notification hibát dob, ott csak a service workeren át lehet értesíteni */
function notify(msg){
 toast(msg);
 if(!window.Notification||Notification.permission!=="granted")return;
 const opt={body:msg,icon:"icon.png"},direct=()=>{try{new Notification("Pocket Theatre",opt)}catch(e){}};
 if(!navigator.serviceWorker){direct();return}
 navigator.serviceWorker.getRegistration().then(r=>r?r.showNotification("Pocket Theatre",opt):direct()).catch(direct);
}
function checkReminders(){
 let ch=false;const now=Date.now();
 S.notes.forEach(n=>{if(n.i&&!n.d&&!n.f&&n.r&&Date.parse(n.r)<=now){n.f=true;ch=true;notify("Emlékeztető: "+n.t.slice(0,60))}});
 S.shows.forEach(s=>{
  if(!s.d)return;
  const d0=new Date(s.d+"T00:00"),end=d0.getTime()+864e5;
  const e1=new Date(d0);e1.setDate(e1.getDate()-1);e1.setHours(18,0,0,0);
  const e2=new Date(d0);e2.setHours(7,0,0,0);
  const dep=s.t?" Indulás: "+s.t+".":"";
  if(!s.f1&&now>=e1.getTime()&&now<d0.getTime()){s.f1=true;ch=true;notify("Holnap táj: "+s.n+(s.v?" ("+s.v+")":"")+"."+dep)}
  if(!s.f2&&now>=e2.getTime()&&now<end){s.f2=true;ch=true;notify("Ma táj: "+s.n+(s.v?" ("+s.v+")":"")+"."+dep)}
 });
 if(ch)save();
}
setInterval(checkReminders,30000);setTimeout(checkReminders,1500);

/* ---- patch sheet: színpadok > fájlok ---- */
function parseXml(txt){
 const doc=new DOMParser().parseFromString(txt,"text/xml");
 if(doc.querySelector("parsererror"))throw new Error("Hibás XML");
 const out=[],low=n=>n.localName.toLowerCase();
 doc.querySelectorAll("*").forEach(n=>{
  if(low(n)!=="fixture")return;
  const a=k=>n.getAttribute(k)||"";
  let ly="",p=n.parentNode;while(p&&p.nodeType===1){if(low(p)==="layer"){ly=p.getAttribute("name")||"";break}p=p.parentNode}
  let ty="",pt="";
  n.querySelectorAll("*").forEach(c=>{const l=low(c);if(!ty&&l==="fixturetype")ty=c.getAttribute("name")||"";if(!pt&&l==="patch")pt=(c.textContent||"").trim()});
  out.push({l:ly,id:a("fixture_id")||a("id")||(a("channel_id")||a("channel")?"":a("index")),ch:a("channel_id")||a("channel"),n:a("name"),t:ty,p:pt});
 });
 return out;
}
const absA=p=>{p=String(p||"");if(/^\d+$/.test(p)&&+p>0)return +p;const m=/^(\d+)\.(\d+)$/.exec(p);return m?(+m[1]-1)*512+ +m[2]:null};
const fmtA=a=>`${Math.floor((a-1)/512)+1}.${String((a-1)%512+1).padStart(3,"0")}`;
const fmtP=p=>{const a=absA(p);return a?fmtA(a):(p||"–")};
/* típusonként EGY csatornaszám: az azonos universe-ben lévő, azonos típusú szomszédos gépek leggyakoribb címkülönbsége;
   a kézzel beállított érték (S.chOv) mindig erősebb */
function typeCh(fx){
 const g={},R={},uv=a=>Math.floor((a-1)/512);
 fx.forEach(x=>{const a=absA(x.p);if(a!=null)(g[x.t||"?"]=g[x.t||"?"]||[]).push(a)});
 Object.keys(g).forEach(k=>{
  const V=g[k].sort((p,q)=>p-q),cnt={};
  for(let i=0;i<V.length-1;i++){const d=V[i+1]-V[i];if(d>0&&d<=512&&uv(V[i])===uv(V[i+1]))cnt[d]=(cnt[d]||0)+1}
  let mode=0,best=0;Object.keys(cnt).forEach(d=>{if(cnt[d]>best||(cnt[d]===best&&+d<mode)){best=cnt[d];mode=+d}});
  if(mode)R[k]=mode;
 });
 return R;
}
const chOf=(R,t)=>S.chOv[t]||R[t]||0;
const PO=new Set();
const curT=()=>S.theatres.find(t=>String(t.id)===$("xt").value);
function renderStageSel(){
 const v=$("xt").value,w=$("xs").value;
 $("xt").innerHTML=S.theatres.map(t=>`<option value="${t.id}">${esc(t.n)}</option>`).join("")||'<option value="">(automatikus: Saját)</option>';
 if(v&&S.theatres.some(t=>String(t.id)===v))$("xt").value=v;
 const t=curT(),L=t?t.stages:[];
 $("xs").innerHTML=L.map(s=>`<option value="${s.id}">${esc(s.n)}</option>`).join("")||'<option value="">(automatikus: Általános)</option>';
 if(w&&L.some(s=>String(s.id)===w))$("xs").value=w;
}
function renderPatch(){
 renderStageSel();
 const q=$("pq").value.trim().toLowerCase();
 /* újrarajzolás után a táblázat maradjon ott, ahol szerkesztettél */
 const tws=[...document.querySelectorAll("#px .tw")].map(w=>[w.closest("details").dataset.f,w.scrollTop,w.scrollLeft]);
 if(!S.theatres.length){$("px").innerHTML='<p class="meta" style="text-align:center;padding:20px">Hozz létre egy színházat, vagy tölts fel XML fájlokat.</p>';return}
 let html="";
 S.theatres.forEach(th=>{
 let sh="";
 th.stages.forEach(st=>{
  let inner="";
  st.files.forEach(f=>{
   const R=typeCh(f.fx);
   const L=f.fx.filter(x=>!q||[x.n,x.t,x.l,x.id,x.ch,x.p].join(" ").toLowerCase().includes(q));
   if(q&&!L.length)return;
   const cnt={};L.forEach(x=>{const k=x.t||"?";cnt[k]=(cnt[k]||0)+1});
   const chips=Object.keys(cnt).map(k=>{const c=chOf(R,k);return `<span class="tp">${esc(k==="?"?"Ismeretlen":k)} ×${cnt[k]}${c?" · "+c+" csat.":""}</span>`}).join(" ");
   const lc={};L.forEach(x=>{lc[x.l]=(lc[x.l]||0)+1});
   let rows="",last=null,lo=false;
   L.forEach(x=>{if(x.l!==last){last=x.l;lo=!!q||PO.has("l"+f.id+"|"+x.l);rows+=`<tr class="g${lo?" op":""}" data-lg="${esc(x.l)}" data-of="${f.id}"><td colspan="6">${CHEV}${esc(x.l||"Layer nélkül")} <span class="tp">${lc[x.l]}</span></td></tr>`}
    if(!lo)return;
    const kt=x.t||"?",c=chOf(R,kt),a=absA(x.p);
    rows+=`<tr><td>${esc(x.id)}</td><td>${esc(x.ch)}</td><td>${esc(x.n)}</td><td><span class="tp">${esc(x.t||"–")}</span></td><td class="ce" data-ct="${esc(kt)}">${c?`<b>${c}</b>${a?` <span class="meta" style="margin:0">(${fmtA(a)}–${fmtA(a+c-1)})</span>`:""}`:"–"}${S.chOv[kt]?" ✎":""}</td><td class="ce" data-pt="${f.fx.indexOf(x)}" data-of="${f.id}" title="${esc(x.p)}"><b>${esc(fmtP(x.p))}</b>${x.po!==undefined?" ✎":""}</td></tr>`});
   const body=`<div class="tw"><table><thead><tr><th>ID</th><th>Chan</th><th>Név</th><th>Típus</th><th>Csatorna</th><th>Patch</th></tr></thead><tbody>${rows}</tbody></table></div><details class="tcd" data-f="t${f.id}" ${(PO.has("ft"+f.id)||q)?"open":""}><summary>${CHEV}Géptípusok (${Object.keys(cnt).length})</summary><div class="tc">${chips}</div></details>`;
   /* ha a színpadban egyetlen, vele azonos nevű fájl van, nem kell külön lenyíló */
   inner+=st.files.length===1&&f.n===st.n?body:`<details class="fg" data-f="${f.id}" ${(PO.has("f"+f.id)||q)?"open":""}><summary>${CHEV}<b>${esc(f.n)}</b><span class="tp">${f.fx.length} lámpa</span><span class="gr"></span>
    <button class="btn sm" data-rf="${f.id}">✎</button>${f.b?"":`<button class="btn sm dg" data-fx="${f.id}">✕</button>`}</summary>
    <div class="fgb">${body}</div></details>`;
  });
  if(q&&!inner)return;
  sh+=`<details class="fg" data-f="s${st.id}" ${(PO.has("fs"+st.id)||q)?"open":""}><summary>${CHEV}<b>${esc(st.n)}</b><span class="tp">${st.files.length===1&&st.files[0].n===st.n?st.files[0].fx.length+" lámpa":st.files.length+" fájl"}</span><span class="gr"></span>
   <button class="btn sm" data-rs="${st.id}">✎</button>${st.b?"":`<button class="btn sm dg" data-ds="${st.id}">✕</button>`}</summary>
   <div class="fgb">${inner||'<p class="meta">Ebben a színpadban még nincs fájl.</p>'}</div></details>`;
 });
 if(q&&!sh)return;
 html+=`<details class="fg stg" data-f="h${th.id}" ${(PO.has("fh"+th.id)||q)?"open":""}><summary>${CHEV}<b>${esc(th.n)}</b><span class="tp">${th.stages.length} színpad</span><span class="gr"></span>
  <button class="btn sm" data-rh="${th.id}">✎</button>${th.b?"":`<button class="btn sm dg" data-dh="${th.id}">✕</button>`}</summary>
  <div class="fgb">${sh||'<p class="meta">Ebben a színházban még nincs színpad.</p>'}</div></details>`;
 });
 $("px").innerHTML=html||'<p class="meta" style="text-align:center;padding:20px">Nincs találat.</p>';
 tws.forEach(([k,t,l])=>{const w=document.querySelector(`#px details[data-f="${k}"] .tw`);if(w){w.scrollTop=t;w.scrollLeft=l}});
}
$("px").addEventListener("toggle",e=>{const d=e.target;if(d.dataset&&d.dataset.f&&!$("pq").value.trim()){const k="f"+d.dataset.f;d.open?PO.add(k):PO.delete(k)}},true);
const findF=id=>{for(const t of S.theatres)for(const s of t.stages){const f=s.files.find(x=>String(x.id)===String(id));if(f)return {s,f}}return null};
const findS=id=>{for(const t of S.theatres){const s=t.stages.find(x=>String(x.id)===String(id));if(s)return {t,s}}return null};
$("px").addEventListener("click",async e=>{
 const lg=e.target.closest("[data-lg]");
 if(lg){if(!$("pq").value.trim()){const k="l"+lg.dataset.of+"|"+lg.dataset.lg;PO.has(k)?PO.delete(k):PO.add(k);renderPatch()}return}
 const pc=e.target.closest("[data-pt]");
 if(pc){
  const x=findF(pc.dataset.of).f.fx[+pc.dataset.pt],v=await askText("Patch cím (pl. 1.001). Üresen hagyva: az eredeti, a fájlból jövő cím.",fmtP(x.p)==="–"?"":fmtP(x.p));
  if(v===null)return;
  const s=v.trim();
  if(s===""){if(x.po!==undefined){x.p=x.po;delete x.po}}
  else{
   const m=/^(\d+)\.(\d+)$/.exec(s);
   if(!m||+m[1]<1||+m[2]<1||+m[2]>512){toast("Formátum: univerzum.cím, pl. 1.001 (a cím 1 és 512 között)");return}
   if(x.po===undefined)x.po=x.p;
   x.p=`${+m[1]}.${String(+m[2]).padStart(3,"0")}`;
  }
  save();renderPatch();return;
 }
 const ce=e.target.closest("[data-ct]");
 if(ce){
  const k=ce.dataset.ct,b=ce.querySelector("b"),v=await askText(`Csatornaszám a(z) „${k==="?"?"Ismeretlen":k}” típushoz (minden ilyen lámpára érvényes). Üresen hagyva: automatikus.`,S.chOv[k]||(b?b.textContent:""));
  if(v===null)return;
  const s=v.trim();
  if(s==="")delete S.chOv[k];
  else{const n=parseInt(s,10);if(!(n>=1&&n<=512)){toast("1 és 512 közötti szám kell");return}S.chOv[k]=n}
  save();renderPatch();return;
 }
 const t=e.target.closest("[data-rf],[data-fx],[data-rs],[data-ds],[data-rh],[data-dh]");if(!t)return;
 e.preventDefault();
 const d=t.dataset;
 if(d.rf){const r=findF(d.rf),n=await askText("Fájl új neve:",r.f.n);if(n&&n.trim()){r.f.n=n.trim();save();renderPatch()}}
 else if(d.fx){if(await ask("Törlöd ezt a fájlt?")){const r=findF(d.fx);r.s.files=r.s.files.filter(x=>String(x.id)!==d.fx);save();renderPatch()}}
 else if(d.rs){const s=findS(d.rs).s,n=await askText("Színpad új neve:",s.n);if(n&&n.trim()){s.n=n.trim();save();renderPatch()}}
 else if(d.ds){if(await ask("Törlöd a színpadot a benne lévő fájlokkal?")){const t=findS(d.ds).t;t.stages=t.stages.filter(k=>String(k.id)!==d.ds);save();renderPatch()}}
 else if(d.rh){const t=S.theatres.find(k=>String(k.id)===d.rh),n=await askText("Színház új neve:",t.n);if(n&&n.trim()){t.n=n.trim();save();renderPatch()}}
 else if(d.dh){if(await ask("Törlöd a színházat az összes színpadjával és fájljával?")){S.theatres=S.theatres.filter(k=>String(k.id)!==d.dh);save();renderPatch()}}
});
$("pq").oninput=renderPatch;
const pickStage=(t,s)=>{$("xt").value=t.id;renderStageSel();if(s)$("xs").value=s.id};
$("xt").onchange=renderStageSel;
$("xh").onclick=async()=>{const n=await askText("Az új színház neve:");if(n&&n.trim()){const t={id:uid(),n:n.trim(),stages:[]};S.theatres.push(t);PO.add("fh"+t.id);save();renderPatch();pickStage(t)}};
$("xn").onclick=async()=>{const t=curT();if(!t){toast("Előbb adj hozzá színházat");return}const n=await askText("Az új színpad neve (ide: "+t.n+"):");if(n&&n.trim()){const s={id:uid(),n:n.trim(),files:[]};t.stages.push(s);PO.add("fh"+t.id);PO.add("fs"+s.id);save();renderPatch();pickStage(t,s)}};
$("xf").onchange=()=>{
 const files=[...$("xf").files];if(!files.length)return;
 Promise.all(files.map(f=>f.text().then(t=>{try{const r=parseXml(t);return r.length?{id:uid(),n:f.name.replace(/\.xml$/i,""),fx:r}:null}catch(e){return null}}))).then(res=>{
  const ok=res.filter(Boolean);
  if(!ok.length){toast("Nem találtam lámpát a fájlokban");return}
  let th=curT();
  if(!th){th={id:uid(),n:"Saját",stages:[]};S.theatres.push(th)}
  let st=th.stages.find(s=>String(s.id)===$("xs").value);
  if(!st){st={id:uid(),n:"Általános",files:[]};th.stages.push(st)}
  ok.forEach(g=>{st.files.push(g);PO.add("f"+g.id)});PO.add("fs"+st.id);PO.add("fh"+th.id);
  save();renderPatch();pickStage(th,st);toast(ok.length+" fájl betöltve"+(ok.length<files.length?" ("+(files.length-ok.length)+" kihagyva)":""));
 });
 $("xf").value="";
};
renderPatch();

/* ---- védett adatok (tirisztor, térkép, beépített patch): jelszóval titkosítva vannak a nyilvános repóban; megnyitás után csak ezen az eszközön maradnak ---- */
const TK="lt-tiri",MK="lt-map";
let TI=null;try{TI=JSON.parse(localStorage.getItem(TK))}catch(e){}
let MAP=null;try{MAP=JSON.parse(localStorage.getItem(MK))}catch(e){}
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const encHead=f=>fetch(f).then(r=>{if(!r.ok)throw new Error("nincs");return r.json()});
async function encOpen(f,pw){
 const h=await encHead(f);
 const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:unb64(h.salt),iterations:h.iter,hash:"SHA-256"},await crypto.subtle.importKey("raw",new TextEncoder().encode(pw),"PBKDF2",false,["deriveKey"]),{name:"AES-GCM",length:256},false,["decrypt"]);
 return {v:h.v,txt:new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(h.iv)},key,unb64(h.ct)))};
}
/* beépített alap patch: csak egyszer töltődik be, így a törlése és a kézi javítások megmaradnak */
function seedPatch(fx){
 S.nszSeed=true;S.theatres.push({id:uid(),n:"Győri Nemzeti Színház",b:true,stages:[{id:uid(),n:"Nagyszínpad",b:true,files:[{id:uid(),n:"Nagyszínpad",b:true,fx}]}]});save();renderPatch();
}
function renderMap(){
 $("mlk").style.display=MAP?"none":"";$("mp").style.display=MAP?"":"none";
 if(!MAP)$("mf").removeAttribute("srcdoc");
 else if($("v-map").classList.contains("on")&&!$("mf").hasAttribute("srcdoc"))$("mf").srcdoc=MAP.html;
}
const LOCK={"":()=>!TI,map:()=>!MAP,patch:()=>!S.nszSeed};
const rowCells=r=>r.c.flat();
function tiriFind(n){for(const t of TI.tiris)for(const r of t.rows)if(rowCells(r).includes(n))return {t,r,kw:r.c.some(c=>Array.isArray(c)&&c.includes(n))?2:5};return null}
function renderTiri(){
 document.querySelectorAll("[data-tlock]").forEach(el=>{el.innerHTML=!LOCK[el.dataset.tlock]()?"":`<p class="sub">${el.dataset.tlock==="patch"?"A beépített patch":"Ez a rész"} jelszóval védett, eszközönként egyszer kell megadni.</p><div class="row"><div><input type="password" data-tpw autocomplete="current-password" placeholder="Jelszó"></div><button class="btn pr a" data-tun>Megnyitás</button></div>`});
 document.querySelectorAll("[data-tbody]").forEach(el=>{el.style.display=TI?"":"none"});
 if(!TI){$("tig").innerHTML="";return}
 const n=parseInt($("tq").value,10),m=n?tiriFind(n):null;
 $("tqr").textContent=!n?"":m?`${m.t.n} · DMX ${m.r.d}-től induló ág · ${m.kw} kW`:"Erről még nincs adat.";
 const cell=(x,k5)=>`<span class="tz${k5?" k5":""}${x===n?" hit":""}">${x}</span>`;
 $("tig").innerHTML=TI.tiris.map(t=>`<div class="card"><h2>${esc(t.n)}</h2>${t.rows.map(r=>`<div class="tr"><div class="trh"><b>${r.d}-</b> ${esc(r.k)}</div><div class="trg">${r.c.map(c=>`<div class="tcol">${Array.isArray(c)?c.map(x=>cell(x,false)).join(""):cell(c,true)}</div>`).join("")}</div></div>`).join("")}</div>`).join("");
 const h=$("tig").querySelector(".hit");if(h)h.scrollIntoView({block:"center",behavior:"smooth"});
}
function renderHk(){
 const v=$("hk").value.toUpperCase().replace(/\s/g,""),R=$("hkr");
 if(!v){R.innerHTML="";return}
 if(/^F/.test(v)){R.innerHTML='<p class="sub" style="margin:0">Az F gépek a direkt ágon vannak, erről még nincs adat.</p>';return}
 const q=/^(?:CH?)?(\d+)$/.exec(v),n=q&&+q[1],m=n&&tiriFind(n);
 if(!m){R.innerHTML='<p class="sub" style="margin:0">Erről még nincs adat (például az alsó tiri áramkörei).</p>';return}
 if(m.r.e){R.innerHTML=`<p class="sub" style="margin:0">A(z) ${n} előcsarnoki áramkör, a hibakereső ezeket nem kezeli.</p>`;return}
 const O=rowCells(m.r).filter(x=>x!==n);
 R.innerHTML=`<b>${n}</b> · ${esc(m.t.n)} · DMX ${m.r.d}-től induló ág · ${m.kw} kW<p class="sub" style="margin:8px 0 0">Ezeket teszteld még:</p><div class="hcs">${O.map(x=>`<span class="tz">${x}</span>`).join("")}</div><p class="sub" style="margin:0">Ha egyik sem jön, az egész ág leesett: vigyél cserepanelt is.</p>`;
}
$("hk").oninput=renderHk;
$("tq").oninput=renderTiri;
async function tiriUnlock(btn){
 const pw=btn.closest("[data-tlock]").querySelector("[data-tpw]").value;if(!pw)return;
 btn.disabled=true;
 try{
  const [t,m,p]=await Promise.all(["tiri.enc.json","terkep.enc.json","nagyszinpad.enc.json"].map(f=>encOpen(f,pw)));
  TI=JSON.parse(t.txt);localStorage.setItem(TK,t.txt);
  MAP={v:m.v,html:m.txt};localStorage.setItem(MK,JSON.stringify(MAP));
  if(!S.nszSeed)seedPatch(JSON.parse(p.txt));
  renderTiri();renderHk();renderMap();
 }
 catch(e){
  toast(e.name==="OperationError"?"Hibás jelszó":location.protocol==="file:"?"Fájlból megnyitva nem működik, a localhost címen próbáld":!(window.crypto&&crypto.subtle)?"Ezen a címen nem nyitható meg, csak https vagy localhost alatt":e instanceof TypeError&&!navigator.onLine?"Nincs internet, ellenőrizd a kapcsolatot":"Nem sikerült megnyitni: "+e.message);
  btn.disabled=false;
 }
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-tun]");if(b)tiriUnlock(b)});
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.dataset&&e.target.dataset.tpw!==undefined)tiriUnlock(e.target.closest("[data-tlock]").querySelector("[data-tun]"))});
renderTiri();
/* ha új kiosztás vagy térkép jelent meg, a jelszót újra kérjük */
if(TI)encHead("tiri.enc.json").then(h=>{if(h.v!==TI.v){TI=null;localStorage.removeItem(TK);renderTiri();renderHk()}}).catch(()=>{});
if(MAP)encHead("terkep.enc.json").then(h=>{if(h.v!==MAP.v){MAP=null;localStorage.removeItem(MK);renderTiri();renderMap()}}).catch(()=>{});

/* ---- bérkalkulátor ---- */
const fm=n=>Math.round(n).toLocaleString("hu-HU")+" Ft";
function net(g){return S.tax.e?g*0.85:S.tax.u?g*(1-0.185):g*(1-0.15-0.185)}
const otPay=x=>x.h*x.m*S.set.wage;
const tGross=x=>(x.g||0)+(x.h||0)*(x.w||S.set.wage);
function renderHours(){
 $("hw").value=S.set.wage||"";$("te").checked=S.tax.e;$("tu").checked=S.tax.u;
 $("tw").placeholder=S.set.wage?String(S.set.wage):"alap";
 const oh=S.ot.reduce((a,x)=>a+x.h,0),og=S.ot.reduce((a,x)=>a+otPay(x),0);
 const T=S.tours.slice().sort((a,b)=>a.d<b.d?1:-1),tg=T.reduce((a,x)=>a+tGross(x),0);
 $("hst").innerHTML=[[oh.toFixed(2).replace(/\.?0+$/,"")+" h","Túlóra összesen"],[fm(og),"Túlóra pluszjövedelem (bruttó)"],[fm(net(og)),"Túlóra pluszjövedelem (nettó)"],[T.length+" db","Táj összesen"],[fm(tg),"Táj bruttó"],[fm(net(tg)),"Táj nettó"]].map(x=>`<div class="st"><b>${x[0]}</b><span>${x[1]}</span></div>`).join("");
 $("ol").innerHTML=S.ot.map(x=>`<div class="it"><span><b>${x.h} h</b>${x.m>1?" · ünnepnap ×"+x.m:""} → ${fm(otPay(x))} bruttó, <b>${fm(net(otPay(x)))}</b> nettó</span><button class="x2" data-ox="${x.id}">✕</button></div>`).join("")||'<p class="meta">Még nincs túlóra rögzítve.</p>';
 $("tl").innerHTML=T.map(x=>{const w=x.w||S.set.wage;return `<div class="it" style="cursor:pointer"><span data-te="${x.id}"><b>${esc(x.d)}</b> · ${esc(x.n)}<br><span class="meta" style="margin:0">napidíj ${fm(x.g||0)}${x.h?" + "+x.h+" h × "+fm(w)+"/h":""} = ${fm(tGross(x))} bruttó</span> → <b>${fm(net(tGross(x)))}</b> nettó</span><button class="x2" data-tx="${x.id}">✕</button></div>`}).join("")||'<p class="meta">Még nincs táj rögzítve.</p>';
 $("gn").textContent=S.tax.e?"EKHO: 15% levonás (egyszerűsített számítás).":S.tax.u?"25 év alatt: SZJA-mentes, 18,5% járulék (a mentesség havi átlagkereset-határig jár).":"Általános: 15% SZJA + 18,5% járulék. A számítás tájékoztató jellegű.";
}
$("hw").onchange=()=>{S.set.wage=+$("hw").value||0;save();renderHours()};
$("te").onchange=()=>{S.tax.e=$("te").checked;save();renderHours()};
$("tu").onchange=()=>{S.tax.u=$("tu").checked;save();renderHours()};
$("td").value=today();
$("oa").onclick=()=>{const h=parseFloat($("oh").value);if(!h||h<=0){toast("Add meg az órák számát");return}
 S.ot.push({id:uid(),h,m:+$("om").value});save();$("oh").value="";renderHours()};
$("or").onclick=async()=>{if(S.ot.length&&await ask("Nullázod a túlórákat?")){S.ot=[];save();renderHours()}};
$("ta").onclick=()=>{if(!$("td").value){toast("Dátum kell");return}
 const g=parseFloat($("tg").value),h=parseFloat($("th").value),w=parseFloat($("tw").value);
 S.tours.push({id:uid(),d:$("td").value,n:$("tn").value.trim()||"Táj",g:isNaN(g)?0:g,h:isNaN(h)?0:h,w:isNaN(w)?0:w});save();
 ["tn","tg","th","tw"].forEach(i=>$(i).value="");renderHours()};
$("ol").addEventListener("click",e=>{const x=e.target.closest("[data-ox]");if(x){S.ot=S.ot.filter(o=>String(o.id)!==x.dataset.ox);save();renderHours()}});
$("tl").addEventListener("click",async e=>{
 const x=e.target.closest("[data-tx]"),t=e.target.closest("[data-te]");
 if(x){S.tours=S.tours.filter(o=>String(o.id)!==x.dataset.tx);save();renderHours();return}
 if(t){const r=S.tours.find(o=>String(o.id)===t.dataset.te);
  const g=await askText("Napidíj, bruttó (Ft):",r.g||0);if(g===null)return;
  const h=await askText("Dolgozott órák:",r.h||0);if(h===null)return;
  const w=await askText("Órabér (Ft/h, üres = alap):",r.w||"");if(w===null)return;
  r.g=parseFloat(g)||0;r.h=parseFloat(h)||0;r.w=parseFloat(w)||0;save();renderHours()}
});
/* teljes nullázás: az órabér és az adózási beállítások megmaradnak */
$("rz").onclick=async()=>{
 if(!await ask("Biztosan nullázod a bérkalkulátort?\n\nA túlórák és a tájak törlődnek, az órabér megmarad."))return;
 S.ot=[];S.tours=[];save();
 ["oh","tn","tg","th","tw"].forEach(i=>$(i).value="");$("om").value="1";$("td").value=today();
 renderHours();toast("Bérkalkulátor nullázva");
};
})();
