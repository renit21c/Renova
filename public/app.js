const userStorageId=window.RENOVA_CONFIG?.userId||'anonymous';
const STORE=`renova-v1:${userStorageId}`, LEGACY_STORE=`life-os-v1:${userStorageId}`;
let today=new Date(); const iso=value=>{let d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}; let now=iso(today);
const googleConfig=window.RENOVA_CONFIG||{};
const googleSessionKey=`renova-google-calendar-session:${userStorageId}`;
const googleEmailKey=`renova-google-calendar-email:${userStorageId}`;
let googleEvents=[],googleCalendarFetchKey='',googleCalendarBusy=false,googleCalendarError='';
const legacyGoogleToken=window.sessionStorage.getItem(googleSessionKey),legacyGoogleEmail=window.sessionStorage.getItem(googleEmailKey);let googleCalendarToken=localStorage.getItem(googleSessionKey)||legacyGoogleToken||'';if(legacyGoogleToken&&!localStorage.getItem(googleSessionKey))localStorage.setItem(googleSessionKey,legacyGoogleToken);if(legacyGoogleEmail&&!localStorage.getItem(googleEmailKey))localStorage.setItem(googleEmailKey,legacyGoogleEmail);window.sessionStorage.removeItem(googleSessionKey);window.sessionStorage.removeItem(googleEmailKey);
const seed={profile:{name:'',nickname:'',birthDate:'',bio:'',timezone:'Asia/Jakarta',currency:'IDR'},theme:'light',tasks:[],events:[],accounts:[],transactions:[],goals:[],journal:[],projects:[],investments:[],focus:'',demo:false};
const storedData=localStorage.getItem(STORE),existing=JSON.parse(storedData||localStorage.getItem(LEGACY_STORE)||'null');
let state={...seed,...existing,profile:{...seed.profile,...existing?.profile},projects:existing?.projects||[],investments:existing?.investments||[]}; if(!storedData&&existing)localStorage.setItem(STORE,JSON.stringify(state)); let route=location.hash.slice(1)||'home';
const nav=[['home','Home','home'],['calendar','Calendar','calendar'],['tasks','Tasks','check'],['projects','Projects','folder'],['goals','Goals','target'],['finance','Finance','wallet'],['investments','Investments','chart'],['journey','My Journey','sparkle'],['journal','Journal','book'],['settings','Settings','settings']];
function icon(name){const paths={home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-6h-4v6H4a1 1 0 0 1-1-1z"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',check:'<path d="m5 12 4 4L19 6"/>',folder:'<path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',wallet:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 15h2"/>',chart:'<path d="M4 19V5m0 14h17"/><path d="m7 15 4-4 3 2 6-7"/>',sparkle:'<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/><path d="m19 14 1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1z"/>',book:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M4 5.5v14A2.5 2.5 0 0 1 6.5 17H20"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1a1.7 1.7 0 1 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 1 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 1 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V4a1.7 1.7 0 1 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 1 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2.9z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',moon:'<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13z"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',plus:'<path d="M12 5v14M5 12h14"/>',event:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>'};return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.sparkle}</svg>`}
function save(...args) { return featureSave(...args); }
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function money(n){return new Intl.NumberFormat('id-ID',{style:'currency',currency:state.profile.currency||'IDR',minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(n||0));}
function dateLabel(d){return new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date(d+'T12:00:00'));}
function toast(msg){const t=document.querySelector('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function setRoute(r){route=r;location.hash=r;render();} function renderNav(){document.querySelector('#nav').innerHTML=nav.map((x,i)=>`${i===0||i===5||i===8?'<div class="nav-group">'+(i?`<div class="nav-label">${i===5?'Money':'Personal'}</div>`:''):''}<a class="nav-link ${route===x[0]?'active':''}" href="#${x[0]}"><span class="nav-icon">${icon(x[2])}</span>${x[1]}</a>${[4,7,9].includes(i)?'</div>':''}`).join('')}
function heading(title,sub,action=''){return `<div class="page-heading"><div><div class="eyebrow">Renova</div><h1>${title}</h1><p>${sub}</p></div>${action}</div>`}
function greeting(){let h=Number(new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hourCycle:'h23',timeZone:state.profile.timezone}).format(new Date()));return h<12?'Good morning':h<18?'Good afternoon':'Good evening'}
function age(){if(!state.profile.birthDate)return '';let b=new Date(state.profile.birthDate),n=new Date();let y=n.getFullYear()-b.getFullYear();if(n<new Date(n.getFullYear(),b.getMonth(),b.getDate()))y--;return y}

function home(...args) { return featureHome(...args); }


let calendarOffset=0;
function googleCalendarReady(){return Boolean(googleConfig.googleCalendarEnabled&&googleConfig.supabaseUrl&&googleConfig.supabaseAnonKey&&/^https:\/\//.test(googleConfig.supabaseUrl))}
function googleCalendarSetupMessage(){return googleConfig.supabaseUrl&&googleConfig.supabaseAnonKey?'Google Calendar sync is not deployed yet. Deploy the Supabase Edge Function, then set NEXT_PUBLIC_GOOGLE_CALENDAR_ENABLED=true in .env.local.':'Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local first.'}
function googleCalendarFunction(action,query=''){return `${googleConfig.supabaseUrl.replace(/\/$/,'')}/functions/v1/google-calendar?action=${encodeURIComponent(action)}${query?`&${query}`:''}`}
function calendarEvents(){let rangeStart,rangeEnd;if(route==='calendar'){rangeStart=calendarWeekStart();rangeEnd=new Date(rangeStart.getFullYear(),rangeStart.getMonth(),rangeStart.getDate()+6)}else{rangeStart=new Date(today.getFullYear(),today.getMonth(),today.getDate());rangeEnd=new Date(rangeStart.getFullYear(),rangeStart.getMonth(),rangeStart.getDate()+90)}const start=iso(rangeStart),end=iso(rangeEnd);return [...state.events.flatMap(event=>localEventOccurrences(event,start,end)),...googleEvents]}
function safeHttpUrl(value=''){try{const url=new URL(value);return url.protocol==='http:'||url.protocol==='https:'?url.href:''}catch{return ''}}
function localEventOccurrences(event,start,end){if(!event.date)return[];const base=new Date(`${event.date}T12:00:00`),from=new Date(`${start}T12:00:00`),through=new Date(`${end}T12:00:00`);if(!Number.isFinite(base.getTime())||!Number.isFinite(from.getTime())||!Number.isFinite(through.getTime()))return[];const mode=event.repeatMode||'once',repeatUntil=mode==='until'&&event.repeatUntil?new Date(`${event.repeatUntil}T12:00:00`):null;let cursor=new Date(Math.max(base.getTime(),from.getTime()));const occurrences=[];for(;cursor<=through&&(!repeatUntil||cursor<=repeatUntil);cursor.setDate(cursor.getDate()+1)){const days=Math.round((cursor-base)/86400000),matches=mode==='forever'||mode==='until'?event.repeatFrequency==='daily'||(event.repeatFrequency==='weekly'&&days%7===0)||(event.repeatFrequency==='monthly'&&cursor.getDate()===base.getDate()&&(cursor.getMonth()+12*cursor.getFullYear()-(base.getMonth()+12*base.getFullYear()))>=0):days===0;if(matches)occurrences.push({...event,date:iso(cursor)})}return occurrences}
async function googleCalendarRequest(action,options={},requiresSession=true,query=''){if(!googleCalendarReady())throw new Error('Supabase is not configured in .env.local.');let headers={'Content-Type':'application/json','apikey':googleConfig.supabaseAnonKey};if(requiresSession&&googleCalendarToken)headers.Authorization=`Bearer ${googleCalendarToken}`;let response=await fetch(googleCalendarFunction(action,query),{...options,headers:{...headers,...options.headers}}),result=await response.json().catch(()=>({}));if(!response.ok){let message=response.status===404?'Google Calendar Edge Function belum ditemukan di Supabase. Deploy function google-calendar terlebih dahulu.':result.error||`Google Calendar request failed (${response.status}).`;let error=new Error(message);error.status=response.status;throw error}return result}
function googleEventDateTime(event){return event.start?.dateTime ? RenovaCore.zonedParts(event.start.dateTime,state.profile.timezone) : {date:event.start?.date||'',time:''};}
function mapGoogleEvent(event){let start=googleEventDateTime(event),endTime=event.end?.dateTime?RenovaCore.zonedParts(event.end.dateTime,state.profile.timezone).time:'',repeat=googleEventRepeatValues(event);return{id:event.id,googleId:event.id,title:event.summary||'(No title)',date:start.date,time:start.time,endTime,location:event.location||'',description:event.description||'',...repeat,source:'google',googleRaw:event}}
function calendarWeekStart(offset=calendarOffset){let start=new Date(today.getFullYear(),today.getMonth(),today.getDate());start.setDate(start.getDate()-start.getDay()+offset*7);return start}
function calendarRange(){let start,end;if(route==='calendar'){start=calendarWeekStart();end=new Date(start.getFullYear(),start.getMonth(),start.getDate()+7)}else{start=new Date(today.getFullYear(),today.getMonth(),today.getDate());end=new Date(start.getFullYear(),start.getMonth(),start.getDate()+90)}return{start:start.toISOString(),end:end.toISOString()}}
async function refreshGoogleCalendar(force=false){if(!googleCalendarToken||!googleCalendarReady()||!['calendar','home'].includes(route))return;let range=calendarRange(),key=`${route}:${range.start}:${range.end}`;if(googleCalendarBusy||(!force&&googleCalendarFetchKey===key))return;googleCalendarBusy=true;googleCalendarFetchKey=key;googleCalendarError='';try{let query=`timeMin=${encodeURIComponent(range.start)}&timeMax=${encodeURIComponent(range.end)}`,result=await googleCalendarRequest('events',{},true,query);googleEvents=(result.events||[]).map(mapGoogleEvent);googleCalendarError=''}catch(error){googleCalendarError=error.message;if(error.status===401){googleCalendarToken='';localStorage.removeItem(googleSessionKey);window.sessionStorage.removeItem(googleSessionKey);localStorage.removeItem(googleEmailKey);window.sessionStorage.removeItem(googleEmailKey);googleEvents=[]}toast(error.message)}finally{googleCalendarBusy=false;if(['calendar','home'].includes(route))render()}}
function connectGoogleCalendar(){if(!googleCalendarReady()){toast(googleCalendarSetupMessage());return}location.href=googleCalendarFunction('connect')}
async function disconnectGoogleCalendar(){if(!confirm('Disconnect Google Calendar from Renova? This will not delete events in Google.'))return;try{await googleCalendarRequest('disconnect',{method:'DELETE'});googleCalendarToken='';googleEvents=[];googleCalendarFetchKey='';localStorage.removeItem(googleSessionKey);window.sessionStorage.removeItem(googleSessionKey);localStorage.removeItem(googleEmailKey);window.sessionStorage.removeItem(googleEmailKey);render();toast('Google Calendar disconnected')}catch(error){toast(error.message)}}
async function completeGoogleOAuth(){let params=new URLSearchParams(location.search),ticket=params.get('gcal_ticket'),error=params.get('gcal_error');if(!ticket&&!error)return;history.replaceState(null,'',`${location.pathname}${location.hash||'#calendar'}`);if(error){toast(error);return}try{let result=await googleCalendarRequest('exchange',{method:'POST',body:JSON.stringify({ticket})},false);googleCalendarToken=result.token;localStorage.setItem(googleSessionKey,result.token);localStorage.setItem(googleEmailKey,result.email);googleCalendarFetchKey='';route='calendar';location.hash='calendar';render();toast(`Connected Google Calendar for ${result.email}`);refreshGoogleCalendar(true)}catch(exchangeError){toast(exchangeError.message)}}
function googleCalendarPanel(){if(!googleCalendarReady())return `<section class="integration"><strong>Google Calendar</strong><p>${esc(googleCalendarSetupMessage())}</p><button class="secondary-button" disabled>Sync not available yet</button></section>`;if(!googleCalendarToken)return '<section class="integration"><strong>Google Calendar</strong><p>Connect your Google account to view, create, edit, and delete events in Renova.</p><button class="secondary-button" onclick="connectGoogleCalendar()">Connect Google Calendar</button></section>';let email=localStorage.getItem(googleEmailKey)||'Connected account';return `<section class="integration"><strong>Google Calendar</strong><p>Connected as ${esc(email)}. Changes made here are saved to Google Calendar.</p><div class="calendar-actions"><button class="secondary-button" onclick="refreshGoogleCalendar(true)">Sync now</button><button class="text-button" onclick="disconnectGoogleCalendar()">Disconnect</button></div>${googleCalendarBusy?'<small class="muted">Syncing…</small>':''}${googleCalendarError?`<small class="error">${esc(googleCalendarError)}</small>`:''}</section>`}
function calendar(){
let weekStart=calendarWeekStart(),weekEnd=new Date(weekStart.getFullYear(),weekStart.getMonth(),weekStart.getDate()+6),events=calendarEvents(),weekEvents=events.filter(e=>e.date>=iso(weekStart)&&e.date<=iso(weekEnd)).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||'')),days='';
for(let i=0;i<7;i++){let day=new Date(weekStart.getFullYear(),weekStart.getMonth(),weekStart.getDate()+i),key=iso(day),dayEvents=weekEvents.filter(e=>e.date===key),isToday=key===now;days+=`<article class="week-day ${isToday?'today':''} ${dayEvents.length?'has-events':''}"><button class="week-day-date" onclick="openEvent('${key}')" aria-label="Add event on ${key}"><span class="week-day-name">${day.toLocaleDateString(undefined,{weekday:'short'})}</span><span class="week-day-number">${day.getDate()}</span></button><div class="week-day-events">${dayEvents.map(e=>`<div class="week-event ${e.source==='google'?'google-event':'local-event'}" title="${esc(e.title)}${e.time?' · '+esc(e.time):''}" role="button" tabindex="0" onclick="${e.source==='google'?`openGoogleEvent('${encodeURIComponent(e.googleId)}')`:`openEvent('${e.date}','${e.id}')`}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}"><span class="week-event-time">${e.time?esc(e.time):'All day'}</span><span class="week-event-dot ${e.source==='google'?'google':''}"></span><span class="week-event-title">${esc(e.title)}</span><span class="week-event-source">${e.source==='google'?'Google':'Renova'}</span></div>`).join('')||'<span class="week-empty">No events</span>'}</div><button class="week-add" onclick="openEvent('${key}')" aria-label="Add event on ${key}">+</button></article>`}
let rangeLabel=weekStart.getMonth()===weekEnd.getMonth()?`${weekStart.toLocaleDateString(undefined,{month:'long'})} ${weekStart.getDate()}–${weekEnd.getDate()}, ${weekEnd.getFullYear()}`:`${weekStart.toLocaleDateString(undefined,{month:'short',day:'numeric'})} – ${weekEnd.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}`;
return heading('Calendar','A clear view of this week’s plans.',`<button class="primary-button" onclick="openEvent()">＋ New event</button>`)+`<div class="calendar-layout"><section class="panel week-panel"><div class="calendar-toolbar"><button class="secondary-button week-nav-button" onclick="changeCalendarWeek(-1)" aria-label="Previous week">‹</button><div class="week-heading"><h2>${rangeLabel}</h2><span>${weekEvents.length} ${weekEvents.length===1?'event':'events'}</span></div><button class="secondary-button week-nav-button" onclick="changeCalendarWeek(1)" aria-label="Next week">›</button><button class="text-button calendar-today" onclick="calendarOffset=0;googleCalendarFetchKey='';render()">This week</button></div><div class="week-days">${days}</div></section><aside class="section-stack calendar-sidebar">${googleCalendarPanel()}<section class="panel week-upcoming"><div class="panel-title"><h2>This week</h2></div>${weekEvents.map(e=>`<div class="list-row"><span class="event-dot ${e.source==='google'?'google-dot':''}"></span><div class="event-info"><b>${esc(e.title)}</b><small>${new Date(e.date+'T12:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})} · ${e.time||'All day'} · ${e.source==='google'?'Google Calendar':'Renova'}</small></div>${e.source==='google'?`<button class="text-button" onclick="openGoogleEvent('${encodeURIComponent(e.googleId)}')">Edit</button>`:''}</div>`).join('')||'<div class="empty">Nothing scheduled this week.</div>'}</section></aside></div>`
}
function changeCalendarWeek(delta){calendarOffset+=delta;googleCalendarFetchKey='';render()}
function balance(){return state.accounts.reduce((n,a)=>n+Number(a.initial||0),0)+state.transactions.reduce((n,t)=>n+(t.type==='Income'?Number(t.amount):t.type==='Expense'?-Number(t.amount):0),0)}function monthTotals(){let prefix=now.slice(0,7),x=state.transactions.filter(t=>t.date?.startsWith(prefix));return{income:x.filter(t=>t.type==='Income').reduce((n,t)=>n+Number(t.amount),0),expense:x.filter(t=>t.type==='Expense').reduce((n,t)=>n+Number(t.amount),0)}}
function spendingTrend(){let months=Array.from({length:6},(_,i)=>new Date(today.getFullYear(),today.getMonth()-5+i,1)),values=months.map(d=>{let key=iso(d).slice(0,7);return state.transactions.filter(t=>t.type==='Expense'&&t.date?.startsWith(key)).reduce((sum,t)=>sum+Number(t.amount||0),0)}),max=Math.max(...values,0);return `<div class="chart">${months.map((d,i)=>{let height=max?Math.max(8,values[i]/max*100):0;return `<div class="bar" style="height:${height}%" data-label="${d.toLocaleDateString(undefined,{month:'short'})}" title="${money(values[i])}"></div>`}).join('')}</div><p class="muted" style="font-size:12px;margin:22px 0 0">Recorded expenses for the last six months.</p>`}

function goals(){return heading('Goals','Direction, without turning life into a scoreboard.',`<button class="primary-button" onclick="openGoal()">＋ New goal</button>`)+`<section class="panel">${state.goals.map(g=>`<div class="goal-card"><div class="panel-title"><h2>${esc(g.title)}</h2><button class="text-button" onclick="editGoal('${g.id}')">Update</button></div><div class="muted">${esc(g.description||'A personal goal')}</div><div class="progress"><span style="width:${Math.min(100,g.current/g.target*100||0)}%"></span></div><small><span>${money(g.current)} of ${money(g.target)}</span><span>${g.targetDate?'Target '+g.targetDate:''}</span></small></div>`).join('')||'<div class="empty">Set a goal you’d like to make real.</div>'}</section>`}
function journal(...args) { return featureJournal(...args); }



function deleteProject(id){if(!confirm('Delete this project? Linked tasks will be kept without a project.'))return;let old=state.projects.find(p=>p.id===id);checkpoint('delete project');state.projects=state.projects.filter(p=>p.id!==id);if(old)state.tasks.forEach(t=>{if(t.project===old.name)t.project=''});save();closeModal();render();toast('Project deleted')}
function investments(){let holdings=state.investments.map(x=>{let value=Number(x.units||0)*Number(x.currentPrice||0),basis=Number(x.units||0)*Number(x.buyPrice||0);return {...x,value,basis,change:value-basis}}),total=holdings.reduce((n,x)=>n+x.value,0),cost=holdings.reduce((n,x)=>n+x.basis,0),allocation=holdings.filter(x=>x.value>0).sort((a,b)=>b.value-a.value),allocationTotal=allocation.reduce((n,x)=>n+x.value,0),colors=['#007aff','#30a46c','#e69b16','#e5484d','#8e5ad7','#14a8a1','#f07835','#718096'];let offset=0,gradient=allocation.map((x,i)=>{let start=offset;offset+=x.value/allocationTotal*100;return `${colors[i%colors.length]} ${start}% ${offset}%`}).join(', '),largestChange=Math.max(0,...holdings.map(x=>Math.abs(x.change)));return heading('Investments','Track holdings and see how your portfolio is distributed.',`<button class="primary-button" onclick="openInvestment()">＋ Add holding</button>`)+`<div class="section-stack"><section class="panel"><div class="snapshot"><div class="metric"><div class="value">${money(total)}</div><div class="label">Estimated value</div></div><div class="metric"><div class="value">${money(total-cost)}</div><div class="label">Unrealized change</div></div></div></section><div class="investment-charts"><section class="panel"><div class="panel-title"><h2>Portfolio allocation</h2><span class="status">By current value</span></div>${allocation.length?`<div class="donut-layout"><div class="donut-chart" role="img" aria-label="Portfolio allocation by holding" style="background:conic-gradient(${gradient})"><div class="donut-center"><span>Portfolio</span><strong>${money(total)}</strong></div></div><div class="donut-legend">${allocation.map((x,i)=>`<div class="donut-legend-row"><span class="donut-swatch" style="background:${colors[i%colors.length]}"></span><span class="donut-category">${esc(x.name)}${x.symbol?` (${esc(x.symbol)})`:''}</span><b>${(x.value/allocationTotal*100).toFixed(1)}%</b></div>`).join('')}</div></div>`:'<div class="empty">Add a holding with a current price to see your allocation.</div>'}</section><section class="panel"><div class="panel-title"><h2>Unrealized gain / loss</h2><span class="status">By holding</span></div>${holdings.length?`<div class="investment-performance">${holdings.map(x=>`<div class="investment-performance-row"><div class="investment-performance-label"><span>${esc(x.name)}${x.symbol?` <small>${esc(x.symbol)}</small>`:''}</span><b class="${x.change>=0?'income':'expense'}">${x.change>=0?'+':''}${money(x.change)}</b></div><div class="investment-performance-track"><span class="${x.change>=0?'positive':'negative'}" style="width:${largestChange?Math.abs(x.change)/largestChange*100:0}%"></span></div></div>`).join('')}</div>`:'<div class="empty">Add a holding to see unrealized gain or loss.</div>'}</section></div><section class="panel">${holdings.map(x=>`<div class="list-row"><div class="event-info"><b>${esc(x.name)} <span class="status">${esc(x.symbol||'')}</span></b><small>${esc(x.units)} units · Cost ${money(x.basis)} · Updated ${esc(x.updated||'')}</small></div><div class="investment-value"><b>${money(x.value)}</b><small class="${x.change>=0?'income':'expense'}">${x.change>=0?'+':''}${money(x.change)}</small></div><button class="text-button" onclick="openInvestment('${x.id}')">Edit</button></div>`).join('')||'<div class="empty">Add a holding to start tracking a manually valued portfolio.</div>'}</section><p class="muted module-note">Charts use the prices currently saved for each holding. Renova does not yet fetch live market data.</p></div>`}
function openInvestment(id=''){let x=state.investments.find(y=>y.id===id)||{};modal(`<h2>${id?'Edit':'Add'} holding</h2><form onsubmit="saveInvestment(event,'${id}')"><div class="form-grid"><div class="field full"><label>Asset name</label><input name="name" required value="${esc(x.name)}" placeholder="Company, fund, or asset"></div><div class="field"><label>Symbol (optional)</label><input name="symbol" value="${esc(x.symbol)}" placeholder="e.g. IDX:BBCA"></div><div class="field"><label>Units</label><input name="units" type="number" min="0" step="any" required value="${x.units||''}"></div><div class="field"><label>Average buy price</label><input name="buyPrice" type="number" min="0" step="any" required value="${x.buyPrice||''}"></div><div class="field"><label>Current price (manual)</label><input name="currentPrice" type="number" min="0" step="any" required value="${x.currentPrice||''}"></div></div><div class="modal-actions">${id?`<button type="button" class="text-button danger-button" onclick="deleteInvestment('${id}')">Delete</button>`:''}<button type="button" class="secondary-button" onclick="closeModal()">Cancel</button><button class="primary-button">Save holding</button></div></form>`)}
function saveInvestment(e,id){e.preventDefault();let value={...Object.fromEntries(new FormData(e.target)),id:id||crypto.randomUUID(),updated:now},old=state.investments.find(x=>x.id===id);old?Object.assign(old,value):state.investments.push(value);save();closeModal();render();toast('Holding saved')}
function deleteInvestment(id){if(!confirm('Delete this holding?'))return;checkpoint('delete investment');state.investments=state.investments.filter(x=>x.id!==id);save();closeModal();render();toast('Holding deleted')}
function journey(){let items=[...state.tasks.filter(t=>t.status==='Completed').map(t=>({date:t.completed||t.due||now,type:'Task completed',title:t.title})),...state.events.map(e=>({date:e.date,type:'Calendar event',title:e.title})),...state.goals.filter(g=>g.targetDate).map(g=>({date:g.targetDate,type:'Goal target',title:g.title})),...state.journal.map(j=>({date:j.date,type:'Journal',title:j.title||j.body}))].filter(x=>x.date).sort((a,b)=>b.date.localeCompare(a.date));return heading('My Journey','A timeline of the steps, plans, and moments you have recorded.')+`<section class="panel">${items.map(x=>`<article class="journey-item"><div class="journey-marker"></div><div><span class="status">${esc(x.type)}</span><div class="journey-title">${esc(x.title)}</div><small class="muted">${esc(x.date)}</small></div></article>`).join('')||'<div class="empty">Your timeline will grow as you complete tasks, add events, set goals, and write journal entries.</div>'}</section>`}
function settings(){let p=state.profile;return heading('Settings','Shape Renova around you. Preferences are saved to your private cloud workspace.')+`<div class="content-grid"><section class="panel"><form onsubmit="saveProfile(event)"><div class="panel-title"><h2>Personal profile</h2><span class="status">${p.birthDate?age()+' years old':'Incomplete'}</span></div><div class="form-grid"><div class="field"><label>Name</label><input name="name" value="${esc(p.name)}" placeholder="Your full name"></div><div class="field"><label>Preferred name</label><input name="nickname" value="${esc(p.nickname)}" placeholder="What should Renova call you?"></div><div class="field"><label>Date of birth</label><input name="birthDate" type="date" value="${p.birthDate}"></div><div class="field"><label>Timezone</label><input name="timezone" value="${esc(p.timezone)}"></div><div class="field full"><label>Personal bio</label><textarea name="bio" placeholder="A little about you">${esc(p.bio)}</textarea></div></div><div class="modal-actions"><button class="primary-button">Save profile</button></div></form></section><aside class="section-stack"><section class="panel"><div class="panel-title"><h2>Appearance</h2></div><p class="muted">Choose a comfortable environment for your day.</p><button class="secondary-button" onclick="toggleTheme()">Toggle light / dark</button></section><section class="integration"><strong>Data & privacy</strong><p>Your workspace is saved to Supabase and synced when you sign in. Export a backup before making major changes.</p><button class="secondary-button" onclick="exportData()">Export my data</button></section></aside></div>`}
function mountTradingViewWidget(){let stack=document.querySelector('#page .section-stack');if(!stack)return;let dark=state.theme==='dark',panel=document.createElement('section');panel.className='panel tradingview-panel';panel.innerHTML='<div class="panel-title"><div><h2>Market overview</h2><p class="muted tradingview-caption">IDX Composite, BBCA, and Gold · TradingView</p></div><span class="status">Market chart</span></div><div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div><div class="tradingview-widget-copyright"><a href="https://www.tradingview.com/markets/" rel="noopener nofollow" target="_blank">World markets</a><span> by TradingView</span></div></div>';let config={lineWidth:2,lineType:0,chartType:'area',fontColor:dark?'#a1a1aa':'#6e6e73',gridLineColor:dark?'rgba(255,255,255,0.07)':'rgba(29,29,31,0.07)',volumeUpColor:'rgba(48,164,108,0.35)',volumeDownColor:'rgba(229,72,77,0.35)',backgroundColor:dark?'#232326':'#ffffff',widgetFontColor:dark?'#f5f5f7':'#1d1d1f',upColor:'#30a46c',downColor:'#e5484d',borderUpColor:'#30a46c',borderDownColor:'#e5484d',wickUpColor:'#30a46c',wickDownColor:'#e5484d',colorTheme:dark?'dark':'light',isTransparent:false,locale:'en',chartOnly:false,scalePosition:'right',scaleMode:'Normal',fontFamily:'-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',valuesTracking:'1',changeMode:'price-and-percent',symbols:[['IDX:COMPOSITE|1D'],['IDX:BBCA|1M'],['TVC:GOLD|3M']],dateRanges:['1d|1','1m|30','3m|60','12m|1D','60m|1W','all|1M'],fontSize:'10',headerFontSize:'medium',autosize:true,width:'100%',height:'100%',noTimeScale:false,hideDateRanges:false,hideMarketStatus:false,hideSymbolLogo:false};let script=document.createElement('script');script.type='text/javascript';script.src='https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';script.async=true;script.textContent=JSON.stringify(config);panel.querySelector('.tradingview-widget-container__widget').appendChild(script);stack.insertBefore(panel,stack.children[1]||null)}
function render(){rememberView();now=workspaceDate();today=new Date(now+'T12:00:00');document.body.classList.toggle('dark',state.theme==='dark');document.querySelector('#themeButton').innerHTML=icon(state.theme==='dark'?'sun':'moon');document.querySelector('#themeButton').title=state.theme==='dark'?'Switch to light mode':'Switch to dark mode';document.querySelector('#mobileMenu').innerHTML=icon('menu');document.querySelector('#searchButton .search-icon').innerHTML=icon('search');document.querySelector('#quickButton .button-icon').innerHTML=icon('plus');renderNav();let pages={home,tasks,calendar,finance,goals,journal,settings,projects,investments,journey};document.querySelector('#page').innerHTML=(pages[route]||home)();if(route==='investments'){mountTradingViewWidget();let widgetScript=document.querySelector('.tradingview-widget-container__widget script'),widgetContainer=document.querySelector('#page .tradingview-widget-container');if(widgetScript&&widgetContainer)widgetContainer.appendChild(widgetScript);}afterWorkspaceRender();refreshGoogleCalendar();}
function modal(...args) { return featureModal(...args); }
function openQuick(){modal(`<h2>Create something</h2><div class="quick-list"><button class="quick-option" onclick="closeModal();openTask()">${icon('check')} Task</button><button class="quick-option" onclick="closeModal();openEvent()">${icon('calendar')} Calendar event</button><button class="quick-option" onclick="closeModal();openTransaction()">${icon('wallet')} Expense or income</button><button class="quick-option" onclick="closeModal();openJournal()">${icon('book')} Journal entry</button><button class="quick-option" onclick="closeModal();openGoal()">${icon('target')} Goal</button><button class="quick-option" onclick="closeModal();openProject()">${icon('folder')} Project</button><button class="quick-option" onclick="closeModal();openInvestment()">${icon('chart')} Investment holding</button></div>`)}

function editTask(id){openTask(id)}

function googleEventRepeatValues(event){const rule=event.recurrence?.find(value=>value.startsWith('RRULE:'))||'',frequency=rule.match(/FREQ=(DAILY|WEEKLY|MONTHLY)/)?.[1]?.toLowerCase()||'weekly',untilValue=rule.match(/UNTIL=(\d{8})/)?.[1]||'',repeatUntil=untilValue?`${untilValue.slice(0,4)}-${untilValue.slice(4,6)}-${untilValue.slice(6,8)}`:'',repeatMode=rule?(repeatUntil?'until':'forever'):'once';return{repeatMode,repeatFrequency:frequency,repeatUntil}}
function openGoogleEvent(encodedId){let id=decodeURIComponent(encodedId),event=googleEvents.find(item=>item.googleId===id);if(!event){toast('That Google Calendar event is no longer loaded. Sync and try again.');return}const repeatMode=event.repeatMode||'once';modal(`<h2>Edit Google Calendar event</h2><form onsubmit="saveGoogleEvent(event,'${encodeURIComponent(id)}')"><div class="form-grid"><div class="field full"><label>Title</label><input name="title" required value="${esc(event.title)}"></div><div class="field"><label>Date</label><input name="date" type="date" value="${esc(event.date)}" required></div><div class="field"><label>Start time</label><input name="time" type="time" value="${esc(event.time)}"></div><div class="field"><label>End time</label><input name="endTime" type="time" value="${esc(event.endTime)}"></div><div class="field full"><label>Location or link</label><input name="location" value="${esc(event.location)}" placeholder="Optional"></div><div class="field full"><label>Description</label><textarea name="description">${esc(event.description)}</textarea></div><div class="field"><label>Repeat</label><select id="eventRepeatMode" name="repeatMode" onchange="toggleEventRepeatFields()"><option value="once" ${repeatMode==='once'?'selected':''}>Does not repeat</option><option value="until" ${repeatMode==='until'?'selected':''}>Repeat until a date</option><option value="forever" ${repeatMode==='forever'?'selected':''}>Repeat forever</option></select></div><div class="field" id="eventRepeatFrequencyField"><label>Repeat frequency</label><select name="repeatFrequency"><option value="daily" ${event.repeatFrequency==='daily'?'selected':''}>Daily</option><option value="weekly" ${!event.repeatFrequency||event.repeatFrequency==='weekly'?'selected':''}>Weekly</option><option value="monthly" ${event.repeatFrequency==='monthly'?'selected':''}>Monthly</option></select></div><div class="field" id="eventRepeatUntilField"><label>Repeat until</label><input name="repeatUntil" type="date" value="${esc(event.repeatUntil||'')}"></div></div><div class="modal-actions"><button type="button" class="text-button" onclick="deleteGoogleEvent('${encodeURIComponent(id)}')">Delete event</button><button type="button" class="secondary-button" onclick="closeModal()">Cancel</button><button class="primary-button">Save to Google</button></div></form>`);toggleEventRepeatFields()}
function googleEventPayload(values,existing){
  const payload={summary:values.title.trim(),location:values.location||'',description:values.description||''};
  const timeZone=state.profile.timezone||'Asia/Jakarta';
  if(values.time){
    const start=new Date(RenovaCore.zonedISO(values.date,values.time,timeZone));
    const duration=existing?.start?.dateTime&&existing?.end?.dateTime?Math.max(60_000,new Date(existing.end.dateTime)-new Date(existing.start.dateTime)):3_600_000;
    const end=values.endTime?new Date(RenovaCore.zonedISO(values.date,values.endTime,timeZone)):new Date(start.getTime()+duration);
    payload.start={dateTime:start.toISOString(),timeZone};payload.end={dateTime:end.toISOString(),timeZone};
  }else{
    const days=existing?.start?.date&&existing?.end?.date?Math.max(1,Math.round((new Date(existing.end.date)-new Date(existing.start.date))/86400000)):1;
    const end=new Date(values.date+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+days);
    payload.start={date:values.date};payload.end={date:end.toISOString().slice(0,10)};
  }
  if(values.repeatMode==='until'||values.repeatMode==='forever'){
    const frequency=(values.repeatFrequency||'weekly').toUpperCase();
    const until=values.repeatMode==='until'?(values.time?`;UNTIL=${RenovaCore.zonedISO(values.repeatUntil,'23:59:59',timeZone).replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')}`:`;UNTIL=${values.repeatUntil.replace(/-/g,'')}`):'';
    payload.recurrence=[`RRULE:FREQ=${frequency}${until}`];
  }
  return payload;
}

async function saveGoogleEvent(e,encodedId){
  e.preventDefault();const id=encodedId?decodeURIComponent(encodedId):'',values=Object.fromEntries(new FormData(e.target)),form=e.target;
  if(values.endTime&&(!values.time||values.endTime<=values.time))return toast('End time must be later than the start time.');
  if(values.repeatMode==='until'&&(!values.repeatUntil||values.repeatUntil<values.date))return toast('Choose a repeat-until date on or after the event date.');
  const button=form.querySelector('button:not([type="button"])');if(button)button.disabled=true;
  try{
    const existing=googleEvents.find(item=>item.googleId===id)?.googleRaw,body=googleEventPayload(values,existing);
    const result=await googleCalendarRequest(id?'event':'events',{method:id?'PATCH':'POST',body:JSON.stringify(body)},true,id?`id=${encodeURIComponent(id)}`:'');
    if(id)googleEvents=googleEvents.filter(item=>item.googleId!==id);googleEvents.push(mapGoogleEvent(result));googleCalendarFetchKey='';
    if(form===document.querySelector('#modalRoot form'))closeModal(true);
    render();toast(id?'Google Calendar event updated':'Google Calendar event added');
  }catch(error){toast(error.message);}finally{if(button)button.disabled=false;}
}
async function deleteGoogleEvent(encodedId){let id=decodeURIComponent(encodedId);if(!confirm('Delete this event from Google Calendar? This cannot be undone.'))return;try{await googleCalendarRequest('event',{method:'DELETE'},true,`id=${encodeURIComponent(id)}`);googleEvents=googleEvents.filter(item=>item.googleId!==id);googleCalendarFetchKey='';closeModal();render();toast('Google Calendar event deleted')}catch(error){toast(error.message)}}


function openGoal(id=''){let g=state.goals.find(x=>x.id===id)||{};modal(`<h2>${id?'Update':'New'} goal</h2><form onsubmit="saveGoal(event,'${id}')"><div class="form-grid"><div class="field full"><label>Goal</label><input name="title" required value="${esc(g.title)}" placeholder="What are you working toward?"></div><div class="field"><label>Current amount</label><input name="current" type="number" value="${g.current||0}"></div><div class="field"><label>Target amount</label><input name="target" type="number" value="${g.target||0}"></div><div class="field"><label>Target date</label><input name="targetDate" type="date" value="${g.targetDate||''}"></div><div class="field full"><label>Note</label><textarea name="description">${esc(g.description)}</textarea></div></div><div class="modal-actions"><button type="button" class="secondary-button" onclick="closeModal()">Cancel</button><button class="primary-button">Save goal</button></div></form>`)}function saveGoal(e,id){e.preventDefault();let x={...Object.fromEntries(new FormData(e.target)),id:id||crypto.randomUUID()};let old=state.goals.find(t=>t.id===id);old?Object.assign(old,x):state.goals.push(x);save();closeModal();render();toast('Goal saved')}function editGoal(id){openGoal(id)}
function openJournal(...args) { return featureOpenJournal(...args); }function saveJournal(e){e.preventDefault();state.journal.push({...Object.fromEntries(new FormData(e.target)),id:crypto.randomUUID(),date:now});save();closeModal();render();toast('Journal entry saved')}
function openFocus(){modal(`<h2>Personal focus</h2><form onsubmit="state.focus=new FormData(event.target).get('focus');save();closeModal();render();toast('Focus updated');return false"><div class="field"><label>What matters most right now?</label><input name="focus" value="${esc(state.focus)}" placeholder="One clear, kind priority"></div><div class="modal-actions"><button class="primary-button">Save focus</button></div></form>`)}function saveProfile(e){e.preventDefault();try{new Intl.DateTimeFormat('en',{timeZone:new FormData(e.target).get('timezone')});}catch{return toast('Enter a valid timezone, for example Asia/Jakarta.');}state.profile={...state.profile,...Object.fromEntries(new FormData(e.target))};save();render();toast('Profile saved')}function toggleTheme(){state.theme=state.theme==='dark'?'light':'dark';save();render()}function exportData(){let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='renova-backup.json';a.click();URL.revokeObjectURL(a.href);toast('Data export downloaded')}
function search(){modal(`<h2>Search Renova</h2><div class="field"><input autofocus id="globalSearch" oninput="searchNow()" placeholder="Tasks, events, goals, projects…"></div><div id="searchResults" class="empty">Start typing to search your private records.</div>`);setTimeout(()=>document.querySelector('#globalSearch')?.focus(),20)}function searchNow(...args) { return featureSearchNow(...args); }
function setMobileSidebar(open){let sidebar=document.querySelector('.sidebar'),menu=document.querySelector('#mobileMenu'),backdrop=document.querySelector('#sidebarBackdrop');sidebar.classList.toggle('open',open);backdrop.classList.toggle('visible',open);menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close menu':'Open menu')}
document.querySelector('#quickButton').onclick=openQuick;document.querySelector('#searchButton').onclick=search;document.querySelector('#themeButton').onclick=toggleTheme;document.querySelector('#settingsButton').onclick=()=>setRoute('settings');document.querySelector('#mobileMenu').onclick=()=>setMobileSidebar(!document.querySelector('.sidebar').classList.contains('open'));document.querySelector('#mobileSidebarCollapse').onclick=()=>setMobileSidebar(false);document.querySelector('#sidebarBackdrop').onclick=()=>setMobileSidebar(false);document.querySelector('#nav').addEventListener('click',e=>{if(e.target.closest('.nav-link'))setMobileSidebar(false)});window.addEventListener('hashchange',()=>{route=location.hash.slice(1)||'home';render()});document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();search()}if(e.key==='Escape'){closeModal();setMobileSidebar(false)}});

let pendingTaskProject = null;
const financeCategories = [
  'Food & groceries',
  'Transport',
  'Housing',
  'Utilities',
  'Shopping',
  'Health',
  'Education',
  'Entertainment',
  'Personal care',
  'Travel',
  'Salary',
  'Freelance',
  'Business',
  'Investment',
  'Gifts',
  'Other',
];

function closeModal(...args) { return featureCloseModal(...args); }



function createProjectFromTask(id) {
  const form = document.querySelector('#taskForm');
  if (!(form instanceof HTMLFormElement)) {
    throw new Error('Task form is not available.');
  }
  pendingTaskProject = {
    id,
    values: Object.fromEntries(new FormData(form)),
  };
  openProject();
}

function cancelTaskProjectCreation() {
  const pending = pendingTaskProject;
  pendingTaskProject = null;
  if (pending) openTask(pending.id, pending.values);
  else closeModal();
}



function saveProject(event, id) {
  event.preventDefault();
  const value = {
    ...Object.fromEntries(new FormData(event.target)),
    id: id || crypto.randomUUID(),
  };
  const old = state.projects.find((project) => project.id === id);
  if (old && old.name !== value.name) {
    state.tasks.forEach((task) => {
      if (task.project === old.name) task.project = value.name;
    });
  }
  if (old) Object.assign(old, value);
  else state.projects.push(value);
  save();

  if (pendingTaskProject) {
    const pending = pendingTaskProject;
    pendingTaskProject = null;
    pending.values.project = value.name;
    openTask(pending.id, pending.values);
    toast('Project saved');
    return;
  }

  closeModal();
  render();
  toast('Project saved');
}

function formatRupiahInput(input) { input.setCustomValidity(''); }

function parseRupiahInput(value) { try { return RenovaCore.amount(value, 'plain'); } catch { return NaN; } }

function spendingByCategory() {
  const month = now.slice(0, 7);
  const totals = new Map();
  state.transactions
    .filter((transaction) =>
      transaction.type === 'Expense' && transaction.date?.startsWith(month),
    )
    .forEach((transaction) => {
      const category = transaction.category || 'Uncategorized';
      totals.set(category, (totals.get(category) || 0) + Number(transaction.amount || 0));
    });

  const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
  if (!total) return '<div class="empty">No expenses recorded this month.</div>';

  const colors = ['#007aff', '#30a46c', '#e69b16', '#e5484d', '#8e5ad7', '#14a8a1', '#f07835', '#718096'];
  let offset = 0;
  const gradient = entries.map(([, amount], index) => {
    const start = offset;
    offset += amount / total * 100;
    return `${colors[index % colors.length]} ${start}% ${offset}%`;
  }).join(', ');
  return `<div class="donut-layout"><div class="donut-chart" role="img" aria-label="Spending by category this month" style="background:conic-gradient(${gradient})"><div class="donut-center"><span>This month</span><strong>${money(total)}</strong></div></div><div class="donut-legend">${entries.map(([category, amount], index) => `<div class="donut-legend-row"><span class="donut-swatch" style="background:${colors[index % colors.length]}"></span><span class="donut-category">${esc(category)}</span><b>${money(amount)}</b></div>`).join('')}</div></div>`;
}

function finance(...args) { return featureFinance(...args); }

function accountBalance(account) {
  return Number(account.initial || 0) + state.transactions
    .reduce((total, transaction) => {
      const amount = Number(transaction.amount || 0);
      if (transaction.type === 'Transfer') {
        if (transaction.fromAccountId === account.id) return total - amount;
        if (transaction.toAccountId === account.id) return total + amount;
        return total;
      }
      if (transaction.accountId === account.id) {
        return total + (transaction.type === 'Income' ? amount : -amount);
      }
      return total;
    }, 0);
}

function openTransaction(id = '', selectedAccountId = '', selectedType = 'Expense') {
  const transaction = state.transactions.find((item) => item.id === id);
  if (transaction?.type === 'Transfer') {
    openTransfer(id);
    return;
  }
  if (!state.accounts.length) {
    toast('Add an account before recording income or expenses.');
    openAccount();
    return;
  }
  const selectedId = transaction?.accountId || selectedAccountId;
  const accountOptions = state.accounts.map((account) =>
    `<option value="${esc(account.id)}" ${selectedId === account.id ? 'selected' : ''}>${esc(account.name)}</option>`,
  ).join('');
  modal(
    `<h2>${id ? 'Edit transaction' : 'Record transaction'}</h2><form onsubmit="saveTransaction(event,'${id}')"><div class="form-grid"><div class="field"><label>Type</label><select name="type">${['Expense', 'Income'].map((type) => `<option ${transaction?.type === type || (!transaction && selectedType === type) ? 'selected' : ''}>${type}</option>`).join('')}</select></div><div class="field"><label>Account</label><select name="accountId" required>${accountOptions}</select></div><div class="field"><label>Amount</label><div class="currency-input"><span>Rp</span><input name="amount" type="text" inputmode="decimal" autocomplete="off" required placeholder="0" value="${transaction ? String(transaction.amount) : ''}" oninput="formatRupiahInput(this)"></div></div><div class="field"><label>Date</label><input name="date" type="date" value="${esc(transaction?.date || now)}" required></div><div class="field"><label>Category</label><input name="category" list="transactionCategories" value="${esc(transaction?.category || '')}"><datalist id="transactionCategories">${[...new Set([...financeCategories,...state.budgets.map(b=>b.category)])].map(c=>`<option value="${esc(c)}">`).join('')}</datalist></div><div class="field full"><label>Description</label><input name="description" value="${esc(transaction?.description || '')}" placeholder="What was this for?"></div></div><div class="modal-actions"><button type="button" class="secondary-button" onclick="closeModal()">Cancel</button><button class="primary-button">${id ? 'Save changes' : 'Save transaction'}</button></div></form>`,
  );
}

function saveTransaction(event, id = '') {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.target));
  if (!state.accounts.some((account) => account.id === values.accountId)) {
    toast('Choose a valid account for this transaction.');
    return;
  }
  const parsedAmount = parseRupiahInput(values.amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !RenovaCore.validDate(values.date) || !['Income','Expense'].includes(values.type)) return toast('Enter a valid positive amount, date, and transaction type.');
  const nextTransaction = {
    ...values,
    amount: parsedAmount,
    id: id || crypto.randomUUID(),
  };
  const existing = state.transactions.find((transaction) => transaction.id === id);
  if (existing) Object.assign(existing, nextTransaction);
  else state.transactions.push(nextTransaction);
  save();
  closeModal();
  render();
  toast(id ? 'Transaction updated' : 'Transaction recorded');
}

