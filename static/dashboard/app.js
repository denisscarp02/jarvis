// ═══════════ FinScope v10 — App Logic (Complete) ═══════════

const FK='d721451r01qjeeefflg0d721451r01qjeeefflgg',FH='https://finnhub.io/api/v1';
const FMP_KEY='oxySZoo7QEhfBVJMvwSc9ymKpx8fNL82';
const SB_URL='https://ttqnteimisiaaixsalhn.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0cW50ZWltaXNpYWFpeHNhbGhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjAwODEsImV4cCI6MjA5MDE5NjA4MX0.cWgDQZP4Q1COEssw318hPzR2bZ8jKi0cWc43qcsKIXM';

const D={stocks:[],etfs:[],bonds:[],commodities:[],crypto:[],currencies:[]};

// ═══ EUR CONVERSION ═══
let eurRates = {}; // { USD: 1.08, GBP: 0.86, ... } = 1 EUR in foreign currency

async function loadEurRates() {
  try {
    const r = await fetch('https://api.exchangerate-api.com/v4/latest/EUR', { signal: AbortSignal.timeout(8000) });
    if (r.ok) { const d = await r.json(); eurRates = d.rates || {}; console.log('[EUR] Rates loaded, USD=', eurRates.USD); }
  } catch(e) {
    try { const r2 = await fetch('https://open.er-api.com/v6/latest/EUR', { signal: AbortSignal.timeout(8000) }); if (r2.ok) { const d = await r2.json(); eurRates = d.rates || {}; } } catch(e2) {}
  }
}

function toEur(price, currency) {
  if (!price || price <= 0) return 0;
  if (!currency || currency === 'EUR' || currency === 'Euro') return price;
  const cur = currency.toUpperCase();
  const rate = eurRates[cur];
  if (rate && rate > 0) return price / rate;
  // Common fallbacks
  if (cur === 'USD' || cur === 'USX') return price / (eurRates.USD || 1.08);
  if (cur === 'GBP' || cur === 'GBp') return (cur === 'GBp' ? price / 100 : price) / (eurRates.GBP || 0.86);
  return price; // unknown currency, return as-is
}

// ═══ ASSET DATABASES (COMPLETE — all originals) ═══
const A_STOCKS=[
  {s:'AAPL',n:'Apple',r:'US'},{s:'MSFT',n:'Microsoft',r:'US'},{s:'GOOGL',n:'Alphabet',r:'US'},
  {s:'AMZN',n:'Amazon',r:'US'},{s:'NVDA',n:'NVIDIA',r:'US'},{s:'META',n:'Meta',r:'US'},
  {s:'TSLA',n:'Tesla',r:'US'},{s:'NFLX',n:'Netflix',r:'US'},{s:'AMD',n:'AMD',r:'US'},
  {s:'JPM',n:'JPMorgan',r:'US'},{s:'V',n:'Visa',r:'US'},{s:'DIS',n:'Disney',r:'US'},
  {s:'ENI.MI',n:'Eni',r:'IT',fh:''},{s:'ENEL.MI',n:'Enel',r:'IT',fh:''},
  {s:'ISP.MI',n:'Intesa Sanpaolo',r:'IT',fh:''},{s:'UCG.MI',n:'UniCredit',r:'IT',fh:''},
  {s:'STLAM.MI',n:'Stellantis',r:'IT',fh:''},{s:'RACE',n:'Ferrari',r:'IT'},
  {s:'BMW.DE',n:'BMW',r:'DE',fh:''},{s:'VOW3.DE',n:'Volkswagen',r:'DE',fh:''},
  {s:'MBG.DE',n:'Mercedes-Benz',r:'DE',fh:''},{s:'P911.DE',n:'Porsche AG',r:'DE',fh:''},
  {s:'AML.L',n:'Aston Martin',r:'UK',fh:''},{s:'STLA',n:'Stellantis NL',r:'NL'},
  {s:'MC.PA',n:'LVMH',r:'FR',fh:''},{s:'RMS.PA',n:'Hermes',r:'FR',fh:''},
  {s:'ASML',n:'ASML',r:'NL'},{s:'SAP',n:'SAP',r:'DE'},
  {s:'BABA',n:'Alibaba',r:'CN'},{s:'TSM',n:'TSMC',r:'TW'}
];
const A_ETFS=[
  {s:'SPY',n:'SPDR S&P 500'},{s:'QQQ',n:'Invesco Nasdaq 100'},
  {s:'VTI',n:'Vanguard Total Stock'},{s:'VOO',n:'Vanguard S&P 500'},
  {s:'GLD',n:'SPDR Gold'},{s:'SLV',n:'iShares Silver'},
  {s:'ARKK',n:'ARK Innovation'},{s:'IBIT',n:'iShares Bitcoin Trust'},
  {s:'ETHE',n:'Grayscale Ethereum'},
  {s:'VWCE.DE',n:'Vanguard FTSE All-World',fh:''},
  {s:'SWDA.L',n:'iShares MSCI World',fh:''},
  {s:'CSPX.L',n:'iShares S&P 500 EUR',fh:''}
];
const A_BONDS=[
  {s:'TLT',n:'iShares 20+ Year Bond'},{s:'BND',n:'Vanguard Total Bond'},
  {s:'LQD',n:'iShares IG Corporate'},{s:'HYG',n:'iShares High Yield'},
  {s:'AGG',n:'iShares Core US Agg Bond'},{s:'SHY',n:'iShares 1-3Y Treasury'},
  {s:'TIPS',n:'iShares TIPS Bond'},{s:'EMB',n:'iShares EM Bond'}
];
const A_COMM=[
  {s:'GC=F',n:'Oro',fh:''},{s:'SI=F',n:'Argento',fh:''},
  {s:'CL=F',n:'Petrolio WTI',fh:''},{s:'BZ=F',n:'Petrolio Brent',fh:''},
  {s:'NG=F',n:'Gas Naturale',fh:''},{s:'HG=F',n:'Rame',fh:''},
  {s:'PL=F',n:'Platino',fh:''},{s:'ZW=F',n:'Grano',fh:''},
  {s:'CC=F',n:'Cacao',fh:''},{s:'KC=F',n:'Caffe',fh:''}
];
const A_CRYPTO=[
  {s:'BTC-USD',n:'Bitcoin',fh:''},{s:'ETH-USD',n:'Ethereum',fh:''},
  {s:'XRP-USD',n:'XRP',fh:''},{s:'SOL-USD',n:'Solana',fh:''},
  {s:'ADA-USD',n:'Cardano',fh:''},{s:'DOGE-USD',n:'Dogecoin',fh:''},
  {s:'DOT-USD',n:'Polkadot',fh:''},{s:'AVAX-USD',n:'Avalanche',fh:''},
  {s:'LINK-USD',n:'Chainlink',fh:''},{s:'BNB-USD',n:'BNB',fh:''},
  {s:'UNI-USD',n:'Uniswap',fh:''}
];
const A_FX=[
  {p:'EUR/USD',y:'EURUSD=X'},{p:'EUR/GBP',y:'EURGBP=X'},
  {p:'EUR/CHF',y:'EURCHF=X'},{p:'EUR/JPY',y:'EURJPY=X'},
  {p:'USD/JPY',y:'USDJPY=X'},{p:'GBP/USD',y:'GBPUSD=X'},
  {p:'USD/CHF',y:'USDCHF=X'},{p:'AUD/USD',y:'AUDUSD=X'},
  {p:'EUR/TRY',y:'EURTRY=X'},{p:'BTC/USD',y:'BTC-USD'},
  {p:'ETH/USD',y:'ETH-USD'}
];
const ALL_DB={stocks:A_STOCKS,etfs:A_ETFS,bonds:A_BONDS,comm:A_COMM,crypto:A_CRYPTO,currencies:A_FX};
const DK=k=>k==='comm'?'commodities':k;

