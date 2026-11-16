let assistantMessages=[],assistantIsOpen=false,assistantRenderedCount=0;
let assistantActiveTopic='finance',assistantPeriod='current',assistantChooserOpen=true;

function initAssistant(){
  const root=document.getElementById('assistantRoot');if(!root)return;
  root.innerHTML=`<button id="assistantLauncher" class="assistant-launcher" type="button" aria-label="Tanya Renova" aria-haspopup="dialog" aria-expanded="false" onclick="toggleAssistant()">${icon('chat')}<span>Tanya</span></button>
    <section id="assistantPanel" class="assistant-panel" role="dialog" aria-labelledby="assistantTitle" hidden>
      <header class="assistant-header"><span class="assistant-avatar">${icon('chat')}</span><div><h2 id="assistantTitle">Tanya Renova</h2><p>Pilih pertanyaan</p></div><button class="icon-button" type="button" onclick="resetAssistant()" aria-label="Mulai percakapan baru" title="Percakapan baru">${icon('refresh')}</button><button class="icon-button" type="button" onclick="toggleAssistant(false)" aria-label="Tutup chat">${icon('close')}</button></header>
      <div id="assistantLog" class="assistant-log" role="log" aria-live="polite" aria-relevant="additions"></div>
      <div id="assistantChoices" class="assistant-choices"></div>
      <p class="assistant-note">Dari catatanmu · Tanpa mengubah data</p>
    </section>`;
  assistantMessages=[];assistantRenderedCount=0;
  renderAssistantMessages();
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&assistantIsOpen){event.stopPropagation();toggleAssistant(false);}
    if(event.key==='Tab'&&assistantIsOpen&&window.matchMedia?.('(max-width: 760px)').matches){
      const controls=[...document.querySelectorAll('#assistantPanel button,#assistantPanel a[href]')].filter(el=>!el.disabled&&el.getClientRects().length),first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
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
function focusAssistantMenu(){
  const button=document.querySelector('#assistantChoices .assistant-menu-toggle')||document.querySelector('#assistantChoices [aria-pressed="true"]');
  button?.focus({preventScroll:true});
}
function toggleAssistant(force){
  assistantIsOpen=typeof force==='boolean'?force:!assistantIsOpen;
  const panel=document.getElementById('assistantPanel'),launcher=document.getElementById('assistantLauncher');if(!panel||!launcher)return;
  panel.hidden=!assistantIsOpen;launcher.setAttribute('aria-expanded',String(assistantIsOpen));syncAssistantModal();
  if(assistantIsOpen){if(document.body.classList.contains('menu-open'))setMobileSidebar(false);focusAssistantMenu();}
  else launcher.focus({preventScroll:true});
}
function syncAssistantModal(){
  const mobile=Boolean(window.matchMedia?.('(max-width: 760px)').matches),shell=document.querySelector('.app-shell');
  document.getElementById('assistantPanel')?.setAttribute('aria-modal',String(mobile&&assistantIsOpen));
  if(mobile&&assistantIsOpen)shell?.setAttribute('inert','');else shell?.removeAttribute('inert');
}
function resetAssistant(){
  assistantMessages=[];assistantRenderedCount=0;assistantActiveTopic='finance';assistantPeriod='current';assistantChooserOpen=true;
  renderAssistantMessages();focusAssistantMenu();
}
function assistantChooseTopic(topicId){
  if(!RenovaAssistantOptions.getTopic(topicId))return;
  assistantActiveTopic=topicId;assistantChooserOpen=true;renderAssistantChoices();
  document.getElementById('assistantTopic-'+topicId)?.focus({preventScroll:true});
}
function assistantChoosePeriod(period){
  if(!['current','previous'].includes(period))return;
  assistantPeriod=period;renderAssistantChoices();document.getElementById('assistantPeriod-'+period)?.focus({preventScroll:true});
}
function assistantToggleChoices(){assistantChooserOpen=!assistantChooserOpen;renderAssistantChoices();focusAssistantMenu();}
function assistantChooseQuestion(index){
  const question=RenovaAssistantOptions.getTopic(assistantActiveTopic)?.questions[index];
  if(question)askAssistant(question.id);
}
function askAssistant(questionId){
  const selected=RenovaAssistantOptions.prompt(assistantActiveTopic,questionId,assistantPeriod);if(!selected)return false;
  const text=selected.query,date=workspaceDate(),range=RenovaAssistant.period(text,date,'day');
  let events=[];
  if(!range.error&&(new Date(range.end+'T12:00:00Z')-new Date(range.start+'T12:00:00Z'))/86400000<=366)events=[...state.events.flatMap(event=>localEventOccurrences(event,range.start,range.end)),...googleEvents];
  let reply;
  try{reply=RenovaAssistant.answer(state,text,{today:date,events,preset:true,googleConnected:Boolean(googleCalendarToken)});}
  catch(error){console.error('Renova assistant:',error);reply={intent:'help',title:'Belum bisa dihitung',text:'Coba pilihan lain atau periksa catatanmu.',items:[],links:[]};}
  assistantMessages.push({role:'user',text},{role:'assistant',reply});assistantChooserOpen=false;
  if(assistantMessages.length>30){assistantMessages=assistantMessages.slice(-30);assistantRenderedCount=0;}
  renderAssistantMessages();focusAssistantMenu();return true;
}
function renderAssistantChoices(){
  const root=document.getElementById('assistantChoices');if(!root)return;
  const topic=RenovaAssistantOptions.getTopic(assistantActiveTopic);
  root.innerHTML=`${assistantMessages.length?`<button class="assistant-menu-toggle" type="button" onclick="assistantToggleChoices()" aria-expanded="${assistantChooserOpen}" aria-controls="assistantQuestionMenu">${icon(assistantChooserOpen?'close':'plus')} ${assistantChooserOpen?'Tutup pilihan':'Pertanyaan lain'}</button>`:''}
    ${assistantChooserOpen?`<div id="assistantQuestionMenu"><div class="assistant-topics" role="group" aria-label="Topik pertanyaan">${RenovaAssistantOptions.topics.map(item=>`<button id="assistantTopic-${item.id}" type="button" aria-pressed="${item.id===assistantActiveTopic}" onclick="assistantChooseTopic('${item.id}')">${icon(item.icon)}<span>${item.label}</span></button>`).join('')}</div>
    ${assistantActiveTopic==='finance'?`<div class="assistant-period" role="group" aria-label="Periode keuangan"><button id="assistantPeriod-current" type="button" aria-pressed="${assistantPeriod==='current'}" onclick="assistantChoosePeriod('current')">Bulan ini</button><button id="assistantPeriod-previous" type="button" aria-pressed="${assistantPeriod==='previous'}" onclick="assistantChoosePeriod('previous')">Bulan lalu</button></div>`:''}
    <div id="assistantOptionsList" class="assistant-options">${topic.questions.map((question,index)=>`<button type="button" onclick="assistantChooseQuestion(${index})" aria-label="${esc(question.label)}">${icon(question.icon)}<span>${esc(question.label)}</span>${icon('chevron-right')}</button>`).join('')}</div></div>`:''}`;
}
function renderAssistantMessages(){
  const log=document.getElementById('assistantLog');if(!log)return;
  if(!assistantMessages.length){log.innerHTML=`<div class="assistant-empty"><span>${icon('chat')}</span><h3>Mau cek apa?</h3><p>Pilih topik dan pertanyaannya di bawah.</p></div>`;}
  else{
    const added=assistantMessages.slice(assistantRenderedCount).map((message,offset)=>{const index=assistantRenderedCount+offset;return message.role==='user'?`<div class="assistant-user">${esc(message.text)}</div>`:`<article class="assistant-answer"><h3>${esc(message.reply.title)}</h3><p>${esc(message.reply.text)}</p>${(message.reply.items||[]).map((item,itemIndex)=>`<div class="assistant-result"><div><b>${esc(item.label)}</b>${item.detail?`<small>${esc(item.detail)}</small>`:''}${item.value?`<strong>${esc(item.value)}</strong>`:''}</div>${item.route?`<button type="button" class="icon-button" onclick="assistantOpenItem(${index},${itemIndex})" aria-label="Buka ${esc(item.label)}">${icon('chevron-right')}</button>`:''}</div>`).join('')}${(message.reply.links||[]).map((link,linkIndex)=>`<button type="button" class="assistant-link" onclick="assistantOpenLink(${index},${linkIndex})">${esc(link.label)} ${icon('chevron-right')}</button>`).join('')}</article>`;}).join('');
    if(!assistantRenderedCount)log.innerHTML=added;else log.insertAdjacentHTML('beforeend',added);
  }
  assistantRenderedCount=assistantMessages.length;renderAssistantChoices();log.scrollTop=log.scrollHeight;
}
function assistantOpenLink(messageIndex,linkIndex){const route=assistantMessages[messageIndex]?.reply?.links?.[linkIndex]?.route;if(route){toggleAssistant(false);setRoute(route);}}
function assistantOpenItem(messageIndex,itemIndex){
  const item=assistantMessages[messageIndex]?.reply?.items?.[itemIndex];if(!item?.route)return;
  toggleAssistant(false);
  if(item.kind==='tasks'&&state.tasks.some(t=>t.id===item.id)){openSearchRecord('tasks',item.id);return;}
  if(item.route==='calendar'&&item.date){calendarOffset=Math.floor((new Date(item.date+'T12:00:00')-calendarWeekStart(0))/604800000);googleCalendarFetchKey='';}
  setRoute(item.route);
}
