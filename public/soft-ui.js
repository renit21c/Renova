/* Rounded line icons, palette-aware notifications, and the mobile drawer. */
let toastTimer;
function softIcon(name) {
  const paths={
    home:'<path d="M3.5 10.5 10 4.8a3 3 0 0 1 4 0l6.5 5.7M5 9.5V18a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V9.5M9 21v-6a3 3 0 0 1 6 0v6"/>',
    calendar:'<rect x="3.5" y="5" width="17" height="16" rx="4"/><path d="M8 3v4m8-4v4M4 10.5h16M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01"/>',
    check:'<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    folder:'<path d="M3.5 8V7a3 3 0 0 1 3-3h2.8a3 3 0 0 1 2.1.9L13 6.5h4.5a3 3 0 0 1 3 3V17a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V8Z"/><path d="M4 9h16"/>',
    target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor" stroke="none"/>',
    wallet:'<rect x="3" y="5" width="18" height="15" rx="4"/><path d="M3.5 9h17M21 12h-4a2 2 0 0 0 0 4h4M16.5 14h.01"/>',
    chart:'<rect x="4" y="12" width="3.5" height="8" rx="1.75"/><rect x="10.3" y="8" width="3.5" height="12" rx="1.75"/><rect x="16.5" y="4" width="3.5" height="16" rx="1.75"/>',
    sparkle:'<path d="M11.1 4.4a1 1 0 0 1 1.8 0l1.5 4a2 2 0 0 0 1.2 1.2l4 1.5a1 1 0 0 1 0 1.8l-4 1.5a2 2 0 0 0-1.2 1.2l-1.5 4a1 1 0 0 1-1.8 0l-1.5-4a2 2 0 0 0-1.2-1.2l-4-1.5a1 1 0 0 1 0-1.8l4-1.5a2 2 0 0 0 1.2-1.2l1.5-4Z"/>',
    book:'<path d="M12 6c-2-1.5-5-2-8-1v14c3-1 6-.5 8 1 2-1.5 5-2 8-1V5c-3-1-6-.5-8 1Zm0 0v14"/><path d="M6.5 9h2M6.5 12h2M15.5 9h2M15.5 12h2"/>',
    settings:'<path d="M4 7h7m5 0h4M4 17h4m5 0h7"/><circle cx="13.5" cy="7" r="2.5"/><circle cx="10.5" cy="17" r="2.5"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5V4m0 16v1.5M2.5 12H4m16 0h1.5M5.3 5.3l1 1m11.4 11.4 1 1m0-13.4-1 1M6.3 17.7l-1 1"/>',
    moon:'<path d="M20.3 14a8.5 8.5 0 0 1-10.4-10.4A8.5 8.5 0 1 0 20.3 14Z"/>',
    menu:'<path class="menu-line menu-line-top" d="M5 6.5h14"/><path class="menu-line menu-line-middle" d="M5 12h14"/><path class="menu-line menu-line-bottom" d="M5 17.5h14"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    close:'<path d="m7 7 10 10M17 7 7 17"/>',
    info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5m0-8h.01"/>',
    'arrow-in':'<path d="M17 7 7 17M7 8v9h9"/>',
    'arrow-out':'<path d="M7 17 17 7M8 7h9v9"/>',
    transfer:'<path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4"/>',
    upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 15v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3"/>',
    download:'<path d="M12 4v12m-4-4 4 4 4-4M4 17v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1"/>',
    edit:'<path d="m14.5 5.5 4 4M5 15l10-10a2.8 2.8 0 0 1 4 4L9 19l-5 1 1-5Z"/>',
    trash:'<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l.8 12a2 2 0 0 0 2 2h6.4a2 2 0 0 0 2-2L18 7M10 11v6m4-6v6"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    'chevron-left':'<path d="m14 6-6 6 6 6"/>',
    'chevron-right':'<path d="m10 6 6 6-6 6"/>',
    filter:'<path d="M4 7h16M7 12h10m-7 5h4"/>',
  };
  if(name==='event')name='calendar';
  return `<svg class="icon soft-icon ${name==='menu'?'menu-icon':''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.sparkle}</svg>`;
}
function showToast(message,options={}) {
  const target=document.querySelector('#toast');if(!target)return;
  clearTimeout(toastTimer);
  target.setAttribute('data-tone',options.tone||'info');
  target.setAttribute('role',options.tone==='error'?'alert':'status');
  target.innerHTML=`<span class="toast-symbol">${softIcon(options.tone==='success'?'check':'info')}</span><span class="toast-message">${esc(message)}</span><button id="toastClose" type="button" aria-label="Tutup notifikasi">${softIcon('close')}</button>`;
  const close=()=>target.classList.remove('show');
  document.querySelector('#toastClose').onclick=close;
  target.classList.add('show');
  toastTimer=setTimeout(close,options.duration||5000);
}
function mobileNavigation(open) {
  const sidebar=document.querySelector('.sidebar'),menu=document.querySelector('#mobileMenu'),backdrop=document.querySelector('#sidebarBackdrop');
  if(!sidebar||!menu||!backdrop)return;
  const mobile=window.matchMedia?.('(max-width: 760px)').matches??false;
  open=Boolean(open&&mobile);
  const wasOpen=sidebar.classList.contains('open');
  sidebar.classList.toggle('open',open);backdrop.classList.toggle('visible',open);
  document.body.classList.toggle('menu-open',open);
  menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close menu':'Open menu');
  if(mobile&&!open)sidebar.setAttribute('inert','');else sidebar.removeAttribute('inert');
  const main=document.querySelector('.app-shell > main');
  if(open)main?.setAttribute('inert','');else main?.removeAttribute('inert');
  if(open)document.querySelector('#mobileSidebarCollapse')?.focus({preventScroll:true});
  else if(wasOpen)menu.focus({preventScroll:true});
}
function initSoftUi() {
  mobileNavigation(false);
  window.matchMedia?.('(max-width: 760px)').addEventListener('change',event=>{
    mobileNavigation(false);
    const details=document.getElementById('financeMoreFilters');if(details)details.open=!event.matches;
  });
  window.addEventListener('renova:notice',event=>showToast(event.detail.message,event.detail));
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&window.matchMedia?.('(max-width: 760px)').matches){
      const details=document.getElementById('financeMoreFilters');if(details?.open)details.open=false;
    }
    if(event.key!=='Tab'||!document.body.classList.contains('menu-open'))return;
    const controls=[...document.querySelectorAll('.sidebar button,.sidebar a[href]')].filter(el=>!el.disabled&&el.getClientRects().length);
    const first=controls[0],last=controls[controls.length-1];if(!first)return;
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  document.addEventListener('click',event=>{
    if(!window.matchMedia?.('(max-width: 760px)').matches)return;
    const details=document.getElementById('financeMoreFilters');
    if(details?.open&&!event.target.closest('.finance-filter-details'))details.open=false;
  });
}
function syncThemeChrome() {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',state.theme==='dark'?'#141c2a':'#fbf7fa');
}