function deleteTransaction(...args) { return featureDeleteTransaction(...args); }

function openTransfer(id = '') {
  const transfer = state.transactions.find((item) => item.id === id && item.type === 'Transfer');
  if (state.accounts.length < 2) {
    toast('Add at least two accounts to move money.');
    return;
  }
  const fromAccountId = transfer?.fromAccountId || state.accounts[0].id;
  const toAccountId = transfer?.toAccountId || state.accounts.find((account) => account.id !== fromAccountId).id;
  const accountOptions = (selectedId) => state.accounts.map((account) =>
    `<option value="${esc(account.id)}" ${selectedId === account.id ? 'selected' : ''}>${esc(account.name)}</option>`,
  ).join('');
  modal(
    `<h2>${id ? 'Edit transfer' : 'Move money'}</h2><form onsubmit="saveTransfer(event,'${id}')"><div class="form-grid"><div class="field"><label>From account</label><select name="fromAccountId" required>${accountOptions(fromAccountId)}</select></div><div class="field"><label>To account</label><select name="toAccountId" required>${accountOptions(toAccountId)}</select></div><div class="field"><label>Amount</label><div class="currency-input"><span>Rp</span><input name="amount" type="text" inputmode="decimal" autocomplete="off" required placeholder="0" value="${transfer ? String(transfer.amount) : ''}" oninput="formatRupiahInput(this)"></div></div><div class="field"><label>Date</label><input name="date" type="date" value="${esc(transfer?.date || now)}" required></div><div class="field full"><label>Description</label><input name="description" value="${esc(transfer?.description || '')}" placeholder="Optional note"></div></div><div class="modal-actions"><button type="button" class="secondary-button" onclick="closeModal()">Cancel</button><button class="primary-button">${id ? 'Save changes' : 'Move money'}</button></div></form>`,
  );
}

