/* Wealth Ledger calculation engine. Private account policy lives in imported data. */
(function(root){
  'use strict';
  const VERSION='6.12.0';
  const LONG_TERM_TICKERS=Object.freeze([]);
  const DEFAULT_FUND_PLAN=Object.freeze({longTerm:0,swing:0,loan:0,reserve:0,locked:false});
  const CAPITAL_SOURCE_KEYS=Object.freeze(['loan','self','family']);
  const DEFAULT_CAPITAL_TRACKING=Object.freeze({enabled:false,scope:'investment-only',resetDate:'',openingLoan:0,openingSelf:0,openingFamily:0,loanGross:0,loanFee:0,principalRepaid:0,interestPaid:0,excludedDailyTwd:0,cashAdjustmentTwd:0,otherPnlTwd:0,pnlBaselineTwd:0,events:[]});
  const DEFAULT_SECURITIES_CASH=Object.freeze({enabled:false,asOf:'',accountBalanceTwd:0,reservedTwd:0,externalInvestmentTransfersTwd:0,externalTransfers:[],pendingSettlements:[]});
  const clone = x => JSON.parse(JSON.stringify(x));
  const finite = x => typeof x === 'number' && Number.isFinite(x);
  const has = x => x !== null && x !== undefined;
  const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
  const positionKey = t => [t.account,t.ticker,t.currency].join('|');
  const manualKey = t => [t.ticker,t.direction,t.open,t.close,t.currency].join('|');
  const txKey = t => [positionKey(t),t.date,t.side,t.qty,t.price].join('|');
  const closeEnough = (a,b) => Math.abs(a-b)<=Math.max(1e-8,Math.abs(a)*1e-10);
  const classifyAccount=(ticker,policy)=>Array.isArray(policy?.longTermTickers)&&policy.longTermTickers.includes(String(ticker||'').trim().toUpperCase())?'長期':'波段';
  function normalizeFundPlan(plan){
    const p=plan&&typeof plan==='object'&&!Array.isArray(plan)?plan:{};
    const amount=(key,fallback)=>finite(Number(p[key]))&&Number(p[key])>=0?Number(p[key]):fallback;
    return {longTerm:amount('longTerm',DEFAULT_FUND_PLAN.longTerm),swing:amount('swing',DEFAULT_FUND_PLAN.swing),loan:amount('loan',DEFAULT_FUND_PLAN.loan),reserve:amount('reserve',DEFAULT_FUND_PLAN.reserve),locked:true};
  }
  function normalizeCapitalTracking(profile){
    const p=profile&&typeof profile==='object'&&!Array.isArray(profile)?profile:{};
    const number=(key,{signed=false}={})=>{
      if(!own(p,key)||p[key]===null||p[key]==='')return 0;
      const value=Number(p[key]);
      if(!finite(value)||(!signed&&value<0))throw Error('資金來源設定 '+key+' 格式錯誤');
      return value;
    };
    const resetDate=String(p.resetDate||'');
    if(resetDate&&!Number.isFinite(Date.parse(resetDate)))throw Error('資金來源重置日錯誤');
    const events=Array.isArray(p.events)?p.events.map((raw,index)=>{
      if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('資金異動 '+(index+1)+' 格式錯誤');
      const type=String(raw.type||''),source=String(raw.source||''),date=String(raw.date||''),amount=Number(raw.amount),checkpoint=Number(raw.pnlCheckpointTwd);
      if(!['IN','OUT'].includes(type))throw Error('資金異動 '+(index+1)+' 類型錯誤');
      if(![...CAPITAL_SOURCE_KEYS,'proRata'].includes(source)||(type==='IN'&&source==='proRata'))throw Error('資金異動 '+(index+1)+' 來源錯誤');
      if(!date||!Number.isFinite(Date.parse(date)))throw Error('資金異動 '+(index+1)+' 日期錯誤');
      if(!finite(amount)||amount<=0)throw Error('資金異動 '+(index+1)+' 金額錯誤');
      if(!finite(checkpoint))throw Error('資金異動 '+(index+1)+' 缺少損益切點');
      const id=String(raw.id||['capital',date,type,source,amount,index].join('-'));
      return {id,date,type,source,amount,pnlCheckpointTwd:checkpoint,note:String(raw.note||'')};
    }):[];
    return {
      enabled:Boolean(p.enabled),scope:'investment-only',resetDate,
      openingLoan:number('openingLoan'),openingSelf:number('openingSelf'),openingFamily:number('openingFamily'),
      loanGross:number('loanGross'),loanFee:number('loanFee'),principalRepaid:number('principalRepaid'),interestPaid:number('interestPaid'),
      excludedDailyTwd:number('excludedDailyTwd'),cashAdjustmentTwd:number('cashAdjustmentTwd',{signed:true}),otherPnlTwd:number('otherPnlTwd',{signed:true}),pnlBaselineTwd:number('pnlBaselineTwd',{signed:true}),events
    };
  }
  function normalizeSecuritiesCash(snapshot){
    const s=snapshot&&typeof snapshot==='object'&&!Array.isArray(snapshot)?snapshot:{};
    const enabled=Boolean(s.enabled),asOf=String(s.asOf||'');
    if(asOf&&!Number.isFinite(Date.parse(asOf)))throw Error('證券戶快照日期錯誤');
    const accountBalanceTwd=Number(s.accountBalanceTwd??0),reservedTwd=Number(s.reservedTwd??0),externalInvestmentTransfersTwd=Number(s.externalInvestmentTransfersTwd??0);
    if(!finite(accountBalanceTwd)||accountBalanceTwd<0)throw Error('證券戶帳面餘額格式錯誤');
    if(!finite(reservedTwd)||reservedTwd<0||reservedTwd>accountBalanceTwd)throw Error('證券戶圈存金額格式錯誤');
    if(!finite(externalInvestmentTransfersTwd)||externalInvestmentTransfersTwd<0)throw Error('外部投資轉出格式錯誤');
    const transferIds=new Set();
    const externalTransfers=(Array.isArray(s.externalTransfers)?s.externalTransfers:[]).map((raw,index)=>{
      const label='外部投資轉出 '+(index+1);
      if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error(label+' 格式錯誤');
      const id=String(raw.id||''),date=String(raw.date||''),amountTwd=Number(raw.amountTwd),destination=String(raw.destination||'外部投資');
      if(!id||transferIds.has(id))throw Error(label+' ID 缺少或重複');transferIds.add(id);
      if(!date||!Number.isFinite(Date.parse(date)))throw Error(label+' 日期錯誤');
      if(!finite(amountTwd)||amountTwd<=0)throw Error(label+' 金額錯誤');
      return {id,date,amountTwd,destination,note:String(raw.note||'')};
    });
    const ids=new Set();
    const pendingSettlements=(Array.isArray(s.pendingSettlements)?s.pendingSettlements:[]).map((raw,index)=>{
      const label='待交割 '+(index+1);
      if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error(label+' 格式錯誤');
      const id=String(raw.id||''),date=String(raw.date||''),currency=String(raw.currency||'').toUpperCase();
      const amount=Number(raw.amount),fx=currency==='TWD'?1:Number(raw.fx);
      if(!id||ids.has(id))throw Error(label+' ID 缺少或重複');ids.add(id);
      if(!date||!Number.isFinite(Date.parse(date)))throw Error(label+' 日期錯誤');
      if(!currency||!finite(amount)||amount===0)throw Error(label+' 金額或幣別錯誤');
      if(!finite(fx)||fx<=0)throw Error(label+' 匯率錯誤');
      return {id,date,currency,amount,fx,ticker:String(raw.ticker||''),side:String(raw.side||''),note:String(raw.note||'')};
    });
    return {enabled,asOf,accountBalanceTwd,reservedTwd,externalInvestmentTransfersTwd,externalTransfers,pendingSettlements};
  }
  function recordExternalInvestmentTransfer(data,input){
    const d=applyPolicy(data),raw=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
    const cash=normalizeSecuritiesCash(d.meta.securitiesCash);
    if(!cash.enabled||!cash.asOf)throw Error('尚未建立證券戶銀行快照');
    const id=String(raw.id||''),date=String(raw.date||''),amountTwd=Number(raw.amountTwd),accountBalanceTwd=Number(raw.accountBalanceTwd),reservedTwd=Number(raw.reservedTwd);
    if(!id||cash.externalTransfers.some(event=>event.id===id))throw Error('外部投資轉出 ID 缺少或重複');
    if(!date||!Number.isFinite(Date.parse(date)))throw Error('外部投資轉出日期錯誤');
    if(!finite(amountTwd)||amountTwd<=0)throw Error('轉出金額必須大於 0');
    if(!finite(accountBalanceTwd)||accountBalanceTwd<0)throw Error('證券戶帳面餘額格式錯誤');
    if(!finite(reservedTwd)||reservedTwd<0||reservedTwd>accountBalanceTwd)throw Error('圈存金額不可大於帳面餘額');
    cash.accountBalanceTwd=accountBalanceTwd;
    cash.reservedTwd=reservedTwd;
    cash.asOf=date;
    cash.externalInvestmentTransfersTwd=Math.max(cash.externalInvestmentTransfersTwd,externalFundingTwd(d))+amountTwd;
    cash.externalTransfers.push({id,date,amountTwd,destination:String(raw.destination||'外部投資'),note:String(raw.note||'')});
    d.meta.securitiesCash=cash;
    return applyPolicy(d);
  }
  function parseCapitalSetup(setup){
    if(!setup||typeof setup!=='object'||Array.isArray(setup))throw Error('私人資金設定檔格式錯誤');
    if(setup.kind!=='stock-ledger-capital-setup'||Number(setup.schemaVersion)!==1)throw Error('這不是支援的私人資金設定檔');
    const profile=normalizeCapitalTracking(setup.profile);
    const opening=profile.openingLoan+profile.openingSelf+profile.openingFamily;
    if(!profile.enabled||!profile.resetDate||opening<=0)throw Error('私人資金設定缺少啟用狀態、重置日或期初份額');
    if(profile.principalRepaid>profile.loanGross)throw Error('已還本金不可大於原始信貸本金');
    return {profile:{...profile,pnlBaselineTwd:0,events:[]},openingTotal:opening};
  }
  function applyPolicy(data,fundPlan){
    const d=clone(data);
    d.meta=d.meta&&typeof d.meta==='object'&&!Array.isArray(d.meta)?d.meta:{};
    d.transactions=Array.isArray(d.transactions)?d.transactions.map(t=>({...t,account:['長期','波段'].includes(t.account)?t.account:classifyAccount(t.ticker,d.meta.accountPolicy)})):d.transactions;
    d.meta.fundPlan=normalizeFundPlan(fundPlan??d.meta.fundPlan);
    d.meta.capitalTracking=normalizeCapitalTracking(d.meta.capitalTracking);
    d.meta.securitiesCash=normalizeSecuritiesCash(d.meta.securitiesCash);
    d.meta.accountPolicy={longTermTickers:Array.isArray(d.meta.accountPolicy?.longTermTickers)?d.meta.accountPolicy.longTermTickers:[],fallback:'波段',locked:false};
    d.meta.appVersion=VERSION;
    return validate(d);
  }
  function sameManual(a,b){return manualKey(a)===manualKey(b)&&['entry','exit','qty','pnl'].every(k=>a[k]===b[k]||(finite(a[k])&&finite(b[k])&&closeEnough(a[k],b[k])));}
  function validate(data){
    if(!data||!Array.isArray(data.transactions))throw Error('缺少 transactions 陣列');
    const d=clone(data); d.manualTrades=d.manualTrades??[];d.externalHoldings=d.externalHoldings??[];d.cash=d.cash??{};d.quotes=d.quotes??{};d.meta=d.meta??{};
    if(!Array.isArray(d.manualTrades))throw Error('manualTrades 必須是陣列');
    if(!Array.isArray(d.externalHoldings))throw Error('externalHoldings 必須是陣列');
    for(const k of ['cash','quotes','meta'])if(!d[k]||Array.isArray(d[k])||typeof d[k]!=='object')throw Error(k+' 格式錯誤');
    const ids=new Set();
    for(const [i,t] of d.transactions.entries()){
      const label='交易 '+(i+1);
      if(!t||typeof t!=='object')throw Error(label+' 格式錯誤');
      for(const k of ['id','date','account','ticker','currency','asset'])if(typeof t[k]!=='string'||!t[k].trim())throw Error(label+' 缺少 '+k);
      if(['__proto__','constructor','prototype'].includes(t.ticker))throw Error(label+' 代號不合法');
      if(ids.has(t.id))throw Error(label+' 重複 ID');ids.add(t.id);
      if(!['BUY','SELL','INIT'].includes(t.side)||!['長期','波段'].includes(t.account))throw Error(label+' 類型錯誤');
      if(!Number.isFinite(Date.parse(t.date)))throw Error(label+' 日期錯誤');
      for(const k of ['qty','price','fx'])if(!finite(t[k])||t[k]<=0)throw Error(label+' '+k+' 必須大於 0');
      for(const k of ['fee','tax']){if(has(t[k])&&(!finite(t[k])||t[k]<0))throw Error(label+' '+k+' 格式錯誤');}
      for(const k of ['stop','brokerPnlBase','brokerPnlTwd','tradeReturnPct','settlementTwd','originalRiskBase','RMultiple'])if(has(t[k])&&!finite(t[k]))throw Error(label+' '+k+' 必須是數字或 null');
      if(t.currency==='TWD'&&t.fx!==1)throw Error(label+' 台幣匯率必須為 1');
      if(has(t.originalRiskBase)&&t.originalRiskBase<=0)throw Error(label+' 原始風險必須大於 0');
      if(has(t.brokerPnlScope)&&!['execution','position'].includes(t.brokerPnlScope))throw Error(label+' 券商損益範圍錯誤');
    }
    const manualIds=new Set();
    for(const [i,t] of d.manualTrades.entries()){
      if(!t||!['LONG','SHORT'].includes(t.direction)||!t.ticker||!t.currency)throw Error('歷史交易 '+(i+1)+' 格式錯誤');
      for(const k of ['open','close'])if(!Number.isFinite(Date.parse(t[k])))throw Error('歷史交易日期錯誤');
      if(Date.parse(t.close)<Date.parse(t.open))throw Error('平倉不可早於開倉');
      for(const k of ['qty','entry','exit'])if(!finite(t[k])||t[k]<=0)throw Error('歷史交易 '+k+' 錯誤');
      for(const k of ['pnl','returnPct','priceReturnPct','rMultiple'])if(has(t[k])&&!finite(t[k]))throw Error('歷史交易 '+k+' 錯誤');
      if(t.id){if(manualIds.has(t.id))throw Error('歷史交易重複 ID');manualIds.add(t.id);}
    }
    const holdingIds=new Set();
    for(const [i,h] of d.externalHoldings.entries()){
      const label='外部持倉 '+(i+1);
      if(!h||typeof h!=='object'||Array.isArray(h))throw Error(label+' 格式錯誤');
      for(const k of ['id','ticker','asset','venue','asOf','currency'])if(typeof h[k]!=='string'||!h[k].trim())throw Error(label+' 缺少 '+k);
      if(holdingIds.has(h.id))throw Error(label+' 重複 ID');holdingIds.add(h.id);
      if(!Number.isFinite(Date.parse(h.asOf)))throw Error(label+' 日期錯誤');
      for(const k of ['qty','currentPrice'])if(!finite(h[k])||h[k]<0)throw Error(label+' '+k+' 格式錯誤');
      for(const k of ['avgCost','fx','marketValueTwd','unrealizedTwd'])if(has(h[k])&&!finite(h[k]))throw Error(label+' '+k+' 必須是數字或 null');
      if(has(h.avgCost)&&h.avgCost<0)throw Error(label+' avgCost 格式錯誤');
      if(has(h.fx)&&h.fx<=0)throw Error(label+' fx 格式錯誤');
      if(has(h.marketValueTwd)&&h.marketValueTwd<0)throw Error(label+' marketValueTwd 格式錯誤');
      if(has(h.source)&&![...CAPITAL_SOURCE_KEYS,'mixed'].includes(h.source))throw Error(label+' 資金來源錯誤');
    }
    d.meta.capitalTracking=normalizeCapitalTracking(d.meta.capitalTracking);
    d.meta.securitiesCash=normalizeSecuritiesCash(d.meta.securitiesCash);
    const capitalIds=new Set();
    for(const [i,e] of d.meta.capitalTracking.events.entries()){
      if(capitalIds.has(e.id))throw Error('資金異動 '+(i+1)+' 重複 ID');
      capitalIds.add(e.id);
    }
    for(const v of Object.values(d.cash))if(!finite(v))throw Error('資金池必須為數字');
    for(const q of Object.values(d.quotes))if(!q||!finite(q.price)||q.price<=0||!finite(q.fx)||q.fx<=0)throw Error('行情價格或匯率錯誤');
    return d;
  }
  function compute(data){
    const positions=new Map(),active=new Map(),realized=[],trades=[],issues=[];
    const tx=[...data.transactions].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
    for(const t of tx){
      const key=positionKey(t);
      if(!positions.has(key))positions.set(key,{account:t.account,ticker:t.ticker,currency:t.currency,asset:t.asset,qty:0,costBase:0,costTwd:0});
      const p=positions.get(key),gross=t.qty*t.price,fees=(t.fee||0)+(t.tax||0);
      if(t.side==='BUY'||t.side==='INIT'){
        const base=gross+fees,twd=has(t.settlementTwd)?Math.abs(t.settlementTwd):base*t.fx;
        if(!p.qty)active.set(key,{ticker:t.ticker,asset:t.asset,currency:t.currency,account:t.account,open:t.date,buyCostTwd:0,buyCostBase:0,realizedTwd:0,realizedBase:0,riskBase:0,riskComplete:true,estimated:t.side==='INIT',exitReason:''});
        const tr=active.get(key);tr.buyCostTwd+=twd;tr.buyCostBase+=base;
        if(has(t.stop)&&t.stop<t.price&&t.stop>=0)tr.riskBase+=(t.price-t.stop)*t.qty+fees;else tr.riskComplete=false;
        p.qty+=t.qty;p.costBase+=base;p.costTwd+=twd;
      }else if(t.side==='SELL'){
        if(t.qty>p.qty+1e-9||p.qty<=0){issues.push(t.ticker+' '+t.date+'：賣出數量大於持倉，損益未納入');continue;}
        const costBase=p.costBase*t.qty/p.qty,costTwd=p.costTwd*t.qty/p.qty;
        const calcPnlBase=gross-fees-costBase;
        const calcPnlTwd=(has(t.settlementTwd)?t.settlementTwd:(gross-fees)*t.fx)-costTwd;
        const tr=active.get(key),whole=t.brokerPnlScope==='position';
        if(whole&&Math.abs(p.qty-t.qty)>1e-8){issues.push(t.ticker+'：整輪損益只能用於最後平倉');continue;}
        // Whole-position broker totals reconcile the accumulated results once.
        // The last realization is a balancing allocation, not a broker fill P/L.
        const pnlBase=has(t.brokerPnlBase)?t.brokerPnlBase-(whole?tr.realizedBase:0):calcPnlBase;
        const pnlTwd=has(t.brokerPnlTwd)?t.brokerPnlTwd-(whole?tr.realizedTwd:0):calcPnlTwd;
        realized.push({...t,pnlBase,pnlTwd,calcPnlBase,calcPnlTwd});
        p.qty-=t.qty;p.costBase-=costBase;p.costTwd-=costTwd;
        tr.realizedBase+=pnlBase;tr.realizedTwd+=pnlTwd;tr.exitReason=t.exitReason||tr.exitReason;
        if(Math.abs(p.qty)<1e-8){
          p.qty=0;p.costBase=0;p.costTwd=0;
          tr.close=t.date;
          tr.returnPct=has(t.tradeReturnPct)?t.tradeReturnPct:tr.realizedBase/tr.buyCostBase*100;
          const risk=has(t.originalRiskBase)?t.originalRiskBase:(tr.riskComplete?tr.riskBase:0);
          tr.rMultiple=risk>0?tr.realizedBase/risk:NaN;
          tr.riskBase=risk;tr.holdHours=(Date.parse(tr.close)-Date.parse(tr.open))/36e5;
          if(t.account==='波段')trades.push({...tr});
        }
      }
    }
    return {positions:[...positions.values()],realized,trades,issues};
  }
  function transactionValueTwd(t){
    if(has(t.settlementTwd)&&finite(t.settlementTwd))return Math.abs(t.settlementTwd);
    const gross=t.qty*t.price,fees=(t.fee||0)+(t.tax||0);
    return (t.side==='SELL'?Math.max(0,gross-fees):gross+fees)*t.fx;
  }
  function pendingSettlementFromTransaction(t){
    if(!t||!['BUY','SELL'].includes(t.side))throw Error('只有買進或賣出可以建立待交割款');
    if(!t.id||!t.date||!t.ticker||!t.currency)throw Error('交易資料不足，無法建立待交割款');
    const gross=Number(t.qty)*Number(t.price),fees=Number(t.fee||0)+Number(t.tax||0),fx=t.currency==='TWD'?1:Number(t.fx);
    if(!finite(gross)||gross<=0||!finite(fees)||fees<0||!finite(fx)||fx<=0)throw Error('交易金額或匯率錯誤，無法建立待交割款');
    const amount=t.side==='BUY'?-(gross+fees):gross-fees;
    if(!finite(amount)||amount===0||(t.side==='SELL'&&amount<0))throw Error('待交割金額錯誤');
    return {id:'settlement-'+t.id,date:t.date,currency:t.currency,amount,fx,ticker:t.ticker,side:t.side,note:'由交易自動建立；交割後請以銀行實際帳面餘額結清。'};
  }
  function externalFundingTwd(data){
    const seen=new Set();let total=0;
    for(const holding of data?.externalHoldings||[]){
      for(const event of Array.isArray(holding.fundingHistory)?holding.fundingHistory:[]){
        const amount=Number(event.originalTwd);
        if(!finite(amount)||amount<=0)continue;
        const key=[holding.venue||'',event.date||'',event.source||'',amount,event.amountUsdt??''].join('|');
        if(seen.has(key))continue;seen.add(key);total+=amount;
      }
    }
    return total;
  }
  function securitiesCashSummary(data){
    const snapshot=normalizeSecuritiesCash(data?.meta?.securitiesCash);
    const pendingTwd=snapshot.pendingSettlements.reduce((sum,item)=>sum+item.amount*item.fx,0);
    const availableTwd=snapshot.accountBalanceTwd-snapshot.reservedTwd;
    return {...snapshot,configured:snapshot.enabled&&Boolean(snapshot.asOf),availableTwd,pendingTwd,postSettlementTwd:snapshot.accountBalanceTwd+pendingTwd};
  }
  function fundSummary(data,result){
    const plan=normalizeFundPlan(data?.meta?.fundPlan),profile=normalizeCapitalTracking(data?.meta?.capitalTracking),computed=result||compute(data);
    const buckets={
      '長期':{allocation:plan.longTerm,available:plan.longTerm,cost:0,marketValue:0,realized:0,missingQuotes:0,tickers:[]},
      '波段':{allocation:plan.swing,available:plan.swing,cost:0,marketValue:0,realized:0,missingQuotes:0,tickers:[]}
    };
    for(const t of data.transactions){
      const b=buckets[t.account],value=transactionValueTwd(t);
      b.available+=t.side==='SELL'?value:-value;
    }
    for(const p of computed.positions.filter(x=>x.qty>0)){
      const b=buckets[p.account],q=data.quotes[p.ticker];
      b.cost+=p.costTwd;b.tickers.push(p.ticker);
      if(q&&finite(q.price)&&q.price>0&&finite(q.fx)&&q.fx>0)b.marketValue+=p.qty*q.price*q.fx;
      else b.missingQuotes++;
    }
    for(const t of computed.realized)buckets[t.account].realized+=t.pnlTwd;
    for(const b of Object.values(buckets)){
      b.tickers=[...new Set(b.tickers)];
      // Preserve the cash-flow estimate for reconciliation; do not alter trades.
      b.cashFlowAvailable=b.available;
      b.available=b.allocation-b.cost+b.realized;
      b.reconciliationAdjustment=b.available-b.cashFlowAvailable;
      b.equityKnown=b.missingQuotes?NaN:b.available+b.marketValue;
      b.netGainKnown=b.equityKnown-b.allocation;
      b.usagePct=b.allocation?(b.allocation-b.available)/b.allocation*100:NaN;
    }
    const externalFunding=Math.max(externalFundingTwd(data),normalizeSecuritiesCash(data?.meta?.securitiesCash).externalInvestmentTransfersTwd);
    const swingStockAllocationTwd=plan.swing-externalFunding,swingAvailableTwd=buckets['波段'].available-externalFunding;
    const grossInvestmentAvailable=buckets['長期'].available+buckets['波段'].available+profile.cashAdjustmentTwd;
    return {plan,buckets,totalPlan:plan.longTerm+plan.swing+plan.loan+plan.reserve,investmentPlan:plan.longTerm+plan.swing,protectedPlan:plan.loan+plan.reserve,cashAdjustmentTwd:profile.cashAdjustmentTwd,externalFundingTwd:externalFunding,swingStockAllocationTwd,swingAvailableTwd,grossInvestmentAvailable,investmentAvailable:buckets['長期'].available+swingAvailableTwd+profile.cashAdjustmentTwd};
  }
  function capitalSummary(data,currentPnlTwd){
    const profile=normalizeCapitalTracking(data?.meta?.capitalTracking),issues=[];
    const values={loan:profile.openingLoan,self:profile.openingSelf,family:profile.openingFamily};
    const attributedPnl={loan:0,self:0,family:0};
    const openingTotal=CAPITAL_SOURCE_KEYS.reduce((sum,key)=>sum+values[key],0);
    const allocate=delta=>{
      if(!finite(delta)){if(!issues.includes('目前投資損益不完整，暫停來源分攤'))issues.push('目前投資損益不完整，暫停來源分攤');return;}
      const total=CAPITAL_SOURCE_KEYS.reduce((sum,key)=>sum+values[key],0);
      if(Math.abs(delta)<1e-12)return;
      if(!(total>0)){issues.push('資金來源本金為 0，無法分攤損益');return;}
      for(const key of CAPITAL_SOURCE_KEYS){
        const gain=delta*values[key]/total;
        attributedPnl[key]+=gain;
        values[key]+=gain;
      }
    };
    let previousPnl=profile.pnlBaselineTwd;
    const events=profile.events.map((event,index)=>({...event,index})).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||a.index-b.index);
    for(const event of events){
      allocate(event.pnlCheckpointTwd-previousPnl);
      previousPnl=event.pnlCheckpointTwd;
      if(event.type==='IN')values[event.source]+=event.amount;
      else if(event.source==='proRata'){
        const total=CAPITAL_SOURCE_KEYS.reduce((sum,key)=>sum+values[key],0);
        if(event.amount>total+1e-7)issues.push(event.date+'：按比例提領超過投資池份額');
        if(total>0)for(const key of CAPITAL_SOURCE_KEYS)values[key]-=event.amount*values[key]/total;
      }else{
        if(event.amount>values[event.source]+1e-7)issues.push(event.date+'：提領超過該來源份額');
        values[event.source]-=event.amount;
      }
    }
    allocate(currentPnlTwd-previousPnl);
    const sourceTotal=CAPITAL_SOURCE_KEYS.reduce((sum,key)=>sum+values[key],0);
    const ratios=Object.fromEntries(CAPITAL_SOURCE_KEYS.map(key=>[key,sourceTotal>0?values[key]/sourceTotal:NaN]));
    const outstandingPrincipal=Math.max(0,profile.loanGross-profile.principalRepaid);
    return {
      profile,configured:profile.enabled&&Boolean(profile.resetDate)&&openingTotal>0,openingTotal,sourceTotal,values,ratios,attributedPnl,issues,
      currentPnlTwd,trackedPnlTwd:finite(currentPnlTwd)?currentPnlTwd-profile.pnlBaselineTwd:NaN,
      loanAttributedPnl:attributedPnl.loan,nonLoanAttributedPnl:attributedPnl.self+attributedPnl.family,
      loanNetResult:attributedPnl.loan-profile.loanFee-profile.interestPaid,outstandingPrincipal
    };
  }
  function merge(current,incoming){
    const d=validate(current),src=validate(incoming),report={txAdded:0,txUpdated:0,txSkipped:0,manualAdded:0,manualUpdated:0,manualSkipped:0,holdingAdded:0,holdingUpdated:0,holdingSkipped:0,securitiesCashUpdated:0,securitiesCashSkipped:0,changes:[]};
    for(const t of src.transactions){
      const idx=d.transactions.findIndex(x=>x.id===t.id);
      if(idx>=0){
        const old=d.transactions[idx],next={...old,...t};
        const changed=Object.keys(next).filter(k=>JSON.stringify(next[k])!==JSON.stringify(old[k]));
        if(changed.length){d.transactions[idx]=next;report.txUpdated++;report.changes.push(t.ticker+' '+t.date+'：'+changed.join(', '));}else report.txSkipped++;
      }else{
        const match=d.transactions.find(x=>txKey(x)===txKey(t));
        if(match){
          const fields=['fee','tax','fx','stop','brokerPnlBase','brokerPnlTwd','brokerPnlScope','tradeReturnPct','settlementTwd','originalRiskBase'];
          if(fields.some(k=>has(t[k])&&t[k]!==match[k]))throw Error('相同成交但 ID 不同且欄位衝突：'+t.ticker+' '+t.date+'。請沿用既有 ID 修正。');
          report.txSkipped++;
        }else{d.transactions.push(t);report.txAdded++;}
      }
    }
    for(const t of src.manualTrades){
      const idx=t.id?d.manualTrades.findIndex(x=>x.id===t.id):-1;
      if(idx>=0){const next={...d.manualTrades[idx],...t};if(JSON.stringify(next)!==JSON.stringify(d.manualTrades[idx])){d.manualTrades[idx]=next;report.manualUpdated++;}else report.manualSkipped++;}
      else if(d.manualTrades.some(x=>sameManual(x,t)))report.manualSkipped++;
      else if(d.manualTrades.some(x=>manualKey(x)===manualKey(t)))throw Error('歷史交易衝突：'+t.ticker+' '+t.open+'。請使用完整還原或穩定 ID 修正。');
      else{d.manualTrades.push(t);report.manualAdded++;}
    }
    for(const h of src.externalHoldings){
      const idx=d.externalHoldings.findIndex(x=>x.id===h.id);
      if(idx>=0){
        const next={...d.externalHoldings[idx],...h};
        if(JSON.stringify(next)!==JSON.stringify(d.externalHoldings[idx])){d.externalHoldings[idx]=next;report.holdingUpdated++;report.changes.push(h.ticker+' 外部持倉快照已更新');}
        else report.holdingSkipped++;
      }else{d.externalHoldings.push(h);report.holdingAdded++;}
    }
    const incomingCash=src.meta.securitiesCash,currentCash=d.meta.securitiesCash;
    if(incomingCash.enabled&&incomingCash.asOf){
      const currentAt=currentCash.asOf?Date.parse(currentCash.asOf):-Infinity;
      const newer=Date.parse(incomingCash.asOf)>=currentAt;
      if(newer&&JSON.stringify(incomingCash)!==JSON.stringify(currentCash)){
        d.meta.securitiesCash=incomingCash;report.securitiesCashUpdated=1;report.changes.push('證券戶現金快照已更新至 '+incomingCash.asOf);
      }else report.securitiesCashSkipped=1;
    }
    // An add-on transaction file may have been imported before a full backup.
    // Fill missing reference data without replacing snapshots already entered here.
    for(const [ticker,quote] of Object.entries(src.quotes)){
      if(!d.quotes[ticker]){d.quotes[ticker]=quote;report.changes.push(ticker+' 行情已由備份補回');}
    }
    const planTotal=plan=>Number(plan?.longTerm||0)+Number(plan?.swing||0)+Number(plan?.loan||0)+Number(plan?.reserve||0);
    if(planTotal(d.meta.fundPlan)===0&&planTotal(src.meta.fundPlan)>0){
      d.meta.fundPlan=src.meta.fundPlan;report.changes.push('資金配置已由完整備份補回');
    }
    if(!(Number(d.meta.currentUsdTwd)>1)&&Number(src.meta.currentUsdTwd)>1){
      d.meta.currentUsdTwd=src.meta.currentUsdTwd;report.changes.push('參考匯率已由完整備份補回');
    }
    if(!d.meta.capitalTracking?.enabled&&src.meta.capitalTracking?.enabled){
      d.meta.capitalTracking=src.meta.capitalTracking;report.changes.push('資金來源設定已由完整備份補回');
    }
    if(!(Number(d.meta.cryptoSnapshot?.totalValueTwd)>=0)&&Number(src.meta.cryptoSnapshot?.totalValueTwd)>=0&&src.meta.cryptoSnapshot?.totalValueTwd!=null){
      d.meta.cryptoSnapshot=src.meta.cryptoSnapshot;report.changes.push('幣安總資產快照已由完整備份補回');
    }
    // Keep existing cash and quote snapshots; only absent reference data is filled.
    const checked=validate(d),result=compute(checked);
    if(result.issues.length)throw Error(result.issues.join('\n'));
    return {db:checked,report};
  }
  // Monetary outcomes are grouped by denomination; zero outcomes remain samples.
  function moneyStats(trades){
    const groups=new Map();
    for(const t of trades){
      if(!finite(t.pnl)||typeof t.currency!=='string'||!t.currency.trim())continue;
      const currency=t.currency.trim().toUpperCase();
      if(!groups.has(currency))groups.set(currency,[]);
      groups.get(currency).push(t.pnl);
    }
    return [...groups].map(([currency,values])=>{
      const wins=values.filter(v=>v>0),losses=values.filter(v=>v<0);
      const sum=a=>a.reduce((s,v)=>s+v,0);
      const total=sum(values),average=total/values.length;
      const avgWin=wins.length?sum(wins)/wins.length:NaN;
      const avgLoss=losses.length?-sum(losses)/losses.length:NaN;
      return {currency,count:values.length,wins:wins.length,losses:losses.length,
        total,average,avgWin,avgLoss,payoff:avgLoss>0?avgWin/avgLoss:NaN,
        normalized:avgLoss>0?average/avgLoss:NaN};
    });
  }
  function stats(trades){
    const completed=trades.filter(t=>finite(t.realizedTwd));
    const rated=completed.filter(t=>finite(t.returnPct));
    const wins=completed.filter(t=>t.realizedTwd>0),ratedWins=rated.filter(t=>t.realizedTwd>0),ratedLosses=rated.filter(t=>t.realizedTwd<0);
    const avg=a=>a.length?a.reduce((s,t)=>s+t.returnPct,0)/a.length:NaN;
    const aw=avg(ratedWins),al=Math.abs(avg(ratedLosses));
    return {count:completed.length,returnCount:rated.length,winRate:completed.length?wins.length/completed.length*100:NaN,avgWin:aw,avgLoss:al,payoff:al>0?aw/al:NaN,expectancy:avg(rated)};
  }
  const api={VERSION,LONG_TERM_TICKERS,DEFAULT_FUND_PLAN,DEFAULT_CAPITAL_TRACKING,DEFAULT_SECURITIES_CASH,CAPITAL_SOURCE_KEYS,validate,compute,merge,stats,moneyStats,sameManual,manualKey,classifyAccount,normalizeFundPlan,normalizeCapitalTracking,normalizeSecuritiesCash,parseCapitalSetup,applyPolicy,fundSummary,securitiesCashSummary,externalFundingTwd,capitalSummary,transactionValueTwd,pendingSettlementFromTransaction,recordExternalInvestmentTransfer};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.Ledger=api;
})(typeof globalThis!=='undefined'?globalThis:this);
