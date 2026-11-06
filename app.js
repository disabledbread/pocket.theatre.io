(function(){
"use strict";
const $=i=>document.getElementById(i);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast=m=>{const t=$("toast");t.textContent=m;t.classList.remove("wait");t.classList.add("on");clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove("on"),2600)};
/* várakozásjelző: addig látszik, amíg a következő üzenet vagy a toastDone le nem váltja */
const toastWait=m=>{const t=$("toast");clearTimeout(toast.h);t.textContent=m;t.classList.add("on","wait")};
const toastDone=()=>{const t=$("toast");if(t.classList.contains("wait"))t.classList.remove("on","wait")};
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
 toastWait("Visszatöltés…");
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
 else driveNote="Nem sikerült elérni a Drive-ot. Ellenőrizd az internetet, és próbáld újra.";
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
 $("gds").textContent=driveNote||(!DRIVE_ID?"Google Drive integráció: fejlesztés alatt.":!on?"A saját Drive-odra ment, egy „Pocket Theatre” mappába. A többi fájlodat az app nem látja.":lastT+nextT);
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
/* Drive-művelet várakozásjelzővel: a gomb addig nem nyomható, a kiírás pedig mutatja, hogy dolgozik az app */
async function driveRun(btn,msg,fn){
 if(btn){btn.disabled=true;btn.classList.add("busy")}
 toastWait(msg);
 try{await fn()}
 catch(e){if(e.status){driveFail(e);toast(driveNote)}else toast(driveOffMsg(e))}
 finally{if(btn){btn.disabled=false;btn.classList.remove("busy")}toastDone()}
}
const driveSave=async()=>{await driveEnsure();toast(await driveUpload()?"Mentés kész":driveNote||"A mentés nem sikerült")};
$("gdc").onclick=()=>driveRun($("gdc"),"Csatlakozás…",async()=>{
 await driveLogin("consent");
 DR.on=true;DR.dirty=false;driveNote="";driveStore();
 const files=await driveShowList();
 if(files.length)toast("Találtam korábbi mentést, alul visszatöltheted");
 else toast(await driveUpload()?"Első mentés kész":driveNote||"A mentés nem sikerült");
});
$("gdn").onclick=()=>driveRun($("gdn"),"Mentés a Drive-ra…",driveSave);
/* a kártya a gombnyomásra azonnal eltűnik; sikertelen mentésnél a következő megnyitáskor jön vissza */
$("gdb").onclick=()=>{
 driveCardOff=true;renderDrive();
 driveRun(null,"Mentés a Drive-ra…",driveSave);
};
$("gdr").onclick=()=>{
 if(driveListOn){driveListOn=false;renderDrive();return}
 driveRun($("gdr"),"Mentések betöltése…",async()=>{await driveEnsure();await driveShowList()});
};
$("gdl").addEventListener("click",e=>{
 const b=e.target.closest("[data-gdf]");if(!b)return;
 driveRun(b,"Mentés letöltése…",async()=>{
  await driveEnsure();
  const txt=await (await driveApi(`/drive/v3/files/${encodeURIComponent(b.dataset.gdf)}?alt=media`)).text();
  toastDone();await restoreBackup(txt);
 });
});
$("gdx").onclick=async()=>{
 if(!await ask("Leválasztod a Google Drive-ot?\n\nA mentés leáll, a telefonon lévő adatok megmaradnak.","Leválasztás"))return;
 let wipe=false,gone=false;
 try{
  await driveEnsure();
  wipe=await ask("A Drive kukájába teszed az ezzel az appal készült összes mentést is?\n\nA Google általában 30 nap után véglegesen törli őket, addig onnan visszahozhatók.","Kukába");
  toastWait("Leválasztás…");
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

/* ---- megjelenés: automatikus, világos vagy sötét; eszközönként, a mentésfájlba nem kerül ---- */
function renderTheme(){const v=document.documentElement.dataset.theme||"";document.querySelectorAll("#thm button").forEach(b=>b.classList.toggle("on",b.dataset.th===v))}
$("thm").addEventListener("click",e=>{const b=e.target.closest("[data-th]");if(!b)return;const v=b.dataset.th;
 if(v)document.documentElement.dataset.theme=v;else delete document.documentElement.dataset.theme;
 try{v?localStorage.setItem("lt-theme",v):localStorage.removeItem("lt-theme")}catch(x){}renderTheme()});
renderTheme();

/* ---- navigáció ---- */
const TT={"v-console":"Konzol","v-dmx":"DMX","v-musor":"Műsor","v-shows":"Előadások","v-misc":"Egyebek","v-notes":"Jegyzetek","v-patch":"Patch sheet","v-calc":"Patch számoló","v-rig":"Színpad","v-gep":"Gépállás","v-set":"Beállítások","v-hours":"Bérkalkulátor","v-map":"Térkép","v-sys":"Rendszer"};
/* az Egyebek oldalai; közülük egy (alapból a Színpad) a Beállításokban választhatóan az alsó menü negyedik gombjára kerül */
const SUBALL=["v-shows","v-notes","v-patch","v-calc","v-rig","v-gep","v-hours","v-map","v-set","v-sys"];
const SLOT_NEV={"v-shows":"Táj","v-notes":"Jegyzet","v-patch":"Patch","v-calc":"Számoló","v-rig":"Színpad","v-gep":"Gépállás","v-hours":"Bér","v-map":"Térkép","v-sys":"Rendszer"};
/* a Tirisztor a Rendszer fül része lett: aki azt tette az alsó menübe, annak a Rendszer kerül oda */
if(S.set.slot==="v-tiri")S.set.slot="v-sys";
const slotId=()=>SLOT_NEV[S.set.slot]?S.set.slot:"v-rig";
const isSub=id=>SUBALL.includes(id)&&id!==slotId();
function renderSlot(){
 const id=slotId(),m=document.querySelector(`.mi[data-go="${id}"]`),b=$("slot");
 b.dataset.t=id;b.innerHTML=m.querySelector("svg").outerHTML+`<span>${SLOT_NEV[id]}</span>`;
 $("slt").innerHTML=Object.keys(SLOT_NEV).map(k=>`<option value="${k}" ${k===id?"selected":""}>${esc(document.querySelector(`.mi[data-go="${k}"] b`).textContent)}</option>`).join("");
 const v=navCur();document.querySelectorAll(".side button").forEach(x=>x.classList.toggle("on",x.dataset.t===(isSub(v)?"v-misc":v)));
 $("back").style.display=isSub(v)?"":"none";
}
$("slt").onchange=()=>{S.set.slot=$("slt").value;save();renderSlot()};
function go(id){
 const prev=(document.querySelector(".view.on")||{}).id;
 document.querySelectorAll(".view").forEach(v=>v.classList.toggle("on",v.id===id));
 const root=isSub(id)?"v-misc":id;
 document.querySelectorAll(".side button").forEach(b=>b.classList.toggle("on",b.dataset.t===root));
 $("ttl").textContent=TT[id];
 $("back").style.display=isSub(id)?"":"none";
 $("newShow").style.display=id==="v-shows"?"":"none";
 /* a Beállítások az Egyebek fejlécében, fogaskerékként érhető el; a kettő közötti váltás animált */
 $("gear").style.display=id==="v-misc"?"":"none";
 const anim=(el,c)=>{el.classList.remove(c);void el.offsetWidth;el.classList.add(c)};
 if(prev==="v-misc"&&id==="v-set")anim($("back"),"pop");
 if(prev==="v-set"&&id==="v-misc")anim($("gear"),"in");
 if(id==="v-hours")renderHours();
 if(id==="v-set")driveLoad().catch(()=>{});
 if(id==="v-sys")renderSys();
 if(id==="v-map")renderMap();
 if(id==="v-musor")renderMusor();
 if(id==="v-rig")renderRig();
 window.scrollTo(0,0);
 navSync();
}
/* telefonos vissza (Android gesztus és gomb): az appon belül lép vissza, és csak a Konzolról lép ki.
   Ehhez egy őrző előzmény-bejegyzés kell, amíg nem a sima Konzolon vagyunk. */
const navCur=()=>{const v=document.querySelector(".view.on");return v?v.id:"v-console"};
const navOverlay=()=>$("dlg").classList.contains("on")||$("lb").classList.contains("on")||$("rm").classList.contains("full")||$("mp").classList.contains("full");
function navSync(){
 const need=navCur()!=="v-console"||navOverlay(),has=!!(history.state&&history.state.pt);
 if(need&&!has)history.pushState({pt:1},"");
 else if(!need&&has){navSync.skip=true;history.back()}
}
window.addEventListener("popstate",()=>{
 if(navSync.skip){navSync.skip=false;return}
 if($("dlg").classList.contains("on"))$("dno").click();
 else if($("lb").classList.contains("on"))closeLb();
 else if($("rm").classList.contains("full"))setFull(false);
 else if($("mp").classList.contains("full"))setMapFull(false);
 else go(isSub(navCur())?"v-misc":"v-console");
 navSync();
});
/* ablakok nyitása és zárása után igazítjuk az őrzőt (rögzítő fázis, mert egyes gombok megállítják a kattintást) */
document.addEventListener("click",()=>setTimeout(navSync,0),true);
renderSlot();
document.addEventListener("click",e=>{const t=e.target.closest("[data-t],[data-go]");if(t)go(t.dataset.t||t.dataset.go)});
/* teljes képernyős térképnél a csípés ne az oldalt nagyítsa (a térkép saját nagyítása a saját kezelőjén át továbbra is működik) */
/* a nem passzív érintésfigyelő lassítja a görgetést, ezért az oldalon csak teljes képernyős térkép alatt van bekapcsolva */
const zoomStop=e=>{if($("mp").classList.contains("full")&&(e.type==="gesturestart"||e.touches.length>1))e.preventDefault()};
function noPageZoom(d,on){
 const m=on===false?"removeEventListener":"addEventListener";
 d[m]("gesturestart",zoomStop);
 d[m]("touchmove",zoomStop,{passive:false});
}
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
const setMapFull=v=>{$("mp").classList.toggle("full",v);noPageZoom(document,v);document.body.classList.toggle("noscroll",v);VP.content=v?VP0+", maximum-scale=1, user-scalable=no":VP0};
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
 $("shows").innerHTML=L.map(s=>`<div class="card t"><div style="display:flex;justify-content:space-between;gap:8px"><div><h2>${esc(s.n)}</h2><div class="meta">${meta(s)}</div></div><div style="display:flex;gap:6px;align-self:flex-start">${s.d?`<button class="btn sm" data-sk="${s.id}">Naptárba</button>`:""}<button class="btn dg sm" data-sd="${s.id}">Törlés</button></div></div>
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
 if(t.dataset.sk){
  /* emlékeztető előző nap 18:00-kor és aznap 07:00-kor, ahogy az app saját értesítései; a kezdés utániakat elhagyjuk */
  const s=fs(t.dataset.sk),st=new Date(s.d+"T"+(s.t||"00:00")+":00"),at=(dd,h)=>Math.round((new Date(st.getFullYear(),st.getMonth(),st.getDate()+dd,h)-st)/6e4);
  const android=/Android/i.test(navigator.userAgent);
  if(!await ask(`Hozzáadod a naptárhoz?\n\n${s.n}\n${s.d}${s.t?" · indulás "+s.t:""}${s.v?" · "+s.v:""}\n\n${android?"A Google Naptár saját emlékeztetője lesz rajta.":"Emlékeztető előző nap 18:00-kor és aznap 07:00-kor."}${s.t?" A befejezést 3 órával későbbre tesszük, ezt a naptárban átírhatod.":" Indulási idő nélkül egész napos esemény lesz."}`,"Hozzáadás",false))return;
  calAdd({cim:s.n,datum:s.d,kezd:s.t||"",hely:s.v,leiras:"Tájelőadás",alarms:[at(-1,18),at(0,7)].filter(m=>m<=0)});
 }
 else if(t.dataset.sd){if(await ask("Törlöd az előadást?")){S.shows=S.shows.filter(s=>String(s.id)!==t.dataset.sd);save();renderShows()}}
 else if(t.dataset.r){e.preventDefault();fs(t.dataset.r).it.splice(+t.dataset.i,1);save();renderShows()}
 else if(t.dataset.ab){const i=document.querySelector(`[data-in="${t.dataset.ab}"]`),v=i.value.trim();if(v){fs(t.dataset.ab).it.push({t:v,d:false});save();renderShows();document.querySelector(`[data-in="${t.dataset.ab}"]`).focus()}}
});
$("shows").addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.dataset.in)document.querySelector(`[data-ab="${e.target.dataset.in}"]`).click()});
renderShows();

/* ---- műsor: a színház havi PDF-jeiből naponta készülő lista (a repó musor mappája, napi GitHub Action); offline az utoljára letöltött marad ---- */
const MUSOR_URL="https://raw.githubusercontent.com/disabledbread/pocket.theatre.io/main/musorlista.json",MUK="lt-musor";
let MU=null;try{MU=JSON.parse(localStorage.getItem(MUK))}catch(e){}
const MS_SOR=["Nagyszínház","Kisfaludy terem","Padlásszínház","Székhelyen kívül"],MS_ROV={"Nagyszínház":"Nagyszínház","Kisfaludy terem":"Kisfaludy","Padlásszínház":"Padlás","Székhelyen kívül":"Táj"};
const MS_HO=["január","február","március","április","május","június","július","augusztus","szeptember","október","november","december"],MS_NAP=["V","H","K","Sze","Cs","P","Szo"];
let msH=null,msSz=null,msOff=false;
function musorLoad(){
 fetch(MUSOR_URL,{cache:"no-cache"}).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(d=>{
  if(!d||!d.honapok||!d.szinpadok)throw new Error("adat");
  MU=d;msOff=false;try{localStorage.setItem(MUK,JSON.stringify(d))}catch(e){}
  if($("v-musor").classList.contains("on"))renderMusor();renderRig();
 }).catch(()=>{msOff=true;renderMusor()});
}
const msSzinpadok=()=>MS_SOR.filter(s=>MU.szinpadok[s]).concat(Object.keys(MU.szinpadok).filter(s=>!MS_SOR.includes(s)));
/* színpadonként: a mai nap, ha van ma előadás, különben a következő előadásnap */
function msKiemelt(sz){const td=today(),nap=(MU.szinpadok[sz]||[]).map(t=>t.datum).filter(d=>d>=td).sort()[0];return {nap,ma:nap===td}}
/* naptár-feliratkozás: a napi futás a három székhelyi színpad minden kombinációjára készít egy .ics fájlt a naptar/ mappába
   (pl. nagyszinhaz-padlas.ics); a telefon naptára magától újraolvassa, így a módosítások és az új hónapok is megjelennek,
   amíg le nem iratkozol. Androidon a Google Naptár veszi fel. A táj nem kerül bele. */
const MS_FEED={"Nagyszínház":"nagyszinhaz","Kisfaludy terem":"kisfaludy","Padlásszínház":"padlas"};
let msFeedOpen=false,msFeedSel=new Set(Object.keys(MS_FEED));
function msFeedUrl(f){
 const u=new URL("naptar/"+f+".ics",location.href),wc="webcal://"+u.host+u.pathname;
 return /Android/i.test(navigator.userAgent)?"https://calendar.google.com/calendar/render?cid="+encodeURIComponent(wc):wc;
}
function msFeed(){
 if(!msFeedOpen)return "";
 const iOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1),and=/Android/i.test(navigator.userAgent);
 const ki=iOS?"Leiratkozás: Naptár app → Naptárak → ⓘ → Leiratkozás.":and?"Leiratkozás: Google Naptár → Beállítások → a naptár → Leiratkozás.":"Leiratkozás a naptárprogram beállításaiban.";
 const f=Object.keys(MS_FEED).filter(s=>msFeedSel.has(s)).map(s=>MS_FEED[s]).join("-");
 return `<div class="msdd"><p class="sub" style="margin:0 0 8px">Jelöld be, melyik színpadok kellenek. Egyszer kell felvenni, utána a változások és az új hónapok maguktól megjelennek. Csak a végleges műsor kerül bele, az előzetes nem.</p>
  <div class="msfd">${Object.keys(MS_FEED).map(s=>`<button class="msck${msFeedSel.has(s)?" on":""}" data-mfs="${esc(s)}">${msFeedSel.has(s)?"✓ ":""}${esc(MS_ROV[s]||s)}</button>`).join("")}</div>
  ${f?`<a class="btn pr wide" style="margin-top:10px" href="${msFeedUrl(f)}" target="_blank" rel="noopener">Feliratkozás</a>`:'<p class="sub" style="margin:10px 0 0">Legalább egy színpadot jelölj be.</p>'}
  <p class="sub" style="margin:8px 0 0">${ki} Ha később másik színpadokat szeretnél, a régire iratkozz le, és vedd fel az újat.</p></div>`;
}
const msHely=(t,sz)=>sz==="Székhelyen kívül"?(t.megjegyzes||"Tájelőadás"):"Győri Nemzeti Színház, "+sz;
const msDatum=d=>{const x=new Date(d+"T12:00:00");return `${MS_HO[x.getMonth()]} ${x.getDate()}., ${MS_NAP[x.getDay()]}`};
function renderMusor(){
 const B=$("msb");if(!B)return;
 if(!MU){B.innerHTML=`<div class="card"><p class="meta" style="text-align:center;margin:0">${msOff?"Nem sikerült letölteni a műsort. Az első betöltéshez internet kell.":"Műsor betöltése…"}</p></div>`;return}
 const td=today(),hs=Object.keys(MU.honapok).sort(),szs=msSzinpadok();
 if(!hs.includes(msH))msH=hs.includes(td.slice(0,7))?td.slice(0,7):hs[0];
 if(!szs.includes(msSz))msSz=szs[0];
 const L=MU.szinpadok[msSz]||[],k=msKiemelt(msSz),a=MU.honapok[msH]||{},hi=hs.indexOf(msH);
 /* a premier (a kisebb színpadokon „bemutató”) nekünk főpróbahetet jelent, ezért külön színnel jelöljük */
 const ev=(t,i)=>{const hl=t.datum===k.nap,pr=/premier|bemutat/i.test(t.megjegyzes||""),tg=[t.megjegyzes&&`<i${pr?' class="p"':""}>${esc(t.megjegyzes)}</i>`,t.modositott&&'<i class="w">módosítva</i>',t.ellenorizendo&&'<i class="w">ellenőrizendő</i>'].filter(Boolean).join("");
  return `<button class="msev${hl?(k.ma?" ma":" kov"):""}${pr?" prem":""}" data-ms="${i}"><span class="mst">${esc(t.kezdes||"–")}</span><span class="msd"><b>${hl?`<span class="msbg${k.ma?"":" kov"}">${k.ma?"Ma":"Következő"}</span>`:""}${esc(t.cim||"(cím nélkül)")}</b>${t.alcim?`<span class="meta">${esc(t.alcim)}</span>`:""}${tg?`<span class="mstg">${tg}</span>`:""}</span></button>`};
 const kiem=!k.nap?`<h3>${esc(msSz)}: nincs több előadás a listában</h3>`:`<h3>${k.ma?"Ma · "+esc(msSz):"Ma nincs előadás · következő: "+msDatum(k.nap)}</h3>`+L.map((t,i)=>t.datum===k.nap?ev(t,i):"").join("");
 const napok=[];L.forEach((t,i)=>{if(!t.datum.startsWith(msH))return;const n=napok[napok.length-1];if(n&&n.d===t.datum)n.l.push(ev(t,i));else napok.push({d:t.datum,l:[ev(t,i)]})});
 const fr=new Date(MU.frissitve);
 B.innerHTML=`<div class="card t"><div class="msfh"><h2>Győri Nemzeti Színház</h2><button class="btn sm" data-msf>Naptárba ${msFeedOpen?"▴":"▾"}</button></div><p class="meta" style="margin:0">Frissítve: ${esc(isNaN(fr)?"":fr.toLocaleString("hu-HU",{dateStyle:"medium",timeStyle:"short"}))}${msOff?" · offline, az utoljára letöltött lista":""}</p>
  <div class="mshon"><button data-mh="${hs[hi-1]||""}" ${hi>0?"":"disabled"} aria-label="Előző hónap">‹</button><b>${msH.slice(0,4)}. ${MS_HO[+msH.slice(5)-1]}<span class="msst ${esc(a.allapot)}">${a.allapot==="elozetes"?"Előzetes":"Végleges"}</span></b><button data-mh="${hs[hi+1]||""}" ${hi<hs.length-1?"":"disabled"} aria-label="Következő hónap">›</button></div>
  <div class="mstab">${szs.map(s=>`<button class="${s===msSz?"on":""}" data-msz="${esc(s)}" title="${esc(s)}">${esc(MS_ROV[s]||s)}</button>`).join("")}</div>${msFeed()}</div>
  <div class="msmai">${kiem}</div>
  <p class="meta msnot"><span>${a.allapot==="elozetes"?"Előzetes":"Végleges"} lista${a.kiadva?" · kiadva: "+esc(String(a.kiadva).replace(/\.+$/,".")):""}${(a.modositva||[]).length?" · módosítva: "+esc(a.modositva.join(", ")):""}</span>${a.pdf?`<a href="${esc(a.pdf)}" target="_blank" rel="noopener">Eredeti PDF</a>`:""}</p>
  ${napok.map(n=>`<div class="msday${n.d<td?" mult":""}${n.d===td?" ma":""}"><div class="msdt"><b>${+n.d.slice(8)}</b><span>${MS_NAP[new Date(n.d+"T12:00:00").getDay()]}</span></div><div class="msevs">${n.l.join("")}</div></div>`).join("")||`<p class="meta" style="text-align:center">Ebben a hónapban nincs előadás: ${esc(msSz)}.</p>`}`;
}
$("msb").addEventListener("click",e=>{
 const b=e.target.closest("[data-mh],[data-msz],[data-ms],[data-msf],[data-mfs]");if(!b)return;
 if(b.dataset.msf!==undefined){msFeedOpen=!msFeedOpen;renderMusor();return}
 if(b.dataset.mfs){const s=b.dataset.mfs;msFeedSel.has(s)?msFeedSel.delete(s):msFeedSel.add(s);renderMusor();return}
 if(b.dataset.mh!==undefined){if(b.dataset.mh){msH=b.dataset.mh;renderMusor()}}
 else if(b.dataset.msz){msSz=b.dataset.msz;renderMusor()}
 else{const t=(MU.szinpadok[msSz]||[])[+b.dataset.ms];if(t)msNaptar(t,msSz)}
});
async function msNaptar(t,sz){
 const hely=msHely(t,sz),kezd=t.kezdes||"19:00";
 if(!await ask(`Hozzáadod a naptárhoz?\n\n${t.cim||"Előadás"}\n${msDatum(t.datum)} ${kezd} · ${hely}\n\nA befejezést 3 órával későbbre tesszük, ezt a naptárban átírhatod.`,"Hozzáadás",false))return;
 calAdd({cim:t.cim||"Előadás",datum:t.datum,kezd,hely,leiras:[t.alcim,t.megjegyzes].filter(Boolean).join(" · ")});
}
/* naptárba: Androidon a Google Naptár (ott a saját alapértelmezett emlékeztető marad), máshol .ics fájl emlékeztetőkkel;
   helyi idő, kezdés nélkül egész napos, alapból 3 órás hossz; e.alarms: percek a kezdéshez képest (negatív = előtte) */
function calAdd(e){
 const p=n=>String(n).padStart(2,"0"),dt=d=>d.getFullYear()+p(d.getMonth()+1)+p(d.getDate()),f=d=>dt(d)+"T"+p(d.getHours())+p(d.getMinutes())+"00";
 const st=new Date(e.datum+"T"+(e.kezd||"00:00")+":00"),en=e.kezd?new Date(st.getTime()+3*36e5):new Date(st.getFullYear(),st.getMonth(),st.getDate()+1);
 if(/Android/i.test(navigator.userAgent)){
  window.open("https://calendar.google.com/calendar/render?"+new URLSearchParams({action:"TEMPLATE",text:e.cim,dates:e.kezd?f(st)+"/"+f(en):dt(st)+"/"+dt(en),ctz:"Europe/Budapest",location:e.hely||"",details:e.leiras||""}),"_blank");return;
 }
 const x=s=>String(s||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/([,;])/g,"\\$1");
 const al=(e.alarms||[]).map(m=>["BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:"+x(e.cim),"TRIGGER:"+(m<0?"-":"")+"PT"+Math.abs(m)+"M","END:VALARM"].join("\r\n"));
 const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Pocket Theatre//HU","BEGIN:VEVENT","UID:"+uid()+"@pocket-theatre","DTSTAMP:"+new Date().toISOString().replace(/[-:]/g,"").slice(0,15)+"Z",
  e.kezd?"DTSTART:"+f(st):"DTSTART;VALUE=DATE:"+dt(st),e.kezd?"DTEND:"+f(en):"DTEND;VALUE=DATE:"+dt(en),"SUMMARY:"+x(e.cim),"LOCATION:"+x(e.hely),"DESCRIPTION:"+x(e.leiras),...al,"END:VEVENT","END:VCALENDAR"].join("\r\n");
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([ics],{type:"text/calendar"}));a.download=(e.cim.replace(/[^\p{L}\p{N} ]+/gu,"").trim()||"eloadas")+".ics";
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),10000);
}
/* a Színpad menühöz: mai előadások és a mentett nevek összevetése (kis-nagybetű, ékezet, írásjel nélkül; a mentett név tartalmazhatja a címet) */
const msNorm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const msEgyezik=(nev,cim)=>{const c=msNorm(cim);return !!c&&(" "+msNorm(nev)+" ").includes(" "+c+" ")};
function msMai(){if(!MU)return [];const td=today(),o=[];Object.keys(MU.szinpadok).forEach(sz=>MU.szinpadok[sz].forEach(t=>{if(t.datum===td&&t.cim)o.push(Object.assign({sz},t))}));return o}

/* ---- színpad: előadásonként mi mire van dugva ---- */
const RO=new Set();
function renderRig(){
 /* a mai előadással egyező mentett előadás kerül legfelülre, kiemelve */
 const mai=msMai(),L=S.rigs.map(r=>({r,h:mai.find(t=>msEgyezik(r.n,t.cim))}));
 $("rigl").innerHTML=L.filter(x=>x.h).concat(L.filter(x=>!x.h)).map(({r,h})=>`<details class="fg${h?" msrig":""}" data-rg="${r.id}" ${RO.has(String(r.id))?"open":""}><summary>${CHEV}<b>${esc(r.n)}</b>${h?`<span class="tp msma">MA ${esc(h.kezdes?h.kezdes+" · ":"")}${esc(h.sz)}</span>`:""}<span class="tp">${r.items.length} tétel</span><span class="gr"></span><button class="btn sm" data-rr="${r.id}">✎</button><button class="btn sm dg" data-rx="${r.id}">✕</button></summary>
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
musorLoad();

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
   const L=f.fx.map((x,i)=>Object.assign({},x,{_i:i})).filter(x=>!q||[x.n,x.t,x.l,x.id,x.ch,x.p].join(" ").toLowerCase().includes(q));
   if(q&&!L.length)return;
   const cnt={};L.forEach(x=>{const k=x.t||"?";cnt[k]=(cnt[k]||0)+1});
   const chips=Object.keys(cnt).map(k=>{const c=chOf(R,k);return `<span class="tp">${esc(k==="?"?"Ismeretlen":k)} ×${cnt[k]}${c?" · "+c+" csat.":""}</span>`}).join(" ");
   const lc={};L.forEach(x=>{lc[x.l]=(lc[x.l]||0)+1});
   let rows="",last=null,lo=false;
   L.forEach(x=>{if(x.l!==last){last=x.l;lo=!!q||PO.has("l"+f.id+"|"+x.l);rows+=`<tr class="g${lo?" op":""}" data-lg="${esc(x.l)}" data-of="${f.id}"><td colspan="6">${CHEV}${esc(x.l||"Layer nélkül")} <span class="tp">${lc[x.l]}</span></td></tr>`}
    if(!lo)return;
    const kt=x.t||"?",c=chOf(R,kt),a=absA(x.p);
    rows+=`<tr><td>${esc(x.id)}</td><td>${esc(x.ch)}</td><td>${esc(x.n)}</td><td><span class="tp">${esc(x.t||"–")}</span></td><td class="ce" data-ct="${esc(kt)}">${c?`<b>${c}</b>${a?` <span class="meta" style="margin:0">(${fmtA(a)}–${fmtA(a+c-1)})</span>`:""}`:"–"}${S.chOv[kt]?" ✎":""}</td><td class="ce" data-pt="${x._i}" data-of="${f.id}" title="${esc(x.p)}"><b>${esc(fmtP(x.p))}</b>${x.po!==undefined?" ✎":""}</td></tr>`});
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
$("pq").oninput=()=>{clearTimeout(renderPatch.t);renderPatch.t=setTimeout(renderPatch,200)};
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
const encHead=f=>fetch(f,{cache:"no-cache"}).then(r=>{if(!r.ok)throw new Error("nincs");return r.json()});
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
const LOCK={"":()=>!TI,map:()=>!MAP,patch:()=>!S.nszSeed,vil:()=>!VIL};
/* ---- rendszer: a világításvezérlés (Csalogány Zsolt GYNSY rajza alapján) és a tirisztorok egy fülön ---- */
/* a vezérlés adata is jelszóval titkosítva van a repóban (vilagitas.enc.json); megnyitás után csak ezen az eszközön marad */
const VK="lt-vil";
let VIL=null;try{VIL=JSON.parse(localStorage.getItem(VK))}catch(e){}
let sysTab="vez",vTab="kep",vLine="01",vDev=null;
const V_ICON={konzol:"🎛️",halozat:"🌐",node:"🗣️",splitter:"🔀",dimmer:"🎚️",direkt:"⚡",panel:"🔘",patch:"🧩",atvezeto:"📦",ado:"📡",lampa:"💡",vegpont:"🔌"};
const V_TABS=[["kep","Nagy kép"],["helyek","Mi hol van?"],["vonalak","Vonalak"],["kabel","Kábelkereső"],["cimke","Címke"],["szotar","Szótár"]];
/* gyorsítótárazott keresőtáblák, amíg ugyanaz az adatváltozat van megnyitva */
function vx(){
 if(vx.c&&vx.c.v===VIL.v)return vx.c;
 const D=VIL.d,PASS={};D.atkotesek.forEach(a=>{(PASS[a.keszulek]=PASS[a.keszulek]||{})[a.be]=a.ki});
 return vx.c={v:VIL.v,D,PASS,DEV:Object.fromEntries(D.keszulekek.map(k=>[k.id,k])),HELY:Object.fromEntries(D.helyek.map(h=>[h.id,h])),LINE:Object.fromEntries(D.vonalak.map(v=>[v.id,v]))};
}
const vColor=id=>id?`hsl(${(parseInt(id,10)*47)%360} 70% var(--L))`:"var(--mu)";
const vSplit=e=>{const i=e.indexOf(":");return i<0?[e,""]:[e.slice(0,i),e.slice(i+1)]};
/* magyar toldalék számokhoz: 1-es, 3-as, 5-ös, 6-os, 20-as, 40-es … */
const vSfx=n=>{n=parseInt(n,10);if(n===0)return"-s";const l=n%10;if(l)return"-"+["","es","es","as","es","ös","os","es","as","es"][l];const t=n%100/10|0;if(t)return"-"+["","es","as","as","es","es","as","es","as","es"][t];return"-as"};
const vPortTxt=p=>!p?"":p==="DMXin"?"DMX bemenet":p==="DMXout"?"DMX kimenet (továbbvezetés)":/^E\d+$/.test(p)?p+" hálózati port":/^LAN/.test(p)?p+" port":/^[A-H]$/.test(p)?p+" kimenet":/^\d+$/.test(p)?p+vSfx(p)+" aljzat":"„"+p+"” aljzat";
const vDevName=id=>{const k=vx().DEV[id];return k?k.nev:id};
const vDevPort=(d,p)=>{const k=vx().DEV[d],o=k&&k.kijelzo&&k.kijelzo.portok&&k.kijelzo.portok[p]||"";return /^IN/.test(o)?p+" bemenet":vPortTxt(p)};
const vDevLine=e=>{const[d,p]=vSplit(e),k=vx().DEV[d];return `${V_ICON[k&&k.tipus]||""} <b>${esc(vDevName(d))}</b>${d.startsWith("=")?` <span class="meta" style="margin:0">${esc(d)}</span>`:""}${p?" – "+esc(vDevPort(d,p)):""}`};
const vHely=e=>{const X=vx(),k=X.DEV[vSplit(e)[0]];return k&&X.HELY[k.hely]?X.HELY[k.hely].nev:""};
function vCable(c){
 const X=vx();
 return `<div class="card" style="--c:${vColor(c.vonal)};border-left:4px solid var(--c);margin:0 0 8px">
 <h2><span class="vcab">${c.szam}</span>${c.fajta==="halozat"?"Hálózati kábel (CAT6)":c.vonal?`DMX kábel – .${c.vonal} ${esc(X.LINE[c.vonal].nev)}`:"DMX kábel – tartalék, nincs vonalszáma"}</h2>
 <div class="vconn"><span class="meta" style="margin:0">Egyik vége:</span><span>${vDevLine(c.honnan)} <span class="meta" style="margin:0">(${esc(vHely(c.honnan))})</span></span>
 <span class="meta" style="margin:0">Másik vége:</span><span>${vDevLine(c.hova)} <span class="meta" style="margin:0">(${esc(vHely(c.hova))})</span></span></div>
 ${c.megjegyzes?`<p class="sub" style="margin:6px 0 0">${esc(c.megjegyzes)}</p>`:""}${c.kerdes?`<p class="sub" style="margin:6px 0 0">⚠ ${esc(c.kerdes)}</p>`:""}</div>`;
}
/* egy vonal fája: a kábel végén lévő készülékből ugyanazon a vonalon továbbmenő kábelek (az átvezető dobozoknál a párosított aljzaton) */
function vKids(cab){const X=vx(),[d,p]=vSplit(cab.hova);return X.D.kabelek.filter(k=>k.vonal===cab.vonal&&k!==cab&&vSplit(k.honnan)[0]===d&&(!X.PASS[d]||!X.PASS[d][p]||vSplit(k.honnan)[1]===X.PASS[d][p]))}
function vLi(cab,depth){
 const X=vx(),[d,p]=vSplit(cab.hova),k=X.DEV[d]||{},ch=depth<8?vKids(cab):[];
 const pass=X.PASS[d]&&X.PASS[d][p]?` · ${p}${vSfx(p)} aljzaton be, ${X.PASS[d][p]}${vSfx(X.PASS[d][p])} aljzaton ki`:"";
 return `<li><span class="vcab">${cab.szam}</span><span class="vnode">${V_ICON[k.tipus]||""} <b>${esc(vDevName(d))}</b><small>${esc(X.HELY[k.hely]?X.HELY[k.hely].nev:"")}${d.startsWith("=")?" · "+esc(d):""}${p&&!pass?" · "+esc(vPortTxt(p)):""}${pass}${k.db?` · ${k.db} db ${esc(k.lampak)}`:""}</small></span>${ch.length?`<ul>${ch.map(c=>vLi(c,depth+1)).join("")}</ul>`:""}</li>`;
}
/* kábelcímke-olvasó; a kettőspont az elején elmaradhat (a PDF-ből másolva gyakran lemarad) */
const V_RE=/^(?::?([^\-:=]+?))?\s*-->\s*(=?[^:\[]+?)(?:\[(\d+)\])?(?::([^.]+?))?(?:\.(\d+))?\s*-\s*(\d{3})$/;
const V_EX=[":B-->=02x:2.09-021",":F-->=11x[17]:DMXin.11-055",":5-->=042:DMXin.01-026",":1-->Bal Első Direkt csapda.01-027",":E3-->=014:E1-007"];
function vLabel(s){
 const X=vx();s=s.replace(/\s*\n\s*/g,"").trim();const m=s.match(V_RE);
 if(!m){const no=(s.match(/-(\d{3})\s*$/)||[])[1],c=no&&X.D.kabelek.find(k=>k.szam===no);
  return c?`<p class="sub" style="margin:12px 0 6px">A címke többi részét nem tudom szétszedni, de a végén lévő szám alapján ez a ${no}${vSfx(no)} kábel:</p>${vCable(c)}`:s?'<p class="sub" style="margin:12px 0 0">Ezt nem tudom értelmezni. A formátum: <code>:honnan-->=hova:aljzat.vonal-kábel</code></p>':""}
 let[,fp,dv,db,tp,ln,no]=m;dv=dv.trim();
 const lnId=ln?String(parseInt(ln,10)).padStart(2,"0"):null;
 const devId=dv.startsWith("=")?dv.replace(/^=(\d\d)$/,"=0$1"):(X.D.keszulekek.find(k=>k.nev.toLowerCase()===dv.toLowerCase())||{}).id||dv;
 const show=[],parts=[];
 if(fp){show.push(`<span class="vk1">:${esc(fp)}</span>`);parts.push(["vk1",":"+fp,`Ebből az aljzatból indul (${vPortTxt(fp)} ennél a készüléknél, ahol a címke van).`])}
 show.push('<span class="vk0">--></span>');
 show.push(`<span class="vk2">${esc(dv)}${db?"["+db+"]":""}</span>`);parts.push(["vk2",dv,`Ide megy: <b>${esc(vDevName(devId))}</b>${db?`, rajta ${db} lámpa`:""}.`]);
 if(tp){show.push(`<span class="vk3">:${esc(tp)}</span>`);parts.push(["vk3",":"+tp,`Annak a készüléknek ebbe az aljzatába: ${vPortTxt(tp)}.`])}
 if(ln){show.push(`<span class="vk4">.${esc(ln)}</span>`);parts.push(["vk4","."+ln,`A ${parseInt(ln,10)}. DMX vonalon utazik: ${esc(X.LINE[lnId]?X.LINE[lnId].nev:"?")}.`])}
 show.push(`<span class="vk5">-${esc(no)}</span>`);parts.push(["vk5","-"+no,`Ez a ${no}${vSfx(no)} kábel. A másik végén ugyanez a szám áll.`]);
 let sum="";const c=X.D.kabelek.find(k=>k.szam===no);
 if(c){const hd=vSplit(c.honnan)[0],td=vSplit(c.hova)[0],near=td===devId?c.honnan:hd===devId?c.hova:null;
  sum=(near?`<b>Vagyis:</b> ez a címke itt van: ${vDevLine(near)}. A kábel másik vége: ${vDevLine(near===c.hova?c.honnan:c.hova)}.`
   :`<b>Vagyis:</b> a ${no}${vSfx(no)} kábel ezt a kettőt köti össze: ${vDevLine(c.honnan)} és ${vDevLine(c.hova)}.`)+(c.kerdes?`<br><span class="meta" style="margin:0">⚠ ${esc(c.kerdes)}</span>`:"")}
 return `<div class="vlab">${show.join("")}</div><ul class="vparts">${parts.map(([k,a,b])=>`<li><span class="${k}">${esc(a)}</span><span>${b}</span></li>`).join("")}</ul>${sum?`<p style="margin:12px 0 0">${sum}</p>`:""}`;
}
function vKabelRes(v){
 const X=vx(),n=String(v||"").replace(/\D/g,"");if(!n)return "";
 const c=X.D.kabelek.find(k=>k.szam===n.padStart(3,"0"));
 return c?vCable(c):`<p class="sub" style="margin:0">Nincs ${esc(n)}${vSfx(n)} kábel a rajzon (001–068 vannak).</p>`;
}
function vDetail(id){
 const X=vx(),k=X.DEV[id];if(!k)return "";
 const cs=X.D.kabelek.filter(c=>vSplit(c.honnan)[0]===k.id||vSplit(c.hova)[0]===k.id);
 const kij=k.kijelzo?`<p style="margin:6px 0">A kijelzője szerint: <b>${esc(k.kijelzo.nev)}</b>, ${esc(k.kijelzo.halozat)}, IP ${esc(k.kijelzo.ip)}.<br>${Object.entries(k.kijelzo.portok).map(([p,v])=>`${p}: ${esc(v)}`).join(" · ")}</p>`:"";
 return `<div class="card vdet"><button class="vx" data-vclose aria-label="Bezárás">×</button><h2>${V_ICON[k.tipus]||""} ${esc(k.nev)} <span class="meta" style="margin:0">${k.id.startsWith("=")?esc(k.id):""}</span></h2>
 <p class="sub" style="margin:0">${esc(X.HELY[k.hely]?X.HELY[k.hely].nev:"")}${k.modell?" · "+esc(k.modell):""}${k.db?` · ${k.db} db ${esc(k.lampak)}`:""}</p>${kij}${k.megjegyzes?`<p style="margin:6px 0">${esc(k.megjegyzes)}</p>`:""}
 <p style="margin:10px 0 6px"><b>${cs.length} kábel csatlakozik hozzá:</b></p>${cs.map(vCable).join("")}</div>`;
}
function renderVil(){
 renderLocks();
 $("vbody").style.display=VIL?"":"none";
 if(!VIL){$("vpan").innerHTML="";return}
 const X=vx(),D=X.D;
 $("vnav").innerHTML=V_TABS.map(([k,n])=>`<button class="${k===vTab?"on":""}" data-vt="${k}">${n}</button>`).join("");
 let h="";
 if(vTab==="kep"){
  const lampak=D.keszulekek.reduce((s,k)=>s+(k.db||0),0);
  const facts=[[2,"GrandMA2 pult"],[3,"node"],[D.vonalak.length,"DMX vonal"],[D.kabelek.length,"számozott kábel"],[D.keszulekek.filter(k=>k.tipus==="splitter").length,"splitter"],[lampak+"+","lámpa a tartókon"]];
  h=`<div class="card t"><h2>Hogyan jut el a parancs a pulttól a lámpáig?</h2><p class="sub">Minden fényparancs ugyanazt az utat járja be, fentről lefelé.</p>
  <div class="vflow">
   <div class="vst"><div class="em">🎛️</div><b>Pult (2 db)</b><i>az agy</i><p>Két GrandMA2 konzol: az A-pult és a B-pult. Itt dönti el a világosító, melyik lámpa mit csináljon.</p></div>
   <div class="vst"><div class="em">📮</div><b>Switch</b><i>a posta</i><p>A pultok parancsai hálózati kábelen jutnak el ide, és innen mennek tovább a node-okhoz.</p></div>
   <div class="vst"><div class="em">🗣️</div><b>Node (3 db)</b><i>a tolmács</i><p>Lefordítja a hálózati jelet DMX-re, mert a lámpák ezt a nyelvet értik. Minden kimenete egy DMX vonal.</p></div>
   <div class="vst"><div class="em">🔀</div><b>Splitter / doboz</b><i>az elosztó</i><p>A splitter egy vonalat több felé oszt szét. Az átvezető doboz csak továbbadja a jelet egy másik helyiségbe.</p></div>
   <div class="vst"><div class="em">💡</div><b>Végpont</b><i>aki végrehajtja</i><p>Dimmerszekrény, direkt szekrény, lámpa vagy egy aljzat a csapdában, ahova lámpát lehet dugni.</p></div>
  </div>
  <div class="vfacts">${facts.map(([n,t])=>`<div class="vfact"><b>${n}</b><span>${t}</span></div>`).join("")}</div></div>
  <div class="vwarn">${esc(D.meta.megjegyzes_a_rajzrol)} Forrás: ${esc(D.meta.keszitette)} rajza (${esc(D.meta.rajz_datuma)}).</div>`;
 }
 else if(vTab==="helyek"){
  h=`<p class="sub">Helyiségenként az összes készülék. Koppints egyre, és megmutatja, mi jön bele és mi megy ki belőle.</p><div id="vdet">${vDev?vDetail(vDev):""}</div>
  <div class="vplaces">${D.helyek.map(p=>`<div class="card"><h2>${esc(p.nev)}</h2><p class="sub" style="margin:0 0 6px">${esc(p.leiras)}</p>${D.keszulekek.filter(k=>k.hely===p.id).map(k=>`<button class="vchip${k.id===vDev?" on":""}" data-vd="${esc(k.id)}">${V_ICON[k.tipus]||""} ${esc(k.nev)}</button>`).join("")}</div>`).join("")}</div>`;
 }
 else if(vTab==="vonalak"){
  const v=X.LINE[vLine],[sd,sp]=vSplit(v.forras),node=X.DEV[sd],start=D.kabelek.filter(k=>k.honnan===v.forras),ins=D.kabelek.filter(k=>k.vonal===vLine&&vSplit(k.hova)[0]===sd);
  h=`<p class="sub">Válassz egy vonalat, és megmutatja, honnan indul és hova jut el. A kis szám a kábel száma. A vonal száma megegyezik a pultban lévő univerzum számával.</p>
  <div class="vlines">${D.vonalak.map(l=>`<button class="${l.id===vLine?"on":""}" data-vl="${l.id}" style="--c:${vColor(l.id)}">.${l.id} ${esc(l.nev)}</button>`).join("")}</div>
  <div class="card" style="--c:${vColor(vLine)}"><h2><span class="vdot"></span>.${vLine} – ${esc(v.nev)}</h2>
  <p class="sub">A pultban: ${v.univerzum}. univerzum. Indul: ${esc(node.nev)} (${esc(sd)}), ${esc(sp)} kimenet.</p>
  <ul class="vtree"><li><span class="vnode">🗣️ <b>${esc(node.nev)}</b><small>${esc(X.HELY[node.hely].nev)} · ${esc(sd)} · ${esc(sp)} kimenet</small></span><ul>${start.map(c=>vLi(c,0)).join("")}</ul></li></ul>
  ${ins.map(c=>`<p class="sub" style="margin:10px 0 0">↩ Erre a vonalra be is jön jel: <span class="vcab">${c.szam}</span> ${vDevLine(c.honnan)} → ${vDevLine(c.hova)}. ${esc(c.megjegyzes||"")}</p>`).join("")}</div>`;
 }
 else if(vTab==="kabel"){
  h=`<div class="card t"><h2>Kábelkereső</h2><p class="sub">Írd be a kábel számát (pl. 47), és megmondja, mit hova köt.</p><input id="vkin" inputmode="numeric" placeholder="Kábelszám, pl. 47" autocomplete="off"><div id="vkres" style="margin-top:12px"></div></div>`;
 }
 else if(vTab==="cimke"){
  h=`<div class="card t"><h2>Így olvasd a kábelcímkét</h2><p class="sub">Minden kábel mindkét végén van egy címke, és mindig azt mondja meg, <b>hova megy</b> a kábel másik vége. Írj be egy címkét a rajzról, vagy válassz egy példát.</p>
  <input id="vlin" value="${esc(V_EX[0])}" autocomplete="off" spellcheck="false" aria-label="Kábelcímke"><div class="msfd" style="display:flex;flex-wrap:wrap;margin-top:8px">${V_EX.map(e=>`<button class="vchip" data-vex="${esc(e)}">${esc(e)}</button>`).join("")}</div><div id="vlres">${vLabel(V_EX[0])}</div></div>`;
 }
 else{
  h=`<div class="vdict">
  <div class="card"><h2>DMX vonal (univerzum)</h2><p>Egy „utca”, amin a parancsok utaznak. Egy vonalon legfeljebb 512 csatorna fér el. A vonal száma megegyezik a pultban lévő univerzum számával (a .04-es vonal = 4-es univerzum).</p></div>
  <div class="card"><h2>Node</h2><p>Doboz, ami a hálózati kábelről érkező parancsot DMX-re fordítja. Három van: a fényszabályzóban egy 4 portos, a felső tirisztorosban egy 4 és egy 8 portos.</p></div>
  <div class="card"><h2>Splitter</h2><p>Elosztó: egy bemenő DMX vonalat több kimenetre másol. Mint egy elosztó, csak jelnek.</p></div>
  <div class="card"><h2>Dimmer / tirisztor</h2><p>A hagyományos lámpák fényerejét szabályozó szekrény. A „tirisztoros” az a helyiség, ahol ezek állnak.</p></div>
  <div class="card"><h2>Direkt szekrény</h2><p>Nem szabályoz fényerőt, csak ki-be kapcsol (pl. motoros lámpák, ködgép áramellátása).</p></div>
  <div class="card"><h2>Csapda</h2><p>Fedeles aljzatdoboz a színpad padlójában. Ide lehet bedugni a lámpát vagy a DMX kábelt.</p></div>
  <div class="card"><h2>Lány és Fiú</h2><p>A DMX csatlakozók két fajtája. Lány = lyukas aljzat, Fiú = tüskés aljzat. Az átvezető dobozokban a jel a Lányon jön be, és a mellette lévő Fiún megy tovább.</p></div>
  <div class="card"><h2>Tartó</h2><p>A színpad fölötti rúd (0–4.), amin a lámpák lógnak. A szögletes zárójel a lámpák száma, pl. [28] = 28 lámpa.</p></div></div>
  <div class="card" style="margin-top:12px"><h2>Nyitott kérdések a rajzhoz</h2><p class="sub">Ezekre még nincs biztos válasz. Ha tudod, szólj.</p><ol class="vq">${D.kerdesek.map(q=>`<li>${esc(q)}</li>`).join("")}</ol></div>`;
 }
 $("vpan").innerHTML=h;
}
function renderSys(){
 document.querySelectorAll("#sysseg button").forEach(b=>b.classList.toggle("on",b.dataset.sys===sysTab));
 $("sys-vez").style.display=sysTab==="vez"?"":"none";$("sys-tiri").style.display=sysTab==="tiri"?"":"none";
 if(sysTab==="tiri"){$("tq").value="";renderTiri()}else renderVil();
}
$("sysseg").addEventListener("click",e=>{const b=e.target.closest("[data-sys]");if(b){sysTab=b.dataset.sys;renderSys()}});
$("sys-vez").addEventListener("click",e=>{
 const b=e.target.closest("[data-vt],[data-vl],[data-vd],[data-vclose],[data-vex]");if(!b)return;
 if(b.dataset.vt){vTab=b.dataset.vt;renderVil()}
 else if(b.dataset.vl){vLine=b.dataset.vl;renderVil()}
 else if(b.dataset.vd){vDev=vDev===b.dataset.vd?null:b.dataset.vd;renderVil();if(vDev)$("vdet").scrollIntoView({block:"start",behavior:"smooth"})}
 else if(b.dataset.vclose!==undefined){vDev=null;renderVil()}
 else{$("vlin").value=b.dataset.vex;$("vlres").innerHTML=vLabel(b.dataset.vex)}
});
/* gépelés közben csak az eredmény frissül, hogy a mező ne veszítse el a fókuszt */
$("sys-vez").addEventListener("input",e=>{
 if(e.target.id==="vkin")$("vkres").innerHTML=vKabelRes(e.target.value);
 else if(e.target.id==="vlin")$("vlres").innerHTML=vLabel(e.target.value);
});

const rowCells=r=>r.c.flat();
function tiriFind(n){for(const t of TI.tiris)for(const r of t.rows)if(rowCells(r).includes(n))return {t,r,kw:r.c.some(c=>Array.isArray(c)&&c.includes(n))?2:5};return null}
function renderLocks(){
 document.querySelectorAll("[data-tlock]").forEach(el=>{el.innerHTML=!LOCK[el.dataset.tlock]()?"":`<p class="sub">${el.dataset.tlock==="patch"?"A beépített patch":"Ez a rész"} jelszóval védett, eszközönként egyszer kell megadni.</p><div class="row"><div><input type="password" data-tpw autocomplete="current-password" placeholder="Jelszó"></div><button class="btn pr a" data-tun>Megnyitás</button></div>`});
}
function renderTiri(){
 renderLocks();
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
 if(!m){R.innerHTML='<p class="sub" style="margin:0">Ilyen áramkör nincs a tirisztorokon (1–256 között keress).</p>';return}
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
  /* a világítási rendszer fájlja később került be, ezért ha még nincs fent, a többi akkor is megnyílik */
  const [t,m,p,v]=await Promise.all(["tiri.enc.json","terkep.enc.json","nagyszinpad.enc.json"].map(f=>encOpen(f,pw)).concat(encOpen("vilagitas.enc.json",pw).catch(e=>{if(e.message==="nincs")return null;throw e})));
  if(v){VIL={v:v.v,d:JSON.parse(v.txt)};localStorage.setItem(VK,JSON.stringify(VIL))}
  TI=JSON.parse(t.txt);localStorage.setItem(TK,t.txt);
  MAP={v:m.v,html:m.txt};localStorage.setItem(MK,JSON.stringify(MAP));
  if(!S.nszSeed)seedPatch(JSON.parse(p.txt));
  renderTiri();renderHk();renderMap();renderVil();
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
if(VIL)encHead("vilagitas.enc.json").then(h=>{if(h.v!==VIL.v){VIL=null;localStorage.removeItem(VK);renderVil()}}).catch(()=>{});

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