function saveTransfer(event, id = '') {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.target));
  if (values.fromAccountId === values.toAccountId) {
    toast('Choose two different accounts.');
    return;
  }
  if (!RenovaCore.validDate(values.date) || ![values.fromAccountId,values.toAccountId].every(id=>state.accounts.some(a=>a.id===id))) return toast('Choose valid accounts and date.');
  const amount = parseRupiahInput(values.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    toast('Transfer amount must be greater than zero.');
    return;
  }
  const nextTransfer = {
    ...values,
    type: 'Transfer',
    amount,
    id: id || crypto.randomUUID(),
  };
  const existing = state.transactions.find((transaction) => transaction.id === id);
  if (existing) Object.assign(existing, nextTransfer);
  else state.transactions.push(nextTransfer);
  save();
  closeModal();
  render();
  toast(id ? 'Transfer updated' : 'Money moved');
}

function openAccountForm(id = '') {
  const account = state.accounts.find((item) => item.id === id);
  modal(
    `<h2>${id ? 'Edit account' : 'Add account'}</h2><form onsubmit="saveAccount(event,'${id}')"><div class="form-grid"><div class="field"><label>Name</label><input name="name" required placeholder="Bank account" value="${esc(account?.name || '')}"></div><div class="field"><label>Type</label><input name="type" placeholder="Cash, bank, e-wallet" value="${esc(account?.type || '')}"></div><div class="field full"><label>Initial balance</label><div class="currency-input"><span>Rp</span><input name="initial" type="text" inputmode="decimal" autocomplete="off" value="${String(account?.initial || 0)}" required oninput="formatRupiahInput(this)"></div></div></div><div class="modal-actions"><button type="button" class="secondary-button" onclick="closeModal()">Cancel</button><button class="primary-button">${id ? 'Save changes' : 'Add account'}</button></div></form>`,
  );
}

