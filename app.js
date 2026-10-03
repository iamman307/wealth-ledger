(() => {
  'use strict';
  const APP_VERSION = '1.0.3';
  const STORAGE_KEY = 'wealth-ledger-db-v1';
  const state = { view: 'overview', holdingFilter: 'all', transactionFilter: 'all', performanceMode: 'returns', performanceScope: 'all', demo: false };
  let installPrompt = null;
  let db;

  const $ = id => document.getElementById(id);
  const all = selector => [...document.querySelectorAll(selector)];
  const finite = value => value !== null && value !== '' && Number.isFinite(Number(value));
  const number = (value, fallback = 0) => finite(value) ? Number(value) : fallback;
  const dateValue = value => value ? new Date(value).getTime() : 0;
  const clone = value => JSON.parse(JSON.stringify(value));
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const money = (value, digits = 0) => finite(value) ? new Intl.NumberFormat('zh-TW',{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(Number(value)) : '—';
  const signedMoney = (value, digits = 0) => finite(value) ? `${Number(value) > 0 ? '+' : ''}${money(value,digits)}` : '—';
  const percent = (value, digits = 2) => finite(value) ? `${Number(value) > 0 ? '+' : ''}${Number(value).toFixed(digits)}%` : '—';
  const tone = value => !finite(value) || Number(value) === 0 ? '' : Number(value) > 0 ? 'positive' : 'negative';
  const isoLocal = () => {
    const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    return d.toISOString().slice(0,16);
  };
  db = loadDb();

  const icons = {
    grid:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
    briefcase:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><rect x="3" y="7" width="18" height="13" rx="3"/><path d="M3 12h18M10 12v2h4v-2"/></svg>',
    repeat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/></svg>',
    chart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/></svg>',
    scale:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18M5 6h14M5 6 2 12h6L5 6Zm14 0-3 6h6l-3-6ZM8 21h8"/></svg>',
    settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.96 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3h4v.08A1.7 1.7 0 0 0 15.04 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.25.62.86 1.02 1.53 1.03H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></svg>',
    download:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0 5-5m-5 5-5-5M4 21h16"/></svg>',
    upload:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V4m0 0 5 5m-5-5L7 9M4 20h16"/></svg>',
    plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    more:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
    x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    vault:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="12" cy="12" r="3"/><path d="M12 9V7m3.2 5H18m-6 3v2m-3.2-5H6"/></svg>',
    wallet:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h14a2 2 0 0 1 2 2v10H5a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h11"/><path d="M16 11h5v4h-5a2 2 0 1 1 0-4Z"/></svg>',
    bitcoin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M9 7h4.2a2.3 2.3 0 1 1 0 4.6H9m0 0h4.8a2.5 2.5 0 1 1 0 5H9m2-11v13m3-13v2m0 9v2"/></svg>'
  };

  function injectIcons(root = document){
    root.querySelectorAll('[data-icon]').forEach(node => { node.innerHTML = icons[node.dataset.icon] || ''; });
  }

  function emptyDb(){
    return Ledger.applyPolicy({
      transactions:[], manualTrades:[], externalHoldings:[], cash:{}, quotes:{},
      meta:{appVersion:APP_VERSION,currentUsdTwd:null,cryptoSnapshot:{asOf:'',totalValueTwd:null},fundPlan:clone(Ledger.DEFAULT_FUND_PLAN),capitalTracking:clone(Ledger.DEFAULT_CAPITAL_TRACKING),securitiesCash:clone(Ledger.DEFAULT_SECURITIES_CASH)}
    });
  }

  function loadDb(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? Ledger.applyPolicy(JSON.parse(raw)) : emptyDb();
    }catch(error){ console.error(error); return emptyDb(); }
  }

  function saveDb(message){
    db.meta.appVersion = APP_VERSION;
    localStorage.setItem(STORAGE_KEY,JSON.stringify(db));
    state.demo = false;
    render();
    if(message) toast(message);
  }

  function demoDb(){
    const sample = emptyDb();
    sample.meta.currentUsdTwd = 30;
    sample.meta.fundPlan = {longTerm:300000,swing:200000,loan:0,reserve:50000,locked:false};
    sample.meta.securitiesCash = {...clone(Ledger.DEFAULT_SECURITIES_CASH),enabled:true,asOf:'2026-10-01T09:00:00+08:00',accountBalanceTwd:150000,externalInvestmentTransfersTwd:50000};
    sample.meta.cryptoSnapshot = {asOf:'2026-10-01T09:00:00+08:00',totalValueTwd:56000};
    sample.transactions = [
      {id:'demo-1',date:'2026-08-01T09:00:00',account:'長期',ticker:'DEMO-A',asset:'虛構示範',side:'BUY',qty:100,price:20,fee:1,tax:0,fx:30,currency:'USD'},
      {id:'demo-2',date:'2026-08-02T09:00:00',account:'長期',ticker:'DEMO-B',asset:'虛構示範',side:'BUY',qty:30,price:25,fee:1,tax:0,fx:30,currency:'USD'},
      {id:'demo-3',date:'2026-09-01T09:00:00',account:'波段',ticker:'DEMO-C',asset:'虛構示範',side:'BUY',qty:80,price:45,fee:1,tax:0,fx:30,currency:'USD'},
      {id:'demo-4',date:'2026-09-20T09:00:00',account:'波段',ticker:'DEMO-C',asset:'虛構示範',side:'SELL',qty:40,price:48,fee:1,tax:0,fx:30,currency:'USD'}
    ];
    sample.quotes = {
      'DEMO-A':{price:22,fx:30},'DEMO-B':{price:24,fx:30},'DEMO-C':{price:47,fx:30}
    };
    sample.manualTrades = [
      {id:'demo-crypto',ticker:'DEMO-GRID',asset:'虛構策略',direction:'LONG',open:'2026-09-01T09:00:00',close:'2026-09-05T09:00:00',entry:1000,exit:1020,qty:1,pnl:20,currency:'USDT',returnPct:2,priceReturnPct:null,rMultiple:null,exitReason:'示範'}
    ];
    return Ledger.applyPolicy(sample);
  }

  function currentFx(data = db){
    const metaFx = number(data.meta?.currentUsdTwd,0);
    if(metaFx > 0) return metaFx;
    const quoteFx = Object.values(data.quotes || {}).map(q => number(q.fx,0)).filter(v => v > 1).sort((a,b)=>b-a)[0];
    const holdingFx = (data.externalHoldings || []).map(h => number(h.fx,0)).filter(v => v > 1).sort((a,b)=>b-a)[0];
    return quoteFx || holdingFx || 1;
  }

  function cryptoSnapshot(data = db){
    const configured = number(data.meta?.cryptoSnapshot?.totalValueTwd,NaN);
    if(Number.isFinite(configured) && configured >= 0){ return {value:configured,asOf:data.meta.cryptoSnapshot.asOf || '',source:'manual'}; }
    const rows = data.externalHoldings || [];
    const value = rows.reduce((sum,h)=>sum+(finite(h.marketValueTwd)?Number(h.marketValueTwd):number(h.qty)*number(h.currentPrice)*number(h.fx,1)),0);
    const asOf = rows.map(h=>h.asOf).filter(Boolean).sort((a,b)=>dateValue(b)-dateValue(a))[0] || '';
    return {value,asOf,source:rows.length?'holdings':'none'};
  }

  function manualTrades(data = db){
    const fx = currentFx(data);
    return (data.manualTrades || []).map(t => ({
      ...t, account:'crypto', realizedTwd:number(t.pnl) * (String(t.currency).toUpperCase()==='TWD'?1:fx),
      returnPct:finite(t.returnPct)?Number(t.returnPct):NaN,
      holdHours:(dateValue(t.close)-dateValue(t.open))/36e5
    }));
  }

  function portfolio(){
    const computed = Ledger.compute(db);
    const funds = Ledger.fundSummary(db,computed);
    const securities = Ledger.securitiesCashSummary(db);
    const open = computed.positions.filter(p=>p.qty>1e-9);
    const positionRows = open.map(p=>{
      const quote=db.quotes[p.ticker];
      const market=quote?p.qty*quote.price*quote.fx:NaN;
      const unrealized=finite(market)?market-p.costTwd:NaN;
      return {...p,quote,marketValueTwd:market,unrealizedTwd:unrealized,returnPct:finite(unrealized)&&p.costTwd?unrealized/p.costTwd*100:NaN};
    });
    const missingQuotes=positionRows.filter(p=>!finite(p.marketValueTwd)).length;
    const stockMarket=positionRows.reduce((sum,p)=>sum+(finite(p.marketValueTwd)?p.marketValueTwd:0),0);
    const stockCost=positionRows.reduce((sum,p)=>sum+p.costTwd,0);
    const stockUnrealized=missingQuotes?NaN:stockMarket-stockCost;
    const stockRealized=computed.realized.reduce((sum,t)=>sum+t.pnlTwd,0);
    const crypto=cryptoSnapshot();
    const cryptoFunding=funds.externalFundingTwd;
    const cryptoTotal=cryptoFunding>0?crypto.value-cryptoFunding:NaN;
    const cryptoTrades=manualTrades();
    const cryptoRealized=cryptoTrades.reduce((sum,t)=>sum+t.realizedTwd,0);
    const cryptoImplied=finite(cryptoTotal)?cryptoTotal-cryptoRealized:NaN;
    const financing=number(db.meta?.capitalTracking?.loanFee)+number(db.meta?.capitalTracking?.interestPaid);
    const grossPnl=finite(stockUnrealized)&&finite(cryptoTotal)?stockRealized+stockUnrealized+cryptoTotal:NaN;
    const netPnl=finite(grossPnl)?grossPnl-financing:NaN;
    const stockCash=securities.configured?securities.postSettlementTwd:funds.investmentAvailable;
    const totalAssets=missingQuotes?NaN:stockMarket+stockCash+crypto.value;
    const inferredCapital=finite(grossPnl)?totalAssets-grossPnl:funds.investmentPlan;
    return {computed,funds,securities,positionRows,missingQuotes,stockMarket,stockCost,stockUnrealized,stockRealized,crypto,cryptoFunding,cryptoTotal,cryptoRealized,cryptoImplied,cryptoTrades,financing,grossPnl,netPnl,stockCash,totalAssets,inferredCapital};
  }

  function showView(view){
    if(view==='more'){ $('moreDialog').showModal(); return; }
    state.view=view;
    all('.view').forEach(node=>node.classList.toggle('active',node.id===view));
    all('[data-view]').forEach(node=>node.classList.toggle('active',node.dataset.view===view));
    const titles={overview:['PORTFOLIO','投資總覽'],holdings:['HOLDINGS','目前持倉'],transactions:['ACTIVITY','交易紀錄'],performance:['ANALYTICS','投資績效'],reconcile:['RECONCILIATION','資金對帳'],settings:['PREFERENCES','設定與備份']};
    $('viewEyebrow').textContent=titles[view][0]; $('viewTitle').textContent=titles[view][1];
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function metric(label,value,sub='',valueTone=''){
    return `<div class="metric-card"><span>${escapeHtml(label)}</span><strong class="${valueTone}">${escapeHtml(value)}</strong>${sub?`<small>${escapeHtml(sub)}</small>`:''}</div>`;
  }

  function render(){
    try{
      const hasData=db.transactions.length||db.manualTrades.length||db.externalHoldings.length||finite(db.meta?.cryptoSnapshot?.totalValueTwd);
      $('emptyState').hidden=Boolean(hasData)||state.demo;
      $('overviewContent').hidden=!hasData&&!state.demo;
      if(!hasData&&!state.demo){ renderSettings(); return; }
      const p=portfolio();
      renderNotice(p); renderOverview(p); renderHoldings(p); renderTransactions(p); renderPerformance(p); renderReconcile(p); renderSettings();
    }catch(error){ console.error(error); showNotice(error.message,'error'); }
  }

  function renderNotice(p){
    const messages=[];
    if(p.missingQuotes)messages.push(`${p.missingQuotes}個股票持倉缺少行情，總損益暫不完整`);
    if(p.crypto.source==='none')messages.push('尚未設定幣安總資產');
    if(p.crypto.asOf && Date.now()-dateValue(p.crypto.asOf)>7*864e5)messages.push('幣安快照已超過7天');
    if(p.securities.configured && Date.now()-dateValue(p.securities.asOf)>7*864e5)messages.push('證券戶快照已超過7天');
    if(messages.length)showNotice(messages.join('・')); else $('notice').hidden=true;
  }

  function showNotice(message,kind=''){
    $('notice').hidden=false;$('notice').textContent=message;$('notice').className=`notice ${kind}`;
  }

  function renderOverview(p){
    $('totalAssets').textContent=`NT$${money(p.totalAssets)}`;
    $('assetFreshness').textContent=`股票行情與現金快照｜USD/TWD ${money(currentFx(),3)}`;
    $('investedCapital').textContent=`NT$${money(p.inferredCapital)}`;
    $('realizedPnl').textContent=`${signedMoney(p.stockRealized+p.cryptoRealized)} 元`; $('realizedPnl').className=tone(p.stockRealized+p.cryptoRealized);
    const implied=finite(p.stockUnrealized)&&finite(p.cryptoImplied)?p.stockUnrealized+p.cryptoImplied:NaN;
    $('unrealizedPnl').textContent=`${signedMoney(implied)} 元`; $('unrealizedPnl').className=tone(implied);
    $('financingCost').textContent=`-${money(p.financing)} 元`; $('financingCost').className=p.financing?'negative':'';
    $('netResult').textContent=`${signedMoney(p.netPnl)} 元`; $('netResult').className=tone(p.netPnl);
    const roi=finite(p.netPnl)&&p.inferredCapital?p.netPnl/p.inferredCapital*100:NaN;
    $('totalReturnBadge').textContent=finite(roi)?percent(roi):'資料不完整';$('totalReturnBadge').className=`return-badge ${finite(roi)&&roi<0?'negative':''}`;

    const long=p.funds.buckets['長期'],swing=p.funds.buckets['波段'];
    const accounts=[
      {name:'長期投資',sub:long.tickers.join('・')||'尚無持倉',color:'var(--long)',icon:'briefcase',value:long.equityKnown,pnl:long.netGainKnown,cost:long.cost,available:long.available,allocation:long.allocation},
      {name:'波段股票',sub:'完整持倉週期',color:'var(--swing)',icon:'chart',value:p.funds.swingAvailableTwd+swing.marketValue,pnl:swing.netGainKnown,cost:swing.cost,available:p.funds.swingAvailableTwd,allocation:p.funds.swingStockAllocationTwd},
      {name:'幣安',sub:'現貨・合約・網格',color:'var(--crypto)',icon:'bitcoin',value:p.crypto.value,pnl:p.cryptoTotal,cost:p.cryptoFunding,available:p.crypto.value,allocation:p.cryptoFunding}
    ];
    $('accountCards').innerHTML=accounts.map(a=>{
      const ret=finite(a.pnl)&&a.allocation?a.pnl/a.allocation*100:NaN;
      const used=a.allocation?Math.max(0,Math.min(100,a.cost/a.allocation*100)):0;
      return `<article class="account-card" style="--account-color:${a.color}"><div class="account-top"><div class="account-name"><div class="account-icon">${icons[a.icon]}</div><span><strong>${a.name}</strong><small>${a.sub}</small></span></div><span class="account-return ${tone(a.pnl)}">${percent(ret)}</span></div><div class="account-value">NT$${money(a.value)} <small>現值</small></div><div class="account-meta"><div><span>成本／投入</span><strong>${money(a.cost)}</strong></div><div><span>${a.name==='幣安'?'總損益':'可動用'}</span><strong class="${a.name==='幣安'?tone(a.pnl):''}">${a.name==='幣安'?signedMoney(a.pnl):money(a.available)}</strong></div></div><div class="account-bar"><i style="width:${used}%"></i></div></article>`;
    }).join('');

    const contrib=p.positionRows.filter(x=>finite(x.unrealizedTwd)).map(x=>({ticker:x.ticker,value:x.unrealizedTwd}));
    if(finite(p.cryptoTotal))contrib.push({ticker:'BINANCE',value:p.cryptoTotal});
    contrib.sort((a,b)=>Math.abs(b.value)-Math.abs(a.value));
    const max=Math.max(1,...contrib.map(x=>Math.abs(x.value)));
    $('contributionList').innerHTML=contrib.length?contrib.slice(0,6).map(x=>`<div class="contribution-row"><span class="symbol">${escapeHtml(x.ticker)}</span><div class="contribution-track"><span style="width:${Math.max(4,Math.abs(x.value)/max*100)}%;background:${x.value>=0?'var(--positive)':'var(--negative)'}"></span></div><strong class="${tone(x.value)}">${signedMoney(x.value)}</strong></div>`).join(''):'<div class="empty-row">尚無可計算持倉</div>';

    const allocation=[{name:'長期股票',value:long.marketValue,color:'var(--long)'},{name:'波段股票',value:swing.marketValue,color:'var(--swing)'},{name:'幣安',value:p.crypto.value,color:'var(--crypto)'}];
    const total=allocation.reduce((s,x)=>s+x.value,0)||1; const a=allocation[0].value/total*100,b=(allocation[0].value+allocation[1].value)/total*100;
    $('allocationDonut').style.setProperty('--a',`${a}%`);$('allocationDonut').style.setProperty('--b',`${b}%`);$('allocationCenter').textContent=`${money(total/10000,1)}萬`;
    $('allocationLegend').innerHTML=allocation.map(x=>`<div class="legend-row"><i style="background:${x.color}"></i><span>${x.name}</span><strong>${money(x.value/total*100,1)}%</strong></div>`).join('');
  }

  function renderHoldings(p){
    const query=$('holdingSearch').value.trim().toUpperCase();
    const stockRows=p.positionRows.map(row=>({kind:'stock',account:row.account,ticker:row.ticker,asset:row.asset,qty:row.qty,cost:row.costTwd,market:row.marketValueTwd,pnl:row.unrealizedTwd,ret:row.returnPct,price:row.quote?.price,currency:row.currency,asOf:row.quote?.updated||''}));
    const ext=(db.externalHoldings||[]).map(h=>({kind:'crypto',account:'crypto',ticker:h.ticker,asset:h.asset,qty:h.qty,cost:finite(h.avgCost)?h.avgCost*h.qty*number(h.fx,1):NaN,market:finite(h.marketValueTwd)?h.marketValueTwd:number(h.qty)*number(h.currentPrice)*number(h.fx,1),pnl:finite(h.unrealizedTwd)?Number(h.unrealizedTwd):NaN,ret:finite(h.unrealizedTwd)&&finite(h.avgCost)&&h.avgCost*h.qty*h.fx?Number(h.unrealizedTwd)/(h.avgCost*h.qty*h.fx)*100:NaN,price:h.currentPrice,currency:h.currency,asOf:h.asOf}));
    const rows=[...stockRows,...ext].filter(r=>(state.holdingFilter==='all'||r.account===state.holdingFilter||(state.holdingFilter==='crypto'&&r.kind==='crypto'))&&(!query||r.ticker.includes(query)||String(r.asset).toUpperCase().includes(query))).sort((a,b)=>(finite(b.pnl)?Math.abs(b.pnl):0)-(finite(a.pnl)?Math.abs(a.pnl):0));
    $('holdingSummary').innerHTML=[metric('股票持倉市值',`NT$${money(p.stockMarket)}`,'不含幣安'),metric('幣安資產',`NT$${money(p.crypto.value)}`,p.crypto.asOf?p.crypto.asOf.slice(0,10):'未設定'),metric('股票未實現',`${signedMoney(p.stockUnrealized)} 元`,'行情完整後計算',tone(p.stockUnrealized)),metric('最大損益貢獻',rows.length?`${signedMoney(rows[0].pnl)} 元`:'—',rows[0]?.ticker||'',tone(rows[0]?.pnl))].join('');
    $('holdingsTable').innerHTML=`<thead><tr><th>資產</th><th>帳戶</th><th>數量</th><th>成本 TWD</th><th>現值 TWD</th><th>未實現</th><th>報酬率</th><th>現價</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td><div class="asset-cell"><span class="ticker-avatar">${escapeHtml(r.ticker.slice(0,3))}</span><div><strong>${escapeHtml(r.ticker)}</strong><small>${escapeHtml(r.asset||'')}</small></div></div></td><td><span class="account-chip ${r.account==='波段'?'swing':r.account==='crypto'?'crypto':''}">${r.account==='crypto'?'幣安':escapeHtml(r.account)}</span></td><td>${money(r.qty,4)}</td><td>${money(r.cost)}</td><td>${money(r.market)}</td><td class="${tone(r.pnl)}">${signedMoney(r.pnl)}</td><td class="${tone(r.ret)}">${percent(r.ret)}</td><td>${money(r.price,4)} ${escapeHtml(r.currency)}</td></tr>`).join(''):'<tr><td colspan="8" class="empty-row">沒有符合條件的持倉</td></tr>'}</tbody>`;
  }

  function renderTransactions(p){
    const query=$('transactionSearch').value.trim().toUpperCase();
    const realizedById=new Map(p.computed.realized.map(t=>[t.id,t.pnlTwd]));
    const stocks=db.transactions.map(t=>({...t,kind:'stock',sortDate:t.date,pnl:realizedById.get(t.id)}));
    const crypto=(db.manualTrades||[]).map(t=>({id:t.id,kind:'crypto',account:'crypto',ticker:t.ticker,asset:t.asset,side:t.direction,qty:t.qty,price:t.entry,fee:finite(t.tradingFee)?Math.abs(t.tradingFee):0,currency:t.currency,sortDate:t.close,pnl:t.pnl,returnPct:t.returnPct}));
    const rows=[...stocks,...crypto].filter(r=>(state.transactionFilter==='all'||r.account===state.transactionFilter||(state.transactionFilter==='crypto'&&r.kind==='crypto'))&&(!query||String(r.ticker).includes(query)||String(r.asset).toUpperCase().includes(query))).sort((a,b)=>dateValue(b.sortDate)-dateValue(a.sortDate));
    $('transactionsTable').innerHTML=`<thead><tr><th>日期</th><th>帳戶</th><th>代號</th><th>動作</th><th>數量</th><th>價格／投入</th><th>費用</th><th>損益</th><th></th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td>${escapeHtml(String(r.sortDate).slice(0,16).replace('T',' '))}</td><td><span class="account-chip ${r.account==='波段'?'swing':r.kind==='crypto'?'crypto':''}">${r.kind==='crypto'?'幣安':escapeHtml(r.account)}</span></td><td>${escapeHtml(r.ticker)}</td><td>${escapeHtml(r.side)}</td><td>${money(r.qty,4)}</td><td>${money(r.price,4)} ${escapeHtml(r.currency)}</td><td>${money(r.fee,2)}</td><td class="${tone(r.pnl)}">${finite(r.pnl)?signedMoney(r.pnl,2)+' '+(r.kind==='stock'?'TWD':escapeHtml(r.currency)):'—'}</td><td><button class="delete-button" data-delete="${escapeHtml(r.id)}" data-kind="${r.kind}">刪除</button></td></tr>`).join(''):'<tr><td colspan="9" class="empty-row">尚無交易紀錄</td></tr>'}</tbody>`;
    all('[data-delete]').forEach(button=>button.onclick=()=>deleteRecord(button.dataset.delete,button.dataset.kind));
  }

  function qualityStats(trades){
    const completed=trades.filter(t=>finite(t.realizedTwd)); const rated=completed.filter(t=>finite(t.returnPct));
    const wins=completed.filter(t=>t.realizedTwd>0),losses=completed.filter(t=>t.realizedTwd<0),ratedWins=rated.filter(t=>t.returnPct>0),ratedLosses=rated.filter(t=>t.returnPct<0);
    const avg=(rows,key)=>rows.length?rows.reduce((s,t)=>s+Number(t[key]),0)/rows.length:NaN;
    const avgWin=avg(ratedWins,'returnPct'),avgLoss=Math.abs(avg(ratedLosses,'returnPct'));
    const grossWin=wins.reduce((s,t)=>s+t.realizedTwd,0),grossLoss=Math.abs(losses.reduce((s,t)=>s+t.realizedTwd,0));
    const chronological=[...completed].sort((a,b)=>dateValue(a.close)-dateValue(b.close));
    let equity=0,peak=0,maxDrawdown=0,winStreak=0,lossStreak=0,maxWinStreak=0,maxLossStreak=0;
    chronological.forEach(t=>{equity+=t.realizedTwd;peak=Math.max(peak,equity);maxDrawdown=Math.min(maxDrawdown,equity-peak);if(t.realizedTwd>0){winStreak++;lossStreak=0;maxWinStreak=Math.max(maxWinStreak,winStreak)}else if(t.realizedTwd<0){lossStreak++;winStreak=0;maxLossStreak=Math.max(maxLossStreak,lossStreak)}});
    return {count:completed.length,ratedCount:rated.length,winRate:completed.length?wins.length/completed.length*100:NaN,avgWin,avgLoss,payoff:avgLoss?avgWin/avgLoss:NaN,expectancy:rated.length?avg(rated,'returnPct'):NaN,profitFactor:grossLoss?grossWin/grossLoss:NaN,avgWinTwd:wins.length?grossWin/wins.length:NaN,avgLossTwd:losses.length?grossLoss/losses.length:NaN,maxDrawdown,maxWinStreak,maxLossStreak,avgHoldHours:avg(completed.filter(t=>finite(t.holdHours)),'holdHours')};
  }

  function performanceTrades(p){
    const stock=p.computed.trades.map(t=>({...t,account:'stock'}));
    return {stock,crypto:p.cryptoTrades,all:[...stock,...p.cryptoTrades]};
  }

  function renderPerformance(p){
    const stockTotal=p.stockRealized+p.stockUnrealized;
    $('returnMetrics').innerHTML=[metric('股票總損益',`${signedMoney(stockTotal)} 元`,'已實現＋未實現',tone(stockTotal)),metric('幣安總損益',`${signedMoney(p.cryptoTotal)} 元`,'總資產－累計投入',tone(p.cryptoTotal)),metric('信貸成本',`-${money(p.financing)} 元`,'手續費＋利息',p.financing?'negative':''),metric('淨成果',`${signedMoney(p.netPnl)} 元`,'扣除融資成本',tone(p.netPnl))].join('');
    const bridge=[['股票已實現',p.stockRealized,'var(--positive)'],['股票未實現',p.stockUnrealized,p.stockUnrealized>=0?'var(--positive)':'var(--negative)'],['幣安總損益',p.cryptoTotal,p.cryptoTotal>=0?'var(--crypto)':'var(--negative)'],['融資成本',-p.financing,'var(--negative)']];
    const max=Math.max(1,...bridge.map(x=>Math.abs(number(x[1]))));
    $('pnlBridge').innerHTML=bridge.map(x=>`<div class="bridge-row"><span>${x[0]}</span><div class="bridge-track"><i style="width:${Math.max(3,Math.abs(number(x[1]))/max*100)}%;background:${x[2]}"></i></div><strong class="${tone(x[1])}">${signedMoney(x[1])}</strong></div>`).join('');
    const long=p.funds.buckets['長期'],swing=p.funds.buckets['波段'];
    const accountRows=[['長期股票',long.netGainKnown,'var(--long)'],['波段股票',swing.netGainKnown,'var(--swing)'],['幣安',p.cryptoTotal,'var(--crypto)']];
    $('accountPerformance').innerHTML=accountRows.map(x=>`<div class="performance-row"><i style="background:${x[2]}"></i><span><strong>${x[0]}</strong><small>目前累計成果</small></span><strong class="${tone(x[1])}">${signedMoney(x[1])}</strong></div>`).join('');
    const groups=performanceTrades(p);const selected=groups[state.performanceScope];const stats=qualityStats(selected);
    $('qualityMetrics').innerHTML=[metric('完整交易',`${stats.count} 筆`,`${stats.ratedCount}筆有報酬率`),metric('勝率',percent(stats.winRate,1),'已平倉樣本',tone(stats.winRate-50)),metric('平均獲利',percent(stats.avgWin),'獲利交易'),metric('平均虧損',finite(stats.avgLoss)?`-${Number(stats.avgLoss).toFixed(2)}%`:'—','虧損交易','negative'),metric('Payoff',finite(stats.payoff)?`${stats.payoff.toFixed(2)} : 1`:'—','平均獲利率÷平均虧損率'),metric('Expectancy',percent(stats.expectancy),'每筆期望值',tone(stats.expectancy)),metric('Profit Factor',finite(stats.profitFactor)?stats.profitFactor.toFixed(2):'—','總獲利÷總虧損',tone(stats.profitFactor-1)),metric('最大回撤',`${signedMoney(stats.maxDrawdown)} 元`,`${stats.maxWinStreak}連勝・${stats.maxLossStreak}連敗`,'negative')].join('');
    const rows=[...selected].sort((a,b)=>dateValue(b.close)-dateValue(a.close));
    $('closedTradesTable').innerHTML=`<thead><tr><th>平倉日</th><th>標的</th><th>類別</th><th>持有時間</th><th>損益 TWD</th><th>報酬率</th><th>R</th></tr></thead><tbody>${rows.length?rows.map(t=>`<tr><td>${escapeHtml(String(t.close).slice(0,10))}</td><td>${escapeHtml(t.ticker)}</td><td><span class="account-chip ${t.account==='crypto'?'crypto':'swing'}">${t.account==='crypto'?'幣安':'股票波段'}</span></td><td>${finite(t.holdHours)?formatDuration(t.holdHours):'—'}</td><td class="${tone(t.realizedTwd)}">${signedMoney(t.realizedTwd)}</td><td class="${tone(t.returnPct)}">${percent(t.returnPct)}</td><td>${finite(t.rMultiple)?Number(t.rMultiple).toFixed(2):'N/A'}</td></tr>`).join(''):'<tr><td colspan="7" class="empty-row">尚無完整交易</td></tr>'}</tbody>`;
  }

  function formatDuration(hours){
    if(hours<24)return `${money(hours,1)}小時`;
    return `${money(hours/24,1)}天`;
  }

  function renderReconcile(p){
    const s=p.securities;
    $('bankAsOf').textContent=s.configured?s.asOf.slice(0,10):'未設定';
    $('bankMetrics').innerHTML=[['帳面餘額',s.accountBalanceTwd],['已圈存',-s.reservedTwd],['目前可用',s.availableTwd],['待交割',s.pendingTwd],['交割後預估',s.postSettlementTwd],['累計轉至幣安',-p.cryptoFunding]].map(x=>`<div><span>${x[0]}</span><strong class="${tone(x[1])}">${signedMoney(x[1])}</strong></div>`).join('');
    $('pendingList').innerHTML=s.pendingSettlements.length?s.pendingSettlements.map(item=>`<div class="pending-item"><span><strong>${escapeHtml(item.ticker||'未命名')}・${item.side==='BUY'?'買進':'賣出'}</strong><small>${escapeHtml(item.date.slice(0,16).replace('T',' '))}</small></span><strong class="${tone(item.amount*item.fx)}">${signedMoney(item.amount*item.fx)}</strong></div>`).join(''):'<div class="empty-row">目前沒有待交割款</div>';
    const model=p.funds.investmentAvailable; const gap=s.configured?model-s.postSettlementTwd:NaN;
    $('reconciliationBridge').innerHTML=`<div class="reconcile-row"><span>長期策略可動用</span><strong>${money(p.funds.buckets['長期'].available)}</strong></div><div class="reconcile-row"><span>波段股票可動用</span><strong>${money(p.funds.swingAvailableTwd)}</strong></div><div class="reconcile-row"><span>歷史現金校正</span><strong class="${tone(p.funds.cashAdjustmentTwd)}">${signedMoney(p.funds.cashAdjustmentTwd)}</strong></div><div class="reconcile-row total"><span>股票配置模型</span><strong>${money(model)}</strong></div><div class="reconcile-row"><span>銀行交割後預估</span><strong>${money(s.postSettlementTwd)}</strong></div><div class="reconcile-row total"><span>待對帳差額</span><strong class="${tone(gap)}">${signedMoney(gap)}</strong></div>`;
    $('cryptoAsOf').textContent=p.crypto.asOf?p.crypto.asOf.slice(0,10):'未設定';
    $('cryptoMetrics').innerHTML=[['目前總資產',p.crypto.value],['累計投入',p.cryptoFunding],['已實現策略',p.cryptoRealized],['未實現／未拆分',p.cryptoImplied],['總損益',p.cryptoTotal],['相對投入報酬',p.cryptoFunding&&finite(p.cryptoTotal)?p.cryptoTotal/p.cryptoFunding*100:NaN]].map((x,i)=>`<div><span>${x[0]}</span><strong class="${i>1?tone(x[1]):''}">${i===5?percent(x[1]):i>1?signedMoney(x[1]):money(x[1])}</strong></div>`).join('');
  }

  function inputField(name,label,value,type='number',extra=''){
    return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${escapeHtml(value??'')}" ${extra}></div>`;
  }

  function renderSettings(){
    const plan=Ledger.normalizeFundPlan(db.meta?.fundPlan);const cap=Ledger.normalizeCapitalTracking(db.meta?.capitalTracking);
    $('allocationForm').innerHTML=`${inputField('longTerm','長期配置（TWD）',plan.longTerm)}${inputField('swing','波段配置（TWD）',plan.swing)}${inputField('loan','信貸扣款保留（TWD）',plan.loan)}${inputField('reserve','緊急預備金（TWD）',plan.reserve)}<div class="form-actions"><button class="button button-primary" type="submit">儲存配置</button></div>`;
    $('capitalForm').innerHTML=`${inputField('resetDate','追蹤起始日',cap.resetDate,'date')}${inputField('loanGross','信貸原始本金',cap.loanGross)}${inputField('loanFee','開辦／手續費',cap.loanFee)}${inputField('principalRepaid','已還本金',cap.principalRepaid)}${inputField('interestPaid','累計利息',cap.interestPaid)}${inputField('cashAdjustmentTwd','現金校正',cap.cashAdjustmentTwd)}<div class="form-actions"><button class="button button-primary" type="submit">儲存資金設定</button></div>`;
    $('allocationForm').onsubmit=saveAllocation;$('capitalForm').onsubmit=saveCapital;
  }

  function saveAllocation(event){
    event.preventDefault(); const form=new FormData(event.currentTarget); const next=clone(db);
    next.meta.fundPlan={longTerm:number(form.get('longTerm')),swing:number(form.get('swing')),loan:number(form.get('loan')),reserve:number(form.get('reserve')),locked:true};
    db=Ledger.applyPolicy(next);saveDb('資金配置已更新');
  }

  function saveCapital(event){
    event.preventDefault();const form=new FormData(event.currentTarget);const next=clone(db);const old=Ledger.normalizeCapitalTracking(next.meta.capitalTracking);
    next.meta.capitalTracking={...old,enabled:true,resetDate:String(form.get('resetDate')||old.resetDate||new Date().toISOString().slice(0,10)),loanGross:number(form.get('loanGross')),loanFee:number(form.get('loanFee')),principalRepaid:number(form.get('principalRepaid')),interestPaid:number(form.get('interestPaid')),cashAdjustmentTwd:number(form.get('cashAdjustmentTwd'))};
    db=Ledger.applyPolicy(next);saveDb('資金來源已更新');
  }

  function openTradeDialog(){
    $('tradeFields').innerHTML=`${inputField('tradeDate','日期時間',isoLocal(),'datetime-local','required')}${inputField('tradeTicker','股票代號','','text','required placeholder="例如 ABC"')}<div class="field"><label for="tradeAccount">資金帳戶</label><select id="tradeAccount" name="tradeAccount"><option value="波段">波段</option><option value="長期">長期</option></select></div><div class="field"><label for="tradeSide">動作</label><select id="tradeSide" name="tradeSide"><option value="BUY">買進</option><option value="SELL">賣出</option><option value="INIT">期初持倉</option></select></div><div class="field"><label for="tradeAsset">資產類型</label><select id="tradeAsset" name="tradeAsset"><option>美股</option><option>台股</option><option>ETF</option></select></div>${inputField('tradeQty','數量','', 'number','step="any" min="0" required')}${inputField('tradePrice','成交價格','', 'number','step="any" min="0" required')}${inputField('tradeFee','手續費',0,'number','step="any" min="0"')}${inputField('tradeTax','交易稅',0,'number','step="any" min="0"')}<div class="field"><label for="tradeCurrency">計價幣別</label><select id="tradeCurrency" name="tradeCurrency"><option value="USD">USD</option><option value="TWD">TWD</option></select></div>${inputField('tradeFx','成交匯率',currentFx(),'number','step="any" min="0" required')}<div class="field full"><label><input id="tradePending" name="tradePending" type="checkbox" style="width:auto;min-height:auto;margin-right:7px">尚未從銀行扣款／入帳，加入待交割</label></div>`;
    $('tradeTicker').addEventListener('input',()=>{const ticker=$('tradeTicker').value.trim().toUpperCase();const known=db.transactions.find(t=>t.ticker===ticker);if(known)$('tradeAccount').value=known.account;});
    $('tradeDialog').showModal();
  }

  function saveTrade(event){
    event.preventDefault();const f=new FormData(event.currentTarget);const ticker=String(f.get('tradeTicker')).trim().toUpperCase();const currency=String(f.get('tradeCurrency'));
    const transaction={id:crypto.randomUUID(),date:String(f.get('tradeDate')),account:String(f.get('tradeAccount')),ticker,asset:String(f.get('tradeAsset')),side:String(f.get('tradeSide')),qty:number(f.get('tradeQty')),price:number(f.get('tradePrice')),fee:number(f.get('tradeFee')),tax:number(f.get('tradeTax')),fx:currency==='TWD'?1:number(f.get('tradeFx')),currency,stop:null,exitReason:'',note:''};
    try{
      const next=clone(db);next.transactions.push(transaction);
      if(f.get('tradePending')){const cash=Ledger.normalizeSecuritiesCash(next.meta.securitiesCash);if(!cash.enabled||!cash.asOf)throw Error('請先在對帳頁設定證券戶快照');cash.pendingSettlements.push(Ledger.pendingSettlementFromTransaction(transaction));next.meta.securitiesCash=cash;}
      const checked=Ledger.applyPolicy(next);const issues=Ledger.compute(checked).issues;if(issues.length)throw Error(issues.join('\n'));db=checked;$('tradeDialog').close();saveDb('交易已新增');
    }catch(error){showNotice(error.message,'error')}
  }

  function openBankDialog(){
    const s=Ledger.normalizeSecuritiesCash(db.meta?.securitiesCash);
    $('bankFields').innerHTML=`${inputField('bankDate','快照日期時間',s.asOf?String(s.asOf).slice(0,16):isoLocal(),'datetime-local','required')}${inputField('bankBalance','銀行帳面餘額',s.accountBalanceTwd,'number','min="0" required')}${inputField('bankReserved','圈存金額',s.reservedTwd,'number','min="0"')}`;
    $('bankDialog').showModal();
  }

  function saveBank(event){
    event.preventDefault();const f=new FormData(event.currentTarget),next=clone(db),old=Ledger.normalizeSecuritiesCash(next.meta.securitiesCash);
    next.meta.securitiesCash={...old,enabled:true,asOf:String(f.get('bankDate')),accountBalanceTwd:number(f.get('bankBalance')),reservedTwd:number(f.get('bankReserved'))};
    try{db=Ledger.applyPolicy(next);$('bankDialog').close();saveDb('銀行快照已更新')}catch(error){showNotice(error.message,'error')}
  }

  function openCryptoDialog(){
    const snap=cryptoSnapshot();
    $('cryptoFields').innerHTML=`${inputField('cryptoDate','快照日期時間',snap.asOf?String(snap.asOf).slice(0,16):isoLocal(),'datetime-local','required')}${inputField('cryptoValue','幣安總資產（TWD）',snap.value,'number','min="0" required')}<p class="section-note">請填幣安資產頁顯示的全部資產台幣估值；這不會新增入金或損益。</p>`;
    $('cryptoDialog').showModal();
  }

  function saveCrypto(event){
    event.preventDefault();const f=new FormData(event.currentTarget),next=clone(db);next.meta.cryptoSnapshot={asOf:String(f.get('cryptoDate')),totalValueTwd:number(f.get('cryptoValue'))};db=Ledger.applyPolicy(next);$('cryptoDialog').close();saveDb('幣安快照已更新');
  }

  function openCryptoTradeDialog(){
    $('cryptoTradeFields').innerHTML=`${inputField('strategyTicker','策略名稱','BTCUSDT-GRID','text','required')}${inputField('strategyClose','結束時間',isoLocal(),'datetime-local','required')}${inputField('strategyDuration','持續小時','', 'number','step="any" min="0" required')}${inputField('strategyMargin','投入保證金（USDT）','', 'number','step="any" min="0" required')}${inputField('strategyPnl','總收益（USDT）','', 'number','step="any" required')}${inputField('strategyReturn','總報酬率（%）','', 'number','step="any" required')}<div class="field"><label for="strategyDirection">方向</label><select id="strategyDirection" name="strategyDirection"><option value="LONG">做多</option><option value="SHORT">做空</option></select></div>${inputField('strategyLeverage','槓桿倍數','', 'number','step="any" min="0"')}<div class="field full"><label for="strategyNote">備註</label><input id="strategyNote" name="strategyNote" type="text" placeholder="例如：全倉網格、手動結束"></div>`;
    $('cryptoTradeDialog').showModal();
  }

  function saveCryptoTrade(event){
    event.preventDefault();const f=new FormData(event.currentTarget);const close=String(f.get('strategyClose'));const hours=number(f.get('strategyDuration'));const margin=number(f.get('strategyMargin'));const pnl=number(f.get('strategyPnl'));const ret=number(f.get('strategyReturn'));
    const open=new Date(dateValue(close)-hours*36e5).toISOString();
    const trade={id:crypto.randomUUID(),ticker:String(f.get('strategyTicker')).trim().toUpperCase(),asset:'幣安合約／網格',direction:String(f.get('strategyDirection')),open,close,entry:margin,exit:Math.max(.00000001,margin+pnl),qty:1,pnl,currency:'USDT',returnPct:ret,priceReturnPct:null,rMultiple:null,exitReason:'策略結束',tradingFee:0,leverage:number(f.get('strategyLeverage'),null),note:String(f.get('strategyNote')||'')};
    try{const next=clone(db);next.manualTrades.push(trade);db=Ledger.applyPolicy(next);$('cryptoTradeDialog').close();saveDb('幣安策略已新增')}catch(error){showNotice(error.message,'error')}
  }

  function openQuoteDialog(){
    const tickers=[...new Set(Ledger.compute(db).positions.filter(p=>p.qty>1e-9).map(p=>p.ticker))];
    $('quoteFields').innerHTML=`<div class="field"><label for="quoteTicker">股票代號</label><input id="quoteTicker" name="quoteTicker" list="quoteTickers" required placeholder="例如 AVGO"><datalist id="quoteTickers">${tickers.map(t=>`<option value="${escapeHtml(t)}">`).join('')}</datalist></div>${inputField('quotePrice','目前價格','', 'number','step="any" min="0" required')}<div class="field"><label for="quoteCurrency">計價幣別</label><select id="quoteCurrency" name="quoteCurrency"><option value="USD">USD</option><option value="TWD">TWD</option></select></div>${inputField('quoteFx','USD/TWD 匯率',currentFx(),'number','step="any" min="0" required')}`;
    $('quoteDialog').showModal();
  }

  function saveQuote(event){
    event.preventDefault();const f=new FormData(event.currentTarget),next=clone(db),ticker=String(f.get('quoteTicker')).trim().toUpperCase(),currency=String(f.get('quoteCurrency'));
    next.quotes[ticker]={price:number(f.get('quotePrice')),fx:currency==='TWD'?1:number(f.get('quoteFx')),currency,updated:new Date().toISOString(),source:'手動更新'};
    try{db=Ledger.applyPolicy(next);$('quoteDialog').close();saveDb(`${ticker} 行情已更新`)}catch(error){showNotice(error.message,'error')}
  }

  function openTransferDialog(){
    const s=Ledger.normalizeSecuritiesCash(db.meta?.securitiesCash);
    if(!s.enabled||!s.asOf){showNotice('請先更新證券交割戶快照，再記錄轉入幣安','error');showView('reconcile');return;}
    $('transferFields').innerHTML=`${inputField('transferDate','轉帳時間',isoLocal(),'datetime-local','required')}${inputField('transferAmount','轉帳金額（TWD）','', 'number','step="1" min="1" required')}${inputField('transferBalance','轉帳後銀行帳面餘額',s.accountBalanceTwd,'number','step="1" min="0" required')}${inputField('transferReserved','轉帳後圈存',s.reservedTwd,'number','step="1" min="0"')}`;
    $('transferDialog').showModal();
  }

  function saveTransfer(event){
    event.preventDefault();const f=new FormData(event.currentTarget);
    try{db=Ledger.recordExternalInvestmentTransfer(db,{id:crypto.randomUUID(),date:String(f.get('transferDate')),amountTwd:number(f.get('transferAmount')),accountBalanceTwd:number(f.get('transferBalance')),reservedTwd:number(f.get('transferReserved')),destination:'Binance',note:'證券交割戶轉入幣安'});$('transferDialog').close();saveDb('轉入幣安已記錄，資金配置同步更新')}catch(error){showNotice(error.message,'error')}
  }

  function deleteRecord(id,kind){
    if(!confirm('確定刪除這筆紀錄？'))return;
    const next=clone(db);
    if(kind==='crypto')next.manualTrades=next.manualTrades.filter(x=>x.id!==id);
    else{next.transactions=next.transactions.filter(x=>x.id!==id);next.meta.securitiesCash.pendingSettlements=next.meta.securitiesCash.pendingSettlements.filter(x=>x.id!==`settlement-${id}`);}
    try{const checked=Ledger.applyPolicy(next);const issues=Ledger.compute(checked).issues;if(issues.length)throw Error(issues.join('\n'));db=checked;saveDb('紀錄已刪除')}catch(error){showNotice(`無法刪除：${error.message}`,'error')}
  }

  async function importFile(file){
    try{
      const incoming=JSON.parse(await file.text());
      const currentHasData=db.transactions.length||db.manualTrades.length||db.externalHoldings.length;
      if(!currentHasData){db=Ledger.applyPolicy(incoming)}else{const merged=Ledger.merge(db,Ledger.applyPolicy(incoming));db=merged.db;toast(`新增 ${merged.report.txAdded} 筆股票、${merged.report.manualAdded} 筆策略`)}
      saveDb('資料匯入完成');
    }catch(error){showNotice(`匯入失敗：${error.message}`,'error')}
    $('fileInput').value='';
  }

  function exportDb(){
    const data=clone(db);data.meta.exportedAt=new Date().toISOString();data.meta.appVersion=APP_VERSION;
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`wealth-ledger-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('完整備份已匯出');
  }

  function toast(message){const node=$('toast');node.textContent=message;node.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.remove('show'),2500)}

  function bindEvents(){
    all('[data-view]').forEach(button=>button.onclick=()=>showView(button.dataset.view));
    all('[data-go]').forEach(button=>button.onclick=()=>showView(button.dataset.go));
    all('[data-more-view]').forEach(button=>button.onclick=()=>{$('moreDialog').close();showView(button.dataset.moreView)});
    all('[data-close]').forEach(button=>button.onclick=()=>$(button.dataset.close).close());
    $('quickAddButton').onclick=openTradeDialog;$('tradeForm').onsubmit=saveTrade;
    $('editBankButton').onclick=openBankDialog;$('bankForm').onsubmit=saveBank;
    $('editCryptoButton').onclick=openCryptoDialog;$('cryptoForm').onsubmit=saveCrypto;
    $('cryptoTradeButton').onclick=openCryptoTradeDialog;$('cryptoTradeForm').onsubmit=saveCryptoTrade;
    $('quoteButton').onclick=openQuoteDialog;$('quoteForm').onsubmit=saveQuote;
    $('transferButton').onclick=openTransferDialog;$('transferForm').onsubmit=saveTransfer;
    [$('importButton'),$('emptyImportButton'),$('settingsImportButton')].forEach(button=>button.onclick=()=>$('fileInput').click());
    $('fileInput').onchange=event=>event.target.files[0]&&importFile(event.target.files[0]);
    $('exportButton').onclick=exportDb;
    $('demoButton').onclick=()=>{db=demoDb();state.demo=true;render();toast('目前是示範資料，不會儲存')};
    $('resetButton').onclick=()=>{if(confirm('這會清除目前裝置內的全部投資資料。請確認已匯出備份。')){localStorage.removeItem(STORAGE_KEY);db=emptyDb();state.demo=false;render();showView('overview');toast('本機資料已清除')}};
    $('holdingSearch').oninput=()=>renderHoldings(portfolio());$('transactionSearch').oninput=()=>renderTransactions(portfolio());
    all('#holdingFilter button').forEach(button=>button.onclick=()=>{state.holdingFilter=button.dataset.filter;all('#holdingFilter button').forEach(x=>x.classList.toggle('active',x===button));renderHoldings(portfolio())});
    all('#transactionFilter button').forEach(button=>button.onclick=()=>{state.transactionFilter=button.dataset.filter;all('#transactionFilter button').forEach(x=>x.classList.toggle('active',x===button));renderTransactions(portfolio())});
    all('.performance-switch button').forEach(button=>button.onclick=()=>{state.performanceMode=button.dataset.performance;all('.performance-switch button').forEach(x=>x.classList.toggle('active',x===button));$('returnsPanel').hidden=state.performanceMode!=='returns';$('qualityPanel').hidden=state.performanceMode!=='quality'});
    all('#performanceScope button').forEach(button=>button.onclick=()=>{state.performanceScope=button.dataset.scope;all('#performanceScope button').forEach(x=>x.classList.toggle('active',x===button));renderPerformance(portfolio())});
    window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('installButton').hidden=false});
    $('installButton').onclick=async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('installButton').hidden=true};
  }

  injectIcons(); bindEvents(); render(); showView('overview');
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.error));
})();
