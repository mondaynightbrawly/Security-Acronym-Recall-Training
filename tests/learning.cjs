// Run with Node.js and Playwright installed; start python3 -m http.server 8000 first.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 let count=0;
 const check=async(name,fn)=>{await fn();console.log('PASS '+name);count++};
 const context=await browser.newContext();const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.APP_URL||'http://127.0.0.1:8000');
 const run=fn=>page.evaluate(fn);
 await check('two new batches complete 16 distinct cards each',async()=>{
  for(let batch=0;batch<2;batch++){
   const ids=await run(()=>{start('new');const ids=[];for(let i=0;i<16;i++){if(!current)throw Error('Stopped at '+i);ids.push(current.id);reveal();rate('known')}if(current)throw Error('Session did not finish');return ids});
   assert.equal(new Set(ids).size,16);
  }
  assert.equal(await run(()=>introduced().length),32);
 });
 await check('16 cards complete through visible buttons and keyboard',async()=>{
  await page.click('#newBtn');
  for(let i=0;i<16;i++){
   if(i%2===0){await page.click('#revealBtn');await page.click("#rating button.good")}
   else {await page.locator('h1').click();await page.keyboard.press('Space');await page.keyboard.press('3')}
  }
  assert.equal(await page.locator('#cardstatus').innerText(),'Session complete');
 });
 await check('ratings, intervals, mastery and reset',async()=>{
  const results=await run(()=>{const id=data.terms[0].id;data.progress[id]={};const out=[];for(const r of ['known','known','known','known','known','hesitated','missed']){queue=[id];sessionPos=0;mode='all';next();reveal();rate(r);out.push({...state(id)})}return out});
  assert.deepEqual(results.map(p=>p.streak),[1,2,3,4,5,4,0]);
  const deltas=results.map(p=>Math.round((new Date(p.due+'T12:00:00')-new Date(p.lastDate+'T12:00:00'))/86400000));
  assert.deepEqual(deltas,[1,3,6,10,14,3,1]);assert.equal(results.at(-1).reviews,7);
 });
 await check('due and missed modes complete their snapshot queues',async()=>{
  await run(()=>{for(const t of data.terms.slice(0,3))data.progress[t.id]={seen:true,streak:0,last:'missed',due:localDate(),reviews:1,lastDate:localDate()}});
  for(const kind of ['missed','due']){
   if(kind==='due')await run(()=>{for(const t of data.terms.slice(0,3))data.progress[t.id].due=localDate()});
   const n=await page.evaluate(kind=>{start(kind);const n=queue.length;for(let i=0;i<n;i++){if(!current)throw Error('Early stop');reveal();rate('known')}if(current)throw Error('Not complete');return n},kind);assert.equal(n,3);
  }
 });
 await check('Random drill visits every card once',async()=>{
  const ids=await run(()=>{start('all');const ids=[];while(current){ids.push(current.id);reveal();rate('hesitated')}return ids});
  assert.equal(ids.length,await run(()=>data.terms.length));assert.equal(new Set(ids).size,ids.length);
 });
 await check('all three directions reveal and domain hints',async()=>{
  for(const dir of ['term','meaning','scenario']){
   await page.selectOption('#direction',dir);await run(()=>start('all'));
   const result=await run(()=>{showHint();const hint=$('domainhint').textContent;const front=$('front').textContent;const expected=$('direction').value==='term'?current.id:$('direction').value==='meaning'?current.exp:current.why;reveal();return {hint,front,expected,back:$('back').textContent,answer:$('direction').value==='term'?current.exp:current.id}});
   assert.equal(result.front,result.expected);assert.equal(result.back,result.answer);assert.match(result.hint,/Domain [1-5]: .+Topic:/);
  }
  assert.equal(await run(()=>initials('Authentication Accounting 256')), 'A_____________ A_________ 2__');
  await run(()=>{for(const cat of new Set(data.terms.map(t=>t.cat)))if(!domainInfo[cat])throw Error('Missing domain '+cat)});
 });
 await check('reload persists progress; another browser context is isolated',async()=>{
  await run(()=>save());const n=await run(()=>introduced().length);await page.reload();assert.equal(await run(()=>introduced().length),n);
  const other=await browser.newContext();const p=await other.newPage();await p.goto('http://127.0.0.1:8000');assert.equal(await p.evaluate(()=>introduced().length),0);await other.close();
 });
 await check('blocked storage still completes all 16 and warns',async()=>{
  await run(()=>{data={terms:starter,progress:{},history:[]};Storage.prototype.setItem=()=>{throw new DOMException('Quota exceeded','QuotaExceededError')};start('new');for(let i=0;i<16;i++){if(!current)throw Error('Stopped at '+i);reveal();rate('known')}if(current)throw Error('Not complete')});
  assert.match(await page.locator('#storagewarning').innerText(),/cannot be saved/);assert.equal(await run(()=>introduced().length),16);
 });
 await check('case-insensitive deck update preserves progress',async()=>{
  assert.equal(await run(()=>{const id=data.terms[0].id;merge([{...data.terms[0],id:id.toLowerCase()}]);return state(id).reviews}),1);
 });
 await check('malformed imports are atomic; reserved IDs rejected; HTML escaped',async()=>{
  await run(()=>{const n=data.terms.length;for(const rows of [[{id:'valid',exp:'Valid'},null],[{id:'__proto__',exp:'x'}],[{id:'X',exp:'x'},{id:'x',exp:'x'}]]){let rejected=false;try{merge(rows)}catch{rejected=true}if(!rejected||data.terms.length!==n)throw Error('Unsafe import')}
   merge([{id:'<img src=x onerror=alert(1)>',exp:'<script>bad</script>',why:'<b>test</b>',cat:'Other'}]);library();if($('library').querySelector('img,script,b'))throw Error('HTML injection');
  });
 });
 await check('restore clears a stale active session',async()=>{
  const backup=await run(()=>{storageProblem='';start('all');return JSON.stringify({terms:starter.slice(0,2),progress:{},history:[]})});
  page.on('dialog',d=>d.accept());await page.locator('#backup').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(backup)});
  await page.waitForFunction(()=>data.terms.length===2);assert.equal(await run(()=>current),null);
  await run(()=>{start('new');for(let i=0;i<2;i++){reveal();rate('known')}if(current)throw Error('Final partial batch failed');start('new');if(current)throw Error('Exhausted deck not empty')});
 });
 await check('corrupt and unavailable storage boot safely without overwriting',async()=>{
  for(const blocked of [false,true]){
   const c=await browser.newContext();await c.addInitScript(blocked=>{
    if(blocked)Storage.prototype.getItem=()=>{throw new DOMException('Blocked','SecurityError')};
    else localStorage.setItem('security-recall-lab-v1','{"terms":[]}');
   },blocked);
   const p=await c.newPage();await p.goto('http://127.0.0.1:8000');
   assert.match(await p.locator('#storagewarning').innerText(),/could not be loaded/);
   await p.evaluate(()=>{start('new');reveal();rate('known')});
   assert.equal(await p.evaluate(()=>introduced().length),1);
   if(!blocked)assert.equal(await p.evaluate(()=>localStorage.getItem(KEY)),'{"terms":[]}');
   await c.close();
  }
 });
 await check('no uncaught browser errors',async()=>assert.deepEqual(errors,[]));
 console.log(`${count} checks passed`);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