function openAccount(id = '') {
  openAccountForm(id);
}

function saveAccount(event, id = '') {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.target));
  if (!values.name.trim() || state.accounts.some(a=>a.id!==id&&a.name.toLowerCase()===values.name.trim().toLowerCase())) return toast('Use a unique account name.');
  values.name=values.name.trim();
  if (!Number.isFinite(parseRupiahInput(values.initial))) return toast('Invalid opening balance. Use 25000.50 without thousands separators.');
  const nextAccount = {
    ...values,
    initial: parseRupiahInput(values.initial),
    id: id || crypto.randomUUID(),
  };
  const existing = state.accounts.find((account) => account.id === id);
  if (existing) Object.assign(existing, nextAccount);
  else state.accounts.push(nextAccount);
  save();
  closeModal();
  render();
  toast(id ? 'Account updated' : 'Account added');
}

function deleteAccount(...args) { return featureDeleteAccount(...args); }

function openProject(id = '') {
  const project = state.projects.find((item) => item.id === id) || {};
  modal(
    `<h2>${id ? 'Edit' : 'New'} project</h2><form onsubmit="saveProject(event,'${id}')"><div class="form-grid"><div class="field full"><label>Project name</label><input name="name" required value="${esc(project.name)}" placeholder="What are you moving forward?"></div><div class="field"><label>Status</label><select name="status">${['Active', 'On hold', 'Completed'].map((status) => `<option ${project.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></div><div class="field"><label>Target date</label><input name="targetDate" type="date" value="${project.targetDate || ''}"></div><div class="field full"><label>Description</label><textarea name="description">${esc(project.description)}</textarea></div></div><div class="modal-actions">${id ? `<button type="button" class="text-button danger-button" onclick="deleteProject('${id}')">Delete</button>` : ''}<button type="button" class="secondary-button" onclick="cancelTaskProjectCreation()">Cancel</button><button class="primary-button">Save project</button></div></form>`,
  );
}

function openEvent(date = now, id = '') {
  const localEvent = state.events.find((event) => event.id === id);
  const selectedDate = localEvent?.date || date;
  const repeatMode = localEvent?.repeatMode || 'once';
  const destination = !id && googleCalendarToken
    ? `<div class="field"><label>Save to</label><select name="source"><option value="local">Renova only</option><option value="google">Google Calendar</option></select></div>`
    : '';
  modal(
    `<h2>${id ? 'Edit event' : 'New event'}</h2><form onsubmit="saveEvent(event,'${id}')"><div class="form-grid"><div class="field full"><label>Title</label><input name="title" required value="${esc(localEvent?.title || '')}" placeholder="Event name"></div><div class="field"><label>Date</label><input name="date" type="date" value="${esc(selectedDate)}" required></div><div class="field"><label>Start time</label><input name="time" type="time" value="${esc(localEvent?.time || '')}"></div><div class="field"><label>End time</label><input name="endTime" type="time" value="${esc(localEvent?.endTime || '')}"></div><div class="field full"><label>Location or link</label><input name="location" value="${esc(localEvent?.location || '')}" placeholder="Optional"></div><div class="field"><label>Repeat</label><select id="eventRepeatMode" name="repeatMode" onchange="toggleEventRepeatFields()"><option value="once" ${repeatMode === 'once' ? 'selected' : ''}>Does not repeat</option><option value="until" ${repeatMode === 'until' ? 'selected' : ''}>Repeat until a date</option><option value="forever" ${repeatMode === 'forever' ? 'selected' : ''}>Repeat forever</option></select></div><div class="field" id="eventRepeatFrequencyField"><label>Repeat frequency</label><select name="repeatFrequency"><option value="daily" ${localEvent?.repeatFrequency === 'daily' ? 'selected' : ''}>Daily</option><option value="weekly" ${!localEvent?.repeatFrequency || localEvent.repeatFrequency === 'weekly' ? 'selected' : ''}>Weekly</option><option value="monthly" ${localEvent?.repeatFrequency === 'monthly' ? 'selected' : ''}>Monthly</option></select></div><div class="field" id="eventRepeatUntilField"><label>Repeat until</label><input name="repeatUntil" type="date" value="${esc(localEvent?.repeatUntil || '')}"></div>${destination}</div><div class="modal-actions">${id ? `<button type="button" class="text-button danger-button" onclick="deleteLocalEvent('${id}')">Delete event</button>` : ''}<button type="button" class="secondary-button" onclick="closeModal()">Cancel</button><button class="primary-button">${id ? 'Save changes' : 'Save event'}</button></div></form>`,
  );
  toggleEventRepeatFields();
}

function toggleEventRepeatFields() {
  const mode = document.querySelector('#eventRepeatMode')?.value || 'once';
  const frequencyField = document.querySelector('#eventRepeatFrequencyField');
  const untilField = document.querySelector('#eventRepeatUntilField');
  const frequency = frequencyField?.querySelector('select');
  const until = untilField?.querySelector('input');
  if (frequencyField) frequencyField.hidden = mode === 'once';
  if (untilField) untilField.hidden = mode !== 'until';
  if (frequency) frequency.disabled = mode === 'once';
  if (until) {
    until.disabled = mode !== 'until';
    until.required = mode === 'until';
  }
}

function saveEvent(event, id = '') {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.target));
  if (values.endTime && (!values.time || values.endTime <= values.time)) {
    toast('End time must be later than the start time.');
    return;
  }
  if (values.repeatMode === 'until' && (!values.repeatUntil || values.repeatUntil < values.date)) {
    toast('Choose a repeat-until date on or after the event date.');
    return;
  }
  if (!id && values.source === 'google') {
    void saveGoogleEvent(event, '');
    return;
  }

  const { source: _source, ...eventValues } = values;
  const existing = state.events.find((item) => item.id === id);
  if (existing) Object.assign(existing, eventValues);
  else state.events.push({ ...eventValues, id: crypto.randomUUID(), source: 'local' });

  save();
  closeModal();
  render();
  toast(id ? 'Event updated' : 'Event added');
}

function deleteLocalEvent(id) {
  if (!confirm('Delete this event?')) return;
  checkpoint('delete event');
  state.events = state.events.filter((event) => event.id !== id);
  save();
  closeModal(true);
  render();
  toast('Event deleted');
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (
    target instanceof HTMLInputElement &&
    target.type === 'date' &&
    typeof target.showPicker === 'function'
  ) {
    target.showPicker();
  }
});

function taskStatusBadge(status = 'Inbox') {
  const className = String(status).toLowerCase().replaceAll(' ', '-');
  return `<span class="task-status task-status-${className}">${esc(status)}</span>`;
}

function taskRows(tasks) {
  return tasks.length
    ? tasks.map((task) => `<div class="task-row"><input class="check" type="checkbox" aria-label="Complete ${esc(task.title)}" ${task.status === 'Completed' ? 'checked' : ''} onchange="toggleTask('${task.id}')"><div class="task-copy"><button class="text-button task-title" onclick="editTask('${task.id}')">${esc(task.title)}</button>${task.description ? `<small class="task-description">${esc(task.description)}</small>` : ''}${safeHttpUrl(task.link) ? `<a class="task-link" href="${esc(safeHttpUrl(task.link))}" target="_blank" rel="noopener noreferrer">Open link ↗</a>` : ''}<small>${task.due ? new Date(`${task.due}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date'}${task.project ? ` · ${esc(task.project)}` : ''}</small></div>${taskStatusBadge(task.status)}<span class="priority ${task.priority === 'High' ? 'high' : task.priority === 'Low' ? 'low' : ''}">${esc(task.priority || 'Medium')}</span><button class="text-button" onclick="editTask('${task.id}')">Edit</button></div>`).join('')
    : '<div class="empty">Nothing here yet. A little breathing room is good.</div>';
}

function taskTimeline(tasks) {
  const ordered = tasks.slice().sort((a, b) => {
    if (!a.due) return b.due ? 1 : a.title.localeCompare(b.title);
    if (!b.due) return -1;
    return a.due.localeCompare(b.due) || a.title.localeCompare(b.title);
  });
  return ordered.length
    ? `<div class="task-timeline">${ordered.map((task) => `<article class="timeline-item ${task.due && task.due < now && task.status !== 'Completed' ? 'timeline-overdue' : ''}"><time datetime="${esc(task.due || '')}">${task.due ? new Date(`${task.due}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date'}</time><div class="timeline-task"><div><b>${esc(task.title)}</b><small>${task.project ? `${esc(task.project)} · ` : ''}${esc(task.priority || 'Medium')} priority</small></div>${taskStatusBadge(task.status)}<button class="text-button" onclick="editTask('${task.id}')">Edit</button></div></article>`).join('')}</div>`
    : '<div class="empty">No tasks to show in the timeline.</div>';
}

function tasks() {
  const activeTasks = state.tasks.filter((task) => !['Archived', 'Completed'].includes(task.status));
  const projects = [...new Set(state.projects.map((project) => project.name).filter(Boolean))];
  return heading(
    'Tasks',
    'Plan, prioritize, and follow your tasks by project and status.',
    '<button class="primary-button" onclick="openTask()">＋ New task</button>',
  ) + `<div class="section-stack"><section class="panel"><div class="toolbar task-filters"><input id="taskSearch" oninput="filterTasks()" placeholder="Search tasks"><select id="taskFilter" onchange="filterTasks()"><option value="all">Any due date</option><option value="today">Due today</option><option value="overdue">Overdue</option></select><select id="taskProjectFilter" onchange="filterTasks()"><option value="all">All projects</option><option value="none">No project</option>${projects.map((project) => `<option value="${esc(project)}">${esc(project)}</option>`).join('')}</select><select id="taskPriorityFilter" onchange="filterTasks()"><option value="all">Any urgency</option><option>High</option><option>Medium</option><option>Low</option></select><select id="taskStatusFilter" onchange="filterTasks()"><option value="active">All active states</option>${['Inbox', 'To do', 'In progress', 'Completed', 'Archived'].map((status) => `<option>${status}</option>`).join('')}</select></div><div class="panel-title task-list-title"><h2>Task list</h2><span id="taskResultCount" class="muted">${activeTasks.length} tasks</span></div><div id="taskList">${taskRows(activeTasks)}</div></section><section class="panel"><div class="panel-title"><h2>Task timeline</h2><span class="muted">Ordered by due date</span></div><div id="taskTimeline">${taskTimeline(activeTasks)}</div></section><div class="content-grid"><section class="panel"><div class="panel-title"><h2>At a glance</h2></div><div class="snapshot"><div class="metric"><div class="value">${activeTasks.length}</div><div class="label">Active tasks</div></div><div class="metric"><div class="value">${activeTasks.filter((task) => task.priority === 'High').length}</div><div class="label">High urgency</div></div><div class="metric"><div class="value">${activeTasks.filter((task) => task.due && task.due < now && task.status !== 'Completed').length}</div><div class="label">Overdue tasks</div></div><div class="metric"><div class="value">${state.tasks.filter((task) => task.status === 'Completed').length}</div><div class="label">Completed</div></div></div></section><aside class="panel"><div class="panel-title"><h2>Google Calendar</h2></div><p class="muted">${googleCalendarToken ? 'Tasks with a due date can be added to your connected calendar.' : 'Connect Google Calendar to add task due dates to your calendar.'}</p>${googleCalendarToken ? '' : '<button class="secondary-button" onclick="setRoute(\'calendar\')">Open calendar settings</button>'}</aside></div></div>`;
}

function filterTasks() {
  const query = document.querySelector('#taskSearch')?.value.trim().toLowerCase() || '';
  const dateFilter = document.querySelector('#taskFilter')?.value || 'all';
  const projectFilter = document.querySelector('#taskProjectFilter')?.value || 'all';
  const priorityFilter = document.querySelector('#taskPriorityFilter')?.value || 'all';
  const statusFilter = document.querySelector('#taskStatusFilter')?.value || 'active';
  let filtered = state.tasks.filter((task) => {
    const statusMatches = statusFilter === 'active'
      ? !['Archived', 'Completed'].includes(task.status)
      : task.status === statusFilter;
    const dateMatches = dateFilter === 'today'
      ? task.due === now
      : dateFilter === 'overdue'
        ? Boolean(task.due && task.due < now && task.status !== 'Completed')
        : true;
    const projectMatches = projectFilter === 'all'
      ? true
      : projectFilter === 'none'
        ? !task.project
        : task.project === projectFilter;
    return statusMatches &&
      dateMatches &&
      projectMatches &&
      (priorityFilter === 'all' || task.priority === priorityFilter) &&
      String(task.title || '').toLowerCase().includes(query);
  });
  const list = document.querySelector('#taskList');
  const timeline = document.querySelector('#taskTimeline');
  if (list) list.innerHTML = taskRows(filtered);
  if (timeline) timeline.innerHTML = taskTimeline(filtered);
  const count = document.querySelector('#taskResultCount');
  if (count) count.textContent = `${filtered.length} ${filtered.length === 1 ? 'task' : 'tasks'}`;
}

function projects() {
  return heading(
    'Projects',
    'Open a project to see its linked tasks and progress.',
    '<button class="primary-button" onclick="openProject()">＋ New project</button>',
  ) + `<section class="panel">${state.projects.map((project) => {
    const tasks = state.tasks.filter((task) => task.project === project.name);
    const done = tasks.filter((task) => task.status === 'Completed').length;
    const percent = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    return `<article class="goal-card"><div class="panel-title"><div><h2>${esc(project.name)}</h2><small class="muted">${esc(project.status || 'Active')}${project.targetDate ? ` · Target ${esc(project.targetDate)}` : ''}</small></div><div class="project-actions"><button class="text-button" onclick="openProject('${project.id}')">Edit project</button><button class="text-button danger-button" onclick="deleteProject('${project.id}')">Delete</button></div></div><div class="muted">${esc(project.description || 'No description yet.')}</div><div class="progress"><span style="width:${percent}%"></span></div><small class="project-progress-label"><span>${tasks.length} linked tasks</span><span>${percent}% complete</span></small><details class="project-task-details"><summary>View project tasks (${tasks.length})</summary><div>${tasks.length ? taskRows(tasks) : '<div class="empty">No tasks linked to this project yet.</div>'}</div><button class="secondary-button" onclick="openProjectTask('${project.id}')">＋ Add task to project</button></details></article>`;
  }).join('') || '<div class="empty">Create a project, then link tasks to see them here.</div>'}</section>`;
}

function openProjectTask(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) {
    toast('This project could not be found.');
    return;
  }
  openTask('', { project: project.name });
}

function openTask(id = '', draft = {}) {
  const task = state.tasks.find((item) => item.id === id) || {};
  const values = { ...task, ...draft };
  const projects = state.projects.map((project) => project.name).filter(Boolean);
  if (values.project && !projects.includes(values.project)) projects.push(values.project);
  const hasGoogleLink = Boolean(values.calendarEventId);
  const calendarOption = googleCalendarToken
    ? `<label class="task-calendar-option"><input type="checkbox" name="syncToGoogle" value="yes" ${hasGoogleLink || values.syncToGoogle === 'yes' ? 'checked' : ''} ${hasGoogleLink ? 'disabled' : ''}><span><b>Sync due date to Google Calendar</b><small>${hasGoogleLink ? 'Already linked; task changes will keep syncing.' : 'Creates or updates an all-day calendar event.'}</small></span></label>${hasGoogleLink ? `<input type="hidden" name="syncToGoogle" value="yes">` : ''}`
    : `<p class="muted task-calendar-note">To add this task to Google Calendar, connect your account from the <button type="button" class="text-button" onclick="closeModal();setRoute('calendar')">Calendar page</button>.</p>`;
  modal(
    `<h2>${id ? 'Edit' : 'New'} task</h2><form id="taskForm" onsubmit="saveTask(event,'${id}')"><div class="form-grid"><div class="field full"><label>Task</label><input required name="title" value="${esc(values.title)}" placeholder="What needs your attention?"></div><div class="field full"><label>Description</label><textarea name="description" placeholder="Add details, notes, or context">${esc(values.description || '')}</textarea></div><div class="field full"><label>Link</label><input type="url" name="link" value="${esc(values.link || '')}" placeholder="https://example.com"></div><div class="field"><label>Due date</label><input type="date" name="due" value="${values.due || ''}"></div><div class="field"><label>Repeat</label><select name="repeat"><option value="">Does not repeat</option>${['daily','weekly','monthly'].map(r=>`<option value="${r}" ${values.repeat===r?'selected':''}>${r}</option>`).join('')}</select></div><div class="field"><label>Priority / urgency</label><select name="priority">${['Low', 'Medium', 'High'].map((priority) => `<option ${values.priority === priority ? 'selected' : ''}>${priority}</option>`).join('')}</select></div><div class="field"><label>Status</label><select name="status">${['Inbox', 'To do', 'In progress', 'Completed', 'Archived'].map((status) => `<option ${values.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></div><div class="field full"><label>Project</label><div class="project-select-row"><select name="project"><option value="">No project</option>${projects.map((name) => `<option value="${esc(name)}" ${values.project === name ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select><button type="button" class="secondary-button" onclick="createProjectFromTask('${id}')">＋ New project</button></div></div><div class="field full">${calendarOption}</div></div><div class="modal-actions">${id ? `<button type="button" class="text-button danger-button" onclick="deleteTask('${id}')">Delete task</button>` : ''}<button type="button" class="secondary-button" onclick="closeModal()">Cancel</button><button class="primary-button">Save task</button></div></form>`,
  );
}

async function saveTask(event, id) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.target));
  const { syncToGoogle, ...taskValues } = values;
  if (taskValues.repeat && !taskValues.due) return toast('Recurring tasks need a due date.');
  if (syncToGoogle === 'yes' && !taskValues.due) {
    toast('Add a due date before syncing this task to Google Calendar.');
    return;
  }
  const old = state.tasks.find((task) => task.id === id);
  const task = {
    ...old,
    ...taskValues,
    id: id || crypto.randomUUID(),
    completed: taskValues.status === 'Completed' ? now : old?.completed,
  };
  if (old) Object.assign(old, task);
  else state.tasks.push(task);
  createNextTaskOccurrence(task);
  save();
  closeModal();
  render();

  if (syncToGoogle === 'yes') {
    try {
      const description = [
        `Status: ${task.status || 'Inbox'}`,
        `Priority: ${task.priority || 'Medium'}`,
        task.project ? `Project: ${task.project}` : '',
      ].filter(Boolean).join('\n');
      const payload = googleEventPayload(
        {
          title: `Task: ${task.title}`,
          date: task.due,
          description,
        },
        null,
      );
      const linkedEvent = await googleCalendarRequest(
        task.calendarEventId ? 'event' : 'events',
        {
          method: task.calendarEventId ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
        true,
        task.calendarEventId ? `id=${encodeURIComponent(task.calendarEventId)}` : '',
      );
      if (!linkedEvent.id) throw new Error('Google Calendar returned no event ID.');
      task.calendarEventId = linkedEvent.id;
      save();
      googleCalendarFetchKey = '';
      toast('Task saved and synced to Google Calendar');
    } catch (error) {
      console.error('Task Google Calendar sync failed:', error);
      toast(`Task saved, but Google Calendar sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return;
  }

  toast(id ? 'Task updated' : 'Task saved');
}

async function toggleTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) {
    toast('This task could not be found.');
    return;
  }
  task.status = task.status === 'Completed' ? 'To do' : 'Completed';
  task.completed = task.status === 'Completed' ? now : '';
  createNextTaskOccurrence(task);
  save();
  render();

  if (task.calendarEventId && googleCalendarToken) {
    try {
      const description = [
        `Status: ${task.status}`,
        `Priority: ${task.priority || 'Medium'}`,
        task.project ? `Project: ${task.project}` : '',
      ].filter(Boolean).join('\n');
      const payload = googleEventPayload(
        { title: `Task: ${task.title}`, date: task.due, description },
        null,
      );
      await googleCalendarRequest(
        'event',
        { method: 'PATCH', body: JSON.stringify(payload) },
        true,
        `id=${encodeURIComponent(task.calendarEventId)}`,
      );
      googleCalendarFetchKey = '';
    } catch (error) {
      console.error('Task Google Calendar status sync failed:', error);
      toast(`Task status changed, but Google Calendar sync failed: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
  }
  toast(task.status === 'Completed' ? 'Task completed' : 'Task reopened');
}

async function deleteTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) {
    toast('This task could not be found.');
    return;
  }

  const hasCalendarEvent = Boolean(task.calendarEventId);
  const message = hasCalendarEvent && googleCalendarToken
    ? 'Delete this task and its linked Google Calendar event?'
    : hasCalendarEvent
      ? 'Delete this task? Its linked event will remain in Google Calendar because the calendar is disconnected.'
      : 'Delete this task? This cannot be undone.';
  if (!confirm(message)) return;

  if (hasCalendarEvent && googleCalendarToken) {
    try {
      await googleCalendarRequest(
        'event',
        { method: 'DELETE' },
        true,
        `id=${encodeURIComponent(task.calendarEventId)}`,
      );
      googleCalendarFetchKey = '';
    } catch (error) {
      console.error('Task Google Calendar event deletion failed:', error);
      toast(`Task was not deleted: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
  }

  checkpoint(hasCalendarEvent && googleCalendarToken ? 'delete task (Google event cannot be restored)' : 'delete task');
  state.tasks = state.tasks.filter((item) => item.id !== id);
  save();
  closeModal(true);
  render();
  toast('Task deleted');
}

initWorkspaceFeatures();render();completeGoogleOAuth();
