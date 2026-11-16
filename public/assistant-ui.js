let assistantMessages=[],assistantLastIntent='',assistantIsOpen=false,assistantRenderedCount=0;
const assistantStarterPrompts=['Apa yang perlu dikontrol?','Pengeluaran bulan ini','Tugas hari ini','Jadwal besok'];
function assistantWelcome(){return{role:'assistant',reply:{intent:'help',title:'Mau cek apa?',text:'Tanya tentang uang, tugas, atau jadwalmu.',items:[],links:[],suggestions:assistantStarterPrompts}};}
function initAssistant(){
  const root=document.getElementById('assistantRoot');if(!root)return;
  root.innerHTML=`<button id="assistantLauncher" class="assistant-launcher" type="button" aria-label="Tanya Renova" aria-haspopup="dialog" aria-expanded="false" onclick="toggleAssistant()">${icon('chat')}<span>Tanya</span></button><section id="assistantPanel" class="assistant-panel" role="dialog" aria-labelledby="assistantTitle" hidden><header class="assistant-header"><span class="assistant-avatar">${icon('chat')}</span><div><h2 id="assistantTitle">Tanya Renova</h2><p>Berbasis aturan</p></div><button class="icon-button" type="button" onclick="resetAssistant()" aria-label="Mulai percakapan baru" title="Percakapan baru">${icon('refresh')}</button><button class="icon-button" type="button" onclick="toggleAssistant(false)" aria-label="Tutup chat">${icon('close')}</button></header><div id="assistantLog" class="assistant-log" role="log" aria-live="polite" aria-relevant="additions"></div><div id="assistantSuggestions" class="assistant-suggestions"></div><form id="assistantForm" class="assistant-form" onsubmit="submitAssistant(event)"><label class="assistant-input-label"><span class="sr-only">Pertanyaan</span><input id="assistantInput" name="question" maxlength="400" required autocomplete="off" placeholder="Tanya uang, tugas, jadwal…"></label><button class="primary-button" type="submit" aria-label="Kirim pertanyaan">${icon('send')}</button></form><p class="assistant-note">Hanya membaca catatan. Jawaban dihitung saat ditanya.</p></section>`;
  assistantMessages=[assistantWelcome()];
  assistantRenderedCount=0;
  renderAssistantMessages();
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&assistantIsOpen){event.stopPropagation();toggleAssistant(false);}
    if(event.key==='Tab'&&assistantIsOpen&&window.matchMedia?.('(max-width: 760px)').matches){
      const controls=[...document.querySelectorAll('#assistantPanel button,#assistantPanel input,#assistantPanel a[href]')].filter(el=>!el.disabled&&el.getClientRects().length),first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  });
  const viewport=()=>{
    const panel=document.getElementById('assistantPanel');if(!panel)return;
    syncAssistantModal();
    if(window.matchMedia?.('(max-width: 760px)').matches&&window.visualViewport){
      panel.style.setProperty('--assistant-height',window.visualViewport.height+'px');panel.style.setProperty('--assistant-top',window.visualViewport.offsetTop+'px');
    }else{panel.style.removeProperty('--assistant-height');panel.style.removeProperty('--assistant-top');}
  };
  window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);window.addEventListener('resize',viewport);viewport();
}
function toggleAssistant(force){
  assistantIsOpen=typeof force==='boolean'?force:!assistantIsOpen;
  const panel=document.getElementById('assistantPanel'),launcher=document.getElementById('assistantLauncher');if(!panel||!launcher)return;
  panel.hidden=!assistantIsOpen;launcher.setAttribute('aria-expanded',String(assistantIsOpen));
  syncAssistantModal();
  if(assistantIsOpen){if(document.body.classList.contains('menu-open'))setMobileSidebar(false);document.getElementById('assistantInput').focus({preventScroll:true});}
  else launcher.focus({preventScroll:true});
}
function syncAssistantModal(){
  const mobile=Boolean(window.matchMedia?.('(max-width: 760px)').matches),shell=document.querySelector('.app-shell');
  document.getElementById('assistantPanel')?.setAttribute('aria-modal',String(mobile&&assistantIsOpen));
  if(mobile&&assistantIsOpen)shell?.setAttribute('inert','');else shell?.removeAttribute('inert');
}
function resetAssistant(){assistantMessages=[assistantWelcome()];assistantLastIntent='';assistantRenderedCount=0;renderAssistantMessages();document.getElementById('assistantInput').value='';document.getElementById('assistantInput').focus();}
function submitAssistant(event){
  event.preventDefault();const input=document.getElementById('assistantInput'),question=input.value.trim();if(!question)return;
  input.value='';askAssistant(question);
}
function askAssistant(question){
  const text=String(question).trim().slice(0,400);if(!text)return;
  const date=workspaceDate(),range=RenovaAssistant.period(text,date,'day');
  let events=[];
  if(!range.error){
    const start=new Date(range.start+'T12:00:00Z'),end=new Date(range.end+'T12:00:00Z');
    if((end-start)/86400000<=366)events=[...state.events.flatMap(event=>localEventOccurrences(event,range.start,range.end)),...googleEvents];
  }
  let reply;
  try{reply=RenovaAssistant.answer(state,text,{today:date,events,lastIntent:assistantLastIntent,googleConnected:Boolean(googleCalendarToken)});}
  catch(error){console.error('Renova assistant:',error);reply={intent:'help',title:'Belum bisa dihitung',text:'Coba pertanyaan yang lebih spesifik, misalnya “pengeluaran bulan ini”.',items:[],links:[],suggestions:assistantStarterPrompts};}
  if(reply.intent!=='help')assistantLastIntent=reply.intent;
  assistantMessages.push({role:'user',text},{role:'assistant',reply});
  if(assistantMessages.length>31){assistantMessages=assistantMessages.slice(-30);assistantRenderedCount=0;}
  renderAssistantMessages();document.getElementById('assistantInput')?.focus({preventScroll:true});
}
function renderAssistantMessages(){
  const log=document.getElementById('assistantLog');if(!log)return;
  const added=assistantMessages.slice(assistantRenderedCount).map((message,offset)=>{const index=assistantRenderedCount+offset;return message.role==='user'?`<div class="assistant-user">${esc(message.text)}</div>`:`<article class="assistant-answer"><h3>${esc(message.reply.title)}</h3><p>${esc(message.reply.text)}</p>${(message.reply.items||[]).map((item,itemIndex)=>`<div class="assistant-result"><div><b>${esc(item.label)}</b>${item.detail?`<small>${esc(item.detail)}</small>`:''}${item.value?`<strong>${esc(item.value)}</strong>`:''}</div>${item.route?`<button type="button" class="icon-button" onclick="assistantOpenItem(${index},${itemIndex})" aria-label="Buka ${esc(item.label)}">${icon('chevron-right')}</button>`:''}</div>`).join('')}${(message.reply.links||[]).map((link,linkIndex)=>`<button type="button" class="assistant-link" onclick="assistantOpenLink(${index},${linkIndex})">${esc(link.label)} ${icon('chevron-right')}</button>`).join('')}</article>`;}).join('');
  if(!assistantRenderedCount)log.innerHTML=added;else log.insertAdjacentHTML('beforeend',added);
  assistantRenderedCount=assistantMessages.length;
  const last=assistantMessages[assistantMessages.length-1],suggestions=last?.reply?.suggestions||assistantStarterPrompts;
  document.getElementById('assistantSuggestions').innerHTML=suggestions.slice(0,4).map((text,index)=>`<button type="button" onclick="assistantSuggestion(${index})">${esc(text)}</button>`).join('');
  log.scrollTop=log.scrollHeight;
}
function assistantSuggestion(index){const last=assistantMessages[assistantMessages.length-1],list=last?.reply?.suggestions||assistantStarterPrompts;if(list[index])askAssistant(list[index]);}
function assistantOpenLink(messageIndex,linkIndex){const route=assistantMessages[messageIndex]?.reply?.links?.[linkIndex]?.route;if(route){toggleAssistant(false);setRoute(route);}}
function assistantOpenItem(messageIndex,itemIndex){
  const item=assistantMessages[messageIndex]?.reply?.items?.[itemIndex];if(!item?.route)return;
  toggleAssistant(false);
  if(item.kind==='tasks'&&state.tasks.some(t=>t.id===item.id)){openSearchRecord('tasks',item.id);return;}
  if(item.route==='calendar'&&item.date){calendarOffset=Math.floor((new Date(item.date+'T12:00:00')-calendarWeekStart(0))/604800000);googleCalendarFetchKey='';}
  setRoute(item.route);
}
