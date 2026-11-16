// Isolated local preview: no Supabase config or personal records are loaded.
const http=require('node:http'), fs=require('node:fs'), path=require('node:path');
const root=path.resolve(__dirname,'..');
const fixture={profile:{name:'Preview',nickname:'Preview',timezone:'Asia/Jakarta',currency:'IDR'},accounts:[{id:'cash',name:'Cash',type:'Cash',initial:1000000},{id:'bank',name:'Bank',type:'Bank',initial:2000000}],transactions:[{id:'expense',type:'Expense',date:'2026-11-16',amount:25000,accountId:'cash',category:'Food & groceries',description:'Lunch'},{id:'transfer',type:'Transfer',date:'2026-11-16',amount:100000,fromAccountId:'bank',toAccountId:'cash',description:'Cash withdrawal'}],tasks:[{id:'task1',title:'Review budget',description:'Check November spending',link:'https://example.com',due:'2026-11-16',status:'To do',priority:'High'}],events:[],goals:[],projects:[],journal:[],investments:[],budgets:[]};
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'){
    let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    html=html.replace('<script src="config.js"></script>',`<script>window.RENOVA_CONFIG={userId:'isolated-preview'};if(!localStorage.getItem('renova-v1:isolated-preview'))localStorage.setItem('renova-v1:isolated-preview',JSON.stringify(${JSON.stringify(fixture)}));</script>`);
    html=html.replace('</head>','<link rel="stylesheet" href="public/workspace-features.css"></head>');
    res.setHeader('Content-Type','text/html');return res.end(html);
  }
  if(!/^\/public\/[a-zA-Z0-9.-]+$/.test(url.pathname)){res.statusCode=404;return res.end();}
  const file=path.join(root,url.pathname.slice(1));if(!fs.existsSync(file)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'image/png');res.end(fs.readFileSync(file));
}).listen(4173,'127.0.0.1',()=>console.log('Isolated preview: http://127.0.0.1:4173'));