// ═══ HELPERS ═══
const fmt=(n,d=2)=>n!=null?Number(n).toLocaleString('it-IT',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const pf=n=>n!=null?(n>=0?'+':'')+fmt(n)+'%':'—';
const srcBadge=s=>`<span class="sr ${s==='Finnhub'?'s-fh':s==='FMP'?'s-fp':s==='Yahoo'?'s-yh':'s-na'}">${s||'N/A'}</span>`;

// ═══ API FUNCTIONS ═══
let fhOk=true,fhN=0,fhT=Date.now()+60000;

async function fhQuote(s){
  if(!fhOk||!s)return null;
  if(Date.now()>fhT){fhN=0;fhT=Date.now()+60000}
  if(fhN>=28)return null;fhN++;
  try{
    const r=await fetch(`${FH}/quote?symbol=${encodeURIComponent(s)}&token=${FK}`,{signal:AbortSignal.timeout(6000)});
    if(r.status===401||r.status===403){fhOk=false;return null}
    if(!r.ok)return null;
    const d=await r.json();
    if(d?.c>0)return{p:d.c,ch:d.dp||0,o:d.o,h:d.h,l:d.l,cur:'USD',src:'Finnhub'};
  }catch(e){}
  return null;
}

async function fmpQuote(sym){
  try{
    const r=await fetch(`https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(sym)}?apikey=${FMP_KEY}`,{signal:AbortSignal.timeout(7000)});
    if(!r.ok)return null;
    const d=await r.json();
    if(Array.isArray(d)&&d[0]){
      const q=d[0];
      if(q.price>0)return{p:q.price,ch:q.changesPercentage||0,o:q.open||0,h:q.dayHigh||0,l:q.dayLow||0,cur:q.currency||'',src:'FMP'};
    }
  }catch(e){}
  return null;
}

const PX=[
  u=>'https://api.allorigins.win/raw?url='+encodeURIComponent(u),
  u=>'https://corsproxy.io/?url='+encodeURIComponent(u),
  u=>'https://api.codetabs.com/v1/proxy?quest='+encodeURIComponent(u)
];
let pxi=0;

async function yhQuote(s){
  const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(s)+'?interval=1d&range=5d';
  for(let i=0;i<PX.length;i++){
    const idx=(pxi+i)%PX.length;
    try{
      const res=await fetch(PX[idx](url),{signal:AbortSignal.timeout(8000)});
      if(!res.ok)continue;
      const data=await res.json();
      const r=data?.chart?.result?.[0];
      if(r){
        pxi=idx;
        const m=r.meta||{},q=r.indicators?.quote?.[0]||{};
        const cl=(q.close||[]).filter(v=>v!=null);
        const p=m.regularMarketPrice||cl[cl.length-1]||0;
        const pc=m.chartPreviousClose||cl[cl.length-2]||p;
        if(p>0)return{p:+p.toFixed(4),ch:pc?+((p-pc)/pc*100).toFixed(2):0,o:+(m.regularMarketOpen||0).toFixed(4),h:+(m.regularMarketDayHigh||0).toFixed(4),l:+(m.regularMarketDayLow||0).toFixed(4),cur:m.currency||'',src:'Yahoo'};
      }
    }catch(e){}
  }
  return null;
}

async function getQuote(sym,fhSym){
  if(fhSym!==''&&fhSym&&fhOk){const q=await fhQuote(fhSym);if(q)return q}
  const fmp=await fmpQuote(sym);if(fmp)return fmp;
  return await yhQuote(sym);
}

function getSignal(d){
  if(!d||d.p<=0)return{label:'N/D',cls:'sg-wait'};
  const ch=d.ch||0;
  const range=(d.h>0&&d.l>0&&d.h!==d.l)?(d.p-d.l)/(d.h-d.l):0.5;
  let score=0;
  if(ch<=-3)score+=35;else if(ch<=-1.5)score+=20;else if(ch<=-0.5)score+=10;
  else if(ch>=3)score-=30;else if(ch>=1.5)score-=15;else if(ch>=0.5)score-=5;
  if(range<0.2)score+=20;else if(range<0.35)score+=10;
  else if(range>0.85)score-=20;else if(range>0.7)score-=10;
  if(score>=8)return{label:'COMPRA',cls:'sg-buy'};
  if(score<=-8)return{label:'VENDI',cls:'sg-sell'};
  if(Math.abs(ch)<0.3)return{label:'ATTENDI',cls:'sg-wait'};
  return{label:'TIENI',cls:'sg-hold'};
}

// ═══ TV SYMBOL MAPPING ═══
function toTV(s){
  const m={'GC=F':'COMEX:GC1!','SI=F':'COMEX:SI1!','CL=F':'NYMEX:CL1!','BZ=F':'NYMEX:BB1!','NG=F':'NYMEX:NG1!','HG=F':'COMEX:HG1!','PL=F':'NYMEX:PL1!','ZW=F':'CBOT:ZW1!','ZC=F':'CBOT:ZC1!','CC=F':'ICEUS:CC1!','KC=F':'ICEUS:KC1!','BTC-USD':'BITSTAMP:BTCUSD','ETH-USD':'BITSTAMP:ETHUSD','XRP-USD':'BITSTAMP:XRPUSD','SOL-USD':'COINBASE:SOLUSD','ADA-USD':'BITSTAMP:ADAUSD','DOGE-USD':'BINANCE:DOGEUSD','DOT-USD':'BITSTAMP:DOTUSD','AVAX-USD':'COINBASE:AVAXUSD','LINK-USD':'COINBASE:LINKUSD','BNB-USD':'BINANCE:BNBUSD','UNI-USD':'COINBASE:UNIUSD'};
  if(m[s])return m[s];
  if(s.includes('=X'))return'FX:'+s.replace('=X','');
  if(s.startsWith('^'))return'TVC:'+s.substring(1);
  if(s.endsWith('.MI'))return'MIL:'+s.replace('.MI','');
  if(s.endsWith('.DE'))return'XETR:'+s.replace('.DE','');
  if(s.endsWith('.PA'))return'EURONEXT:'+s.replace('.PA','');
  if(s.endsWith('.L'))return'LSE:'+s.replace('.L','');
  return s;
}
function toTVChart(s){
  const cm={'GC=F':'TVC:GOLD','SI=F':'TVC:SILVER','CL=F':'TVC:USOIL','BZ=F':'TVC:UKOIL','NG=F':'PEPPERSTONE:NATGAS','HG=F':'TVC:COPPER','PL=F':'TVC:PLATINUM','CC=F':'TVC:COCOA','KC=F':'TVC:COFFEE'};
  if(cm[s])return cm[s];
  return toTV(s);
}

// ═══ TRADINGVIEW WIDGETS ═══
function tvWidget(containerId,widgetType,config){
  const el=document.getElementById(containerId);if(!el)return;
  el.innerHTML='';
  const wrap=document.createElement('div');
  wrap.className='tradingview-widget-container';
  wrap.style.cssText='width:100%;height:100%';
  const inner=document.createElement('div');
  inner.className='tradingview-widget-container__widget';
  inner.style.cssText='width:100%;height:100%';
  wrap.appendChild(inner);
  const sc=document.createElement('script');
  sc.type='text/javascript';
  sc.src='https://s3.tradingview.com/external-embedding/'+widgetType+'.js';
  sc.async=true;
  sc.textContent=JSON.stringify(config);
  wrap.appendChild(sc);
  el.appendChild(wrap);
}

function tvAdvancedChartDirect(id,tvSym){
  const el=document.getElementById(id);if(!el)return;
  el.innerHTML='';
  const iframe=document.createElement('iframe');
  iframe.src='https://s.tradingview.com/widgetembed/?frameElementId='+id
    +'&symbol='+encodeURIComponent(tvSym)
    +'&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=0'
    +'&toolbarbg=030608&theme=dark&style=1'
    +'&timezone=Europe%2FRome&withdateranges=1&showpopupbutton=0&studies=[]&locale=it';
  iframe.style.cssText='width:100%;height:100%;border:none;border-radius:10px';
  iframe.allow='fullscreen';
  iframe.loading='lazy';
  el.appendChild(iframe);
}
function tvAdvancedChart(id,sym){tvAdvancedChartDirect(id,toTVChart(sym))}
function tvSymbolOverview(id,sym){
  tvWidget(id,'embed-widget-symbol-overview',{
    symbols:[[toTVChart(sym),toTVChart(sym)]],chartOnly:false,width:'100%',height:'100%',
    locale:'it',colorTheme:'dark',autosize:true,showVolume:true,showMA:true,
    chartType:'area',lineColor:'#00c8e0',topColor:'rgba(0,200,224,0.25)',bottomColor:'rgba(0,200,224,0.02)',
    lineWidth:2,backgroundColor:'rgba(3,6,8,1)',gridLineColor:'rgba(0,180,220,0.05)'
  });
}
function tvMarketOverview(id,tabs){
  tvWidget(id,'embed-widget-market-overview',{
    colorTheme:'dark',dateRange:'1D',showChart:true,locale:'it',isTransparent:true,
    showSymbolLogo:true,showFloatingTooltip:true,width:'100%',height:'100%',
    plotLineColorGrowing:'rgba(0,200,224,1)',plotLineColorFalling:'rgba(239,68,68,1)',
    gridLineColor:'rgba(0,180,220,0.05)',scaleFontColor:'rgba(80,88,120,1)',
    belowLineFillColorGrowing:'rgba(0,200,224,0.1)',belowLineFillColorFalling:'rgba(239,68,68,0.06)',
    belowLineFillColorGrowingBottom:'rgba(0,200,224,0)',belowLineFillColorFallingBottom:'rgba(239,68,68,0)',
    symbolActiveColor:'rgba(0,200,224,0.1)',tabs
  });
}

function initWidgets(){
  tvMarketOverview('tv-mkt-us',[{title:'USA',symbols:[{s:'FOREXCOM:SPXUSD',d:'S&P 500'},{s:'FOREXCOM:NSXUSD',d:'Nasdaq 100'},{s:'FOREXCOM:DJI',d:'Dow Jones'},{s:'AMEX:IWM',d:'Russell 2000'}],originalTitle:'USA'}]);
  tvMarketOverview('tv-mkt-eu',[{title:'Europa',symbols:[{s:'INDEX:DEU40',d:'DAX'},{s:'MIL:FTSEMIB',d:'FTSE MIB'},{s:'INDEX:CAC40',d:'CAC 40'},{s:'INDEX:UKX',d:'FTSE 100'}],originalTitle:'Europa'}]);
  tvAdvancedChartDirect('tv-mkt-crypto','BITSTAMP:BTCUSD');
  tvAdvancedChartDirect('tv-mkt-comm','TVC:GOLD');
  tvAdvancedChartDirect('tv-mkt-fx','FX:EURUSD');
  tvWidget('tv-screener','embed-widget-screener',{width:'100%',height:'100%',defaultColumn:'overview',defaultScreen:'most_capitalized',market:'italy',showToolbar:true,colorTheme:'dark',locale:'it',isTransparent:true});
  tvWidget('tv-news','embed-widget-timeline',{feedMode:'market',market:'stock',colorTheme:'dark',isTransparent:true,displayMode:'regular',width:'100%',height:'100%',locale:'it'});
  tvWidget('tv-news-crypto','embed-widget-timeline',{feedMode:'market',market:'crypto',colorTheme:'dark',isTransparent:true,displayMode:'regular',width:'100%',height:'100%',locale:'it'});
  tvWidget('tv-calendar','embed-widget-events',{colorTheme:'dark',isTransparent:true,width:'100%',height:'100%',locale:'it',importanceFilter:'-1,0,1'});
  tvAdvancedChart('tv-chart-stocks','AAPL');
  tvAdvancedChart('tv-chart-etfs','SPY');
  tvAdvancedChart('tv-chart-bonds','TLT');
  tvAdvancedChartDirect('tv-chart-comm','TVC:GOLD');
  tvAdvancedChart('tv-chart-crypto','BTC-USD');
  tvAdvancedChart('tv-chart-fx','EURUSD=X');
  tvSymbolOverview('tv-chart-apple','AAPL');
}

// ═══ TABLE BUILD ═══
let currentSort={};

function initSortButtons(key){
  const el=document.getElementById('srt-'+key);if(!el)return;
  el.innerHTML=['Migliori','Peggiori','Prezzo ▲','Prezzo ▼','Default'].map((l,i)=>{
    const sorts=['best','worst','priceHigh','priceLow','default'];
    return`<button onclick="sortTable('${key}','${sorts[i]}',this)" class="${currentSort[key]===sorts[i]?'on':''}">${l}</button>`;
  }).join('');
}

function sortTable(key,sortType,btn){
  const dk=DK(key);const isFX=key==='currencies';
  const tblMap={stocks:'tbl-stocks',etfs:'tbl-etfs',bonds:'tbl-bonds',comm:'tbl-comm',crypto:'tbl-crypto',currencies:'tbl-fx'};
  if(currentSort[key]===sortType){currentSort[key]='default';sortType='default'}else currentSort[key]=sortType;
  const srtEl=document.getElementById('srt-'+key);
  if(srtEl)srtEl.querySelectorAll('button').forEach(b=>b.classList.remove('on'));
  if(btn&&sortType!=='default')btn.classList.add('on');
  const data=[...D[dk]];
  if(sortType==='best')data.sort((a,b)=>(b.ch||0)-(a.ch||0));
  else if(sortType==='worst')data.sort((a,b)=>(a.ch||0)-(b.ch||0));
  else if(sortType==='priceHigh')data.sort((a,b)=>(b.p||0)-(a.p||0));
  else if(sortType==='priceLow')data.sort((a,b)=>(a.p||0)-(b.p||0));
  if(sortType!=='default')D[dk]=[...data];
  buildTable(tblMap[key]||tblMap[dk],D[dk],key,isFX);
  initSortButtons(key);
}

function buildTable(containerId,data,key,isFX){
  const el=document.getElementById(containerId);if(!el)return;
  if(!data.length){el.innerHTML='<div class="ld"><div class="sp"></div> Caricamento dati...</div>';return}
  let h='<div class="tw"><table><thead><tr><th>Ticker</th><th>Nome</th><th>Prezzo EUR</th><th>Var %</th><th>Segnale</th><th>Src</th></tr></thead><tbody>';
  data.forEach((d,i)=>{
    const sig=getSignal(d);
    const sym=isFX?d.pair:d.sym;const name=isFX?'':d.name||'';
    // Convert to EUR
    const eurPrice = isFX ? d.p : toEur(d.p, d.cur);
    const dp = eurPrice < 1 ? 4 : eurPrice < 100 ? 2 : eurPrice > 10000 ? 0 : 2;
    h+=`<tr onclick="${isFX?'selFX':'selAsset'}('${key}',${i})" id="${key}_r${i}" data-sym="${(sym||'').toLowerCase()}" data-name="${(name||'').toLowerCase()}">`;
    h+=`<td><span class="tk">${sym}</span></td><td class="nm2">${name}</td>`;
    h+=`<td class="mono">${eurPrice>0 ? (isFX ? fmt(eurPrice, dp) : '€' + fmt(eurPrice, dp)) : '—'}</td>`;
    h+=`<td class="${(d.ch||0)>=0?'po':'ne'} mono">${d.p>0?pf(d.ch):'—'}</td>`;
    h+=`<td><span class="${sig.cls}">${sig.label}</span></td>`;
    h+=`<td>${srcBadge(d.src)}</td></tr>`;
  });
  el.innerHTML=h+'</tbody></table></div>';
  initSortButtons(key);
}

function filterTable(key){
  const q=document.getElementById('search-'+key)?.value.toLowerCase().trim()||'';
  const tblMap={stocks:'tbl-stocks',etfs:'tbl-etfs',bonds:'tbl-bonds',comm:'tbl-comm',crypto:'tbl-crypto',currencies:'tbl-fx'};
  const el=document.getElementById(tblMap[key]);if(!el)return;
  el.querySelectorAll('tbody tr').forEach(tr=>{
    const sym=tr.dataset.sym||'';const name=tr.dataset.name||'';
    tr.style.display=(!q||sym.includes(q)||name.includes(q))?'':'none';
  });
}

function selAsset(key,idx){
  const data=D[DK(key)];const d=data[idx];if(!d)return;
  document.querySelectorAll(`[id^="${key}_r"]`).forEach(r=>r.classList.remove('sel'));
  document.getElementById(key+'_r'+idx)?.classList.add('sel');
  const chartMap={stocks:'tv-chart-stocks',etfs:'tv-chart-etfs',bonds:'tv-chart-bonds',comm:'tv-chart-comm',crypto:'tv-chart-crypto'};
  const chartId=chartMap[key];
  if(chartId)tvAdvancedChartDirect(chartId,toTVChart(d.sym));
}
function selFX(key,idx){
  const d=D.currencies[idx];if(!d)return;
  document.querySelectorAll('[id^="currencies_r"]').forEach(r=>r.classList.remove('sel'));
  document.getElementById('currencies_r'+idx)?.classList.add('sel');
  tvAdvancedChart('tv-chart-fx',d.ySym||d.pair.replace('/','')+'=X');
}

// ═══ FETCH ALL DATA ═══
async function bat(items,fn,size=3){
  const o=[];
  for(let i=0;i<items.length;i+=size){
    const b=items.slice(i,i+size);
    const r=await Promise.allSettled(b.map(fn));
    o.push(...r.map(x=>x.status==='fulfilled'?x.value:null));
  }
  return o.filter(Boolean);
}

let firstLoad=true;
async function fetchAll(){
  console.log('[FinScope] Fetching all data...');

  // Show loading in all tables
  if(firstLoad){
    ['tbl-stocks','tbl-etfs','tbl-bonds','tbl-comm','tbl-crypto','tbl-fx'].forEach(id=>{
      const el=document.getElementById(id);
      if(el)el.innerHTML='<div class="ld"><div class="sp"></div> Caricamento...</div>';
    });
  }

  // STOCKS
  D.stocks=await bat(A_STOCKS,async a=>{
    const fhS=a.fh!==undefined?a.fh:a.s;
    const q=await getQuote(a.s,fhS);
    return q?{sym:a.s,name:a.n,...q}:{sym:a.s,name:a.n,p:0,ch:0,o:0,h:0,l:0,cur:'',src:'N/A'};
  });
  buildTable('tbl-stocks',D.stocks,'stocks');
  console.log('[FinScope] Stocks loaded:',D.stocks.length);

  // ETFs
  D.etfs=await bat(A_ETFS,async a=>{
    const fhS=a.fh!==undefined?a.fh:a.s;
    const q=await getQuote(a.s,fhS);
    return q?{sym:a.s,name:a.n,...q}:{sym:a.s,name:a.n,p:0,ch:0,o:0,h:0,l:0,cur:'',src:'N/A'};
  });
  buildTable('tbl-etfs',D.etfs,'etfs');
  console.log('[FinScope] ETFs loaded:',D.etfs.length);

  // BONDS
  D.bonds=await bat(A_BONDS,async a=>{
    const q=await getQuote(a.s,'');
    return q?{sym:a.s,name:a.n,...q}:{sym:a.s,name:a.n,p:0,ch:0,o:0,h:0,l:0,cur:'',src:'N/A'};
  });
  buildTable('tbl-bonds',D.bonds,'bonds');
  console.log('[FinScope] Bonds loaded:',D.bonds.length);

  // COMMODITIES
  D.commodities=await bat(A_COMM,async a=>{
    const q=await yhQuote(a.s)||await fmpQuote(a.s);
    return q?{sym:a.s,name:a.n,...q}:{sym:a.s,name:a.n,p:0,ch:0,o:0,h:0,l:0,cur:'',src:'N/A'};
  });
  buildTable('tbl-comm',D.commodities,'comm');
  console.log('[FinScope] Commodities loaded:',D.commodities.length);

  // CRYPTO
  D.crypto=await bat(A_CRYPTO,async a=>{
    const q=await yhQuote(a.s)||await fmpQuote(a.s);
    return q?{sym:a.s,name:a.n,...q}:{sym:a.s,name:a.n,p:0,ch:0,o:0,h:0,l:0,cur:'',src:'N/A'};
  });
  buildTable('tbl-crypto',D.crypto,'crypto');
  console.log('[FinScope] Crypto loaded:',D.crypto.length);

  // CURRENCIES
  D.currencies=await bat(A_FX,async f=>{
    const q=await yhQuote(f.y);
    return q?{pair:f.p,ySym:f.y,...q}:{pair:f.p,ySym:f.y,p:0,ch:0,o:0,h:0,l:0,cur:'',src:'N/A'};
  });
  buildTable('tbl-fx',D.currencies,'currencies',true);
  console.log('[FinScope] Currencies loaded:',D.currencies.length);

  firstLoad=false;

  // Save to Supabase
  try{await saveToSupabase()}catch(e){}
}

// ═══ SUPABASE ═══
async function saveToSupabase(){
  const rows=[];
  for(const[section,data]of Object.entries({stocks:D.stocks,etfs:D.etfs,bonds:D.bonds,commodities:D.commodities,crypto:D.crypto,currencies:D.currencies})){
    for(const d of data){
      if(!d||d.p<=0)continue;
      rows.push({symbol:d.sym||d.pair||'',section,name:d.name||'',price:d.p,change_pct:d.ch||0,open_price:d.o||0,high:d.h||0,low:d.l||0,currency:d.cur||'',source:d.src||''});
    }
  }
  if(!rows.length)return;
  for(let i=0;i<rows.length;i+=50){
    try{await fetch(SB_URL+'/rest/v1/price_snapshots',{method:'POST',headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Prefer':'return=minimal'},body:JSON.stringify(rows.slice(i,i+50)),signal:AbortSignal.timeout(10000)})}catch(e){}
  }
}

// ═══ ADD MODAL ═══
let addKey='';
function openAdd(key){addKey=key;document.getElementById('addTitle').textContent='Aggiungi Asset';['addUrl','addIsin','addManualSym','addManualName'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});document.getElementById('addUrlResult').innerHTML='';document.getElementById('addModal').classList.add('open')}
function closeAdd(){document.getElementById('addModal').classList.remove('open');addKey=''}

async function addAsset(sym,name){
  const dk=DK(addKey);
  if(D[dk]&&D[dk].find(x=>(x.sym||x.pair)===sym))return;
  const q=await getQuote(sym,sym);
  const item=q?{sym,name,...q,custom:true}:{sym,name,p:0,ch:0,o:0,h:0,l:0,cur:'',src:'N/A',custom:true};
  D[dk].unshift(item);
  const tblMap={stocks:'tbl-stocks',etfs:'tbl-etfs',bonds:'tbl-bonds',comm:'tbl-comm',commodities:'tbl-comm',crypto:'tbl-crypto',currencies:'tbl-fx'};
  buildTable(tblMap[addKey]||tblMap[dk],D[dk],addKey,addKey==='currencies');
}

async function addFromUrl(){
  const manSym=document.getElementById('addManualSym').value.trim().toUpperCase();
  const manName=document.getElementById('addManualName').value.trim();
  const urlVal=document.getElementById('addUrl').value.trim();
  const isinVal=document.getElementById('addIsin').value.trim();
  const resEl=document.getElementById('addUrlResult');
  resEl.innerHTML='<div class="ld"><div class="sp"></div></div>';
  let sym='',name='';
  if(manSym){sym=manSym;name=manName||manSym}
  else if(isinVal){
    try{const r=await fetch(`https://financialmodelingprep.com/api/v3/search?query=${isinVal}&apikey=${FMP_KEY}`,{signal:AbortSignal.timeout(8000)});if(r.ok){const d=await r.json();if(d[0]){sym=d[0].symbol;name=d[0].name||sym}}}catch(e){}
    if(!sym){resEl.innerHTML='<span style="color:var(--rd)">ISIN non trovato</span>';return}
  }
  else if(urlVal){
    let m=urlVal.match(/finance\.yahoo\.com\/quote\/([A-Za-z0-9\.\-\=\^]+)/);if(m){sym=m[1]}
    if(!m){m=urlVal.match(/tradingview\.com\/symbols\/(?:[A-Z]+\-)?([A-Za-z0-9\.\-]+)/);if(m)sym=m[1]}
    if(!m){m=urlVal.match(/google\.com\/finance\/quote\/([A-Za-z0-9\.\-]+)/);if(m)sym=m[1].split(':')[0]}
    if(!sym){resEl.innerHTML='<span style="color:var(--rd)">URL non riconosciuto</span>';return}
    name=sym;
  }
  else{resEl.innerHTML='<span style="color:var(--or)">Inserisci dati</span>';return}
  if(sym){await addAsset(sym,name);resEl.innerHTML=`<span style="color:var(--gn)">${sym} aggiunto!</span>`;['addUrl','addIsin','addManualSym','addManualName'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''})}
}

// ═══ APPLE TRACKER ═══
const APPLE_DB=[
  {cat:'iPhone',name:'iPhone 17 Pro Max',chip:'A19 Pro',year:2025,price:1499},{cat:'iPhone',name:'iPhone 17 Pro',chip:'A19 Pro',year:2025,price:1199},{cat:'iPhone',name:'iPhone 17 Air',chip:'A19',year:2025,price:999},{cat:'iPhone',name:'iPhone 17',chip:'A19',year:2025,price:899},
  {cat:'iPhone',name:'iPhone 16 Pro Max',chip:'A18 Pro',year:2024,price:1449},{cat:'iPhone',name:'iPhone 16 Pro',chip:'A18 Pro',year:2024,price:1199},{cat:'iPhone',name:'iPhone 16',chip:'A18',year:2024,price:899},
  {cat:'iPhone',name:'iPhone 15 Pro Max',chip:'A17 Pro',year:2023,price:1449},{cat:'iPhone',name:'iPhone 15 Pro',chip:'A17 Pro',year:2023,price:1199},{cat:'iPhone',name:'iPhone 15',chip:'A16',year:2023,price:879},
  {cat:'iPhone',name:'iPhone 14 Pro Max',chip:'A16 Pro',year:2022,price:1309},{cat:'iPhone',name:'iPhone 14 Pro',chip:'A16 Pro',year:2022,price:1179},{cat:'iPhone',name:'iPhone 14',chip:'A15',year:2022,price:869},
  {cat:'iPhone',name:'iPhone 13',chip:'A15',year:2021,price:829},{cat:'iPhone',name:'iPhone 12',chip:'A14',year:2020,price:829},{cat:'iPhone',name:'iPhone 11',chip:'A13',year:2019,price:699},
  {cat:'MacBook Pro',name:'MBP 14" M4 Pro',chip:'M4 Pro',year:2024,price:2249},{cat:'MacBook Pro',name:'MBP 16" M4 Pro',chip:'M4 Pro',year:2024,price:2749},{cat:'MacBook Pro',name:'MBP 14" M4 Max',chip:'M4 Max',year:2024,price:3499},{cat:'MacBook Pro',name:'MBP 14" M3 Pro',chip:'M3 Pro',year:2023,price:2249},{cat:'MacBook Pro',name:'MBP 16" M3 Max',chip:'M3 Max',year:2023,price:3999},
  {cat:'MacBook Air',name:'MBA 13" M4',chip:'M4',year:2025,price:1249},{cat:'MacBook Air',name:'MBA 15" M4',chip:'M4',year:2025,price:1449},{cat:'MacBook Air',name:'MBA 13" M3',chip:'M3',year:2024,price:1249},
  {cat:'iPad',name:'iPad Pro 13" M4',chip:'M4',year:2024,price:1399},{cat:'iPad',name:'iPad Pro 11" M4',chip:'M4',year:2024,price:1099},{cat:'iPad',name:'iPad Air 13" M3',chip:'M3',year:2025,price:899},{cat:'iPad',name:'iPad Air 11" M3',chip:'M3',year:2025,price:699},
  {cat:'Apple Watch',name:'Watch Ultra 3',chip:'S11',year:2025,price:899},{cat:'Apple Watch',name:'Watch Series 11',chip:'S11',year:2025,price:459},{cat:'Apple Watch',name:'Watch Series 10',chip:'S10',year:2024,price:459},
  {cat:'AirPods',name:'AirPods Pro 3',chip:'H3',year:2025,price:279},{cat:'AirPods',name:'AirPods Pro 2',chip:'H2',year:2023,price:279},{cat:'AirPods',name:'AirPods Max 2',chip:'H2',year:2024,price:579},
  {cat:'Mac',name:'Mac mini M4 Pro',chip:'M4 Pro',year:2024,price:1499},{cat:'Mac',name:'Mac mini M4',chip:'M4',year:2024,price:699},{cat:'Mac',name:'iMac 24" M4',chip:'M4',year:2024,price:1449},
  {cat:'Vision',name:'Apple Vision Pro',chip:'M2 + R1',year:2024,price:3999}
];
const APPLE_CATS=[...new Set(APPLE_DB.map(d=>d.cat))];
let appleCatFilter='';

function buildApple(){
  const btnEl=document.getElementById('appleCatBtns');if(!btnEl)return;
  btnEl.innerHTML='<button onclick="filterAppleCat(\'\')" class="applecat-btn" style="padding:3px 8px;border:1px solid var(--glass-border);border-radius:6px;background:linear-gradient(135deg,var(--cyan),var(--purple));color:#fff;font-size:8px;cursor:pointer;font-weight:600;font-family:var(--font)">Tutti</button>'+APPLE_CATS.map(c=>`<button onclick="filterAppleCat('${c}')" class="applecat-btn" style="padding:3px 8px;border:1px solid var(--glass-border);border-radius:6px;background:transparent;color:var(--tx3);font-size:8px;cursor:pointer;font-weight:600;font-family:var(--font)">${c}</button>`).join('');
  populateAppleDropdowns();
}
function filterAppleCat(cat){appleCatFilter=cat;document.querySelectorAll('.applecat-btn').forEach(b=>{const match=b.textContent===cat||(cat===''&&b.textContent==='Tutti');b.style.background=match?'linear-gradient(135deg,var(--cyan),var(--purple))':'transparent';b.style.color=match?'#fff':'var(--tx3)'});populateAppleDropdowns()}
function populateAppleDropdowns(){const filtered=appleCatFilter?APPLE_DB.filter(d=>d.cat===appleCatFilter):APPLE_DB;const grouped={};filtered.forEach(d=>{if(!grouped[d.cat])grouped[d.cat]=[];grouped[d.cat].push(d)});let opts='<option value="">Seleziona...</option>';for(const cat of Object.keys(grouped)){opts+=`<optgroup label="${cat}">`;grouped[cat].forEach(d=>{const gIdx=APPLE_DB.indexOf(d);opts+=`<option value="${gIdx}">${d.name} (${d.year})</option>`});opts+='</optgroup>'}document.getElementById('appleMio').innerHTML=opts;document.getElementById('appleTarget').innerHTML=opts;document.getElementById('appleResult').style.display='none'}
function appleCompare(){const mIdx=document.getElementById('appleMio').value;const tIdx=document.getElementById('appleTarget').value;const resEl=document.getElementById('appleResult');if(mIdx===''||tIdx===''){resEl.style.display='none';return}const mio=APPLE_DB[+mIdx],tgt=APPLE_DB[+tIdx];const yearDiff=tgt.year-mio.year;const priceDiff=tgt.price-mio.price;const isUp=tgt.year>mio.year||(tgt.year===mio.year&&tgt.price>mio.price);let advice,acls;if(mIdx===tIdx){advice='Stesso dispositivo!';acls='color:var(--or)'}else if(isUp){advice=yearDiff>=3?'Upgrade fortemente consigliato!':yearDiff>=2?'Buon upgrade!':'Upgrade incrementale';acls='color:var(--gn)'}else{advice='Attenzione: piu vecchio';acls='color:var(--rd)'}resEl.style.display='block';resEl.innerHTML=`<div style="display:grid;grid-template-columns:1fr 40px 1fr;gap:12px;align-items:center"><div style="background:rgba(0,0,0,.3);border:1px solid var(--glass-border);border-radius:12px;padding:16px;text-align:center"><div style="font-size:14px;font-weight:700">${mio.name}</div><div style="color:var(--tx3);font-size:10px">${mio.cat} · ${mio.year} · ${mio.chip}</div><div style="color:var(--cyan);font-weight:700;margin-top:6px">${mio.price.toLocaleString('it-IT')} EUR</div></div><div style="text-align:center;font-size:20px;color:var(--cyan)">→</div><div style="background:rgba(0,0,0,.3);border:1px solid var(--glass-border);border-radius:12px;padding:16px;text-align:center"><div style="font-size:14px;font-weight:700">${tgt.name}</div><div style="color:var(--tx3);font-size:10px">${tgt.cat} · ${tgt.year} · ${tgt.chip}</div><div style="color:var(--gn);font-weight:700;margin-top:6px">${tgt.price.toLocaleString('it-IT')} EUR</div></div></div><div style="margin-top:14px;text-align:center;${acls};font-weight:600">${advice} · Differenza: ${priceDiff>0?'+':''}${priceDiff.toLocaleString('it-IT')} EUR</div>`}

// ═══ TRAVEL ═══
const AIRPORTS=[{code:'MXP',city:'Milano Malpensa',country:'IT'},{code:'LIN',city:'Milano Linate',country:'IT'},{code:'BGY',city:'Bergamo',country:'IT'},{code:'FCO',city:'Roma Fiumicino',country:'IT'},{code:'NAP',city:'Napoli',country:'IT'},{code:'BLQ',city:'Bologna',country:'IT'},{code:'CTA',city:'Catania',country:'IT'},{code:'VCE',city:'Venezia',country:'IT'},{code:'FLR',city:'Firenze',country:'IT'},{code:'TRN',city:'Torino',country:'IT'},{code:'LHR',city:'Londra Heathrow',country:'GB'},{code:'STN',city:'Londra Stansted',country:'GB'},{code:'CDG',city:'Parigi CDG',country:'FR'},{code:'FRA',city:'Francoforte',country:'DE'},{code:'BER',city:'Berlino',country:'DE'},{code:'MUC',city:'Monaco',country:'DE'},{code:'BCN',city:'Barcellona',country:'ES'},{code:'MAD',city:'Madrid',country:'ES'},{code:'AMS',city:'Amsterdam',country:'NL'},{code:'ZRH',city:'Zurigo',country:'CH'},{code:'VIE',city:'Vienna',country:'AT'},{code:'LIS',city:'Lisbona',country:'PT'},{code:'ATH',city:'Atene',country:'GR'},{code:'PRG',city:'Praga',country:'CZ'},{code:'BUD',city:'Budapest',country:'HU'},{code:'DUB',city:'Dublino',country:'IE'},{code:'IST',city:'Istanbul',country:'TR'},{code:'DXB',city:'Dubai',country:'AE'},{code:'JFK',city:'New York JFK',country:'US'},{code:'LAX',city:'Los Angeles',country:'US'},{code:'MIA',city:'Miami',country:'US'},{code:'BKK',city:'Bangkok',country:'TH'},{code:'NRT',city:'Tokyo Narita',country:'JP'},{code:'SIN',city:'Singapore',country:'SG'},{code:'SYD',city:'Sydney',country:'AU'}];
function acSearch(inputId,listId){const val=document.getElementById(inputId).value.toLowerCase().trim();const listEl=document.getElementById(listId);if(!val){listEl.classList.remove('show');return}const matches=AIRPORTS.filter(a=>a.city.toLowerCase().includes(val)||a.code.toLowerCase().includes(val)).slice(0,10);if(!matches.length){listEl.classList.remove('show');return}listEl.innerHTML=matches.map(a=>`<div class="ac-item" onclick="acSelect('${inputId}','${listId}','${a.code}','${a.city.replace(/'/g,"\\'")}')"><span>${a.city} <span style="color:var(--tx3)">${a.country}</span></span><span class="ac-code">${a.code}</span></div>`).join('');listEl.classList.add('show')}
function acSelect(inputId,listId,code,city){document.getElementById(inputId).value=city+' ('+code+')';document.getElementById(inputId).dataset.code=code;document.getElementById(listId).classList.remove('show')}
document.addEventListener('click',e=>{if(!e.target.closest('.ac-wrap'))document.querySelectorAll('.ac-list').forEach(l=>l.classList.remove('show'))});
function buildTravel(){const tom=new Date();tom.setDate(tom.getDate()+7);const ret=new Date();ret.setDate(ret.getDate()+14);const dOut=document.getElementById('flyDateOut');const dRet=document.getElementById('flyDateRet');if(dOut)dOut.value=tom.toISOString().split('T')[0];if(dRet)dRet.value=ret.toISOString().split('T')[0];const f=document.getElementById('flyFrom');if(f){f.value='Milano Malpensa (MXP)';f.dataset.code='MXP'}}
async function searchFlights(){const fromInput=document.getElementById('flyFrom');const toInput=document.getElementById('flyTo');const to=toInput?.value.trim();const dateOut=document.getElementById('flyDateOut')?.value;const dateRet=document.getElementById('flyDateRet')?.value;const resEl=document.getElementById('flightResults');if(!to){resEl.innerHTML='<div style="padding:20px;text-align:center;color:var(--tx3);font-size:11px">Inserisci una destinazione</div>';return}const fromCode=(fromInput?.dataset.code||'MXP').toUpperCase();const toCode=(toInput?.dataset.code||'').toUpperCase();const fromCity=(fromInput?.value||'').replace(/\s*\([A-Z]{3}\)/,'');const toCity=to.replace(/\s*\([A-Z]{3}\)/,'');const links=[{name:'Google Flights',url:'https://www.google.com/travel/flights?q=flights+from+'+encodeURIComponent(fromCity)+'+to+'+encodeURIComponent(toCity)+'+on+'+dateOut,color:'var(--cyan)'},{name:'Skyscanner',url:'https://www.skyscanner.it/trasporti/voli/'+fromCode.toLowerCase()+'/'+toCode.toLowerCase()+'/'+dateOut.replace(/-/g,'').substring(2)+'/',color:'#0770e3'},{name:'Kayak',url:'https://www.kayak.it/flights/'+fromCode+'-'+toCode+'/'+dateOut+(dateRet?'/'+dateRet:''),color:'#FF690F'},{name:'Ryanair',url:'https://www.ryanair.com/it/it/trip/flights/select?adults=1&dateOut='+dateOut+'&originIata='+fromCode+'&destinationIata='+toCode,color:'#073590'}];resEl.innerHTML=`<div style="padding:14px 0"><div style="font-size:13px;font-weight:600;margin-bottom:8px">${fromCity} → ${toCity}</div><div style="font-size:10px;color:var(--tx3);margin-bottom:12px">${new Date(dateOut).toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'})}${dateRet?' — '+new Date(dateRet).toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'}):''}</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">${links.map(l=>`<a href="${l.url}" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:5px;padding:12px;background:rgba(0,0,0,.3);border:1px solid var(--glass-border);border-radius:10px;color:${l.color};font-size:11px;font-weight:600;text-decoration:none;font-family:var(--font);transition:border-color .2s" onmouseover="this.style.borderColor='${l.color}'" onmouseout="this.style.borderColor='var(--glass-border)'">${l.name}</a>`).join('')}</div></div>`}
