const test = require('node:test');
const assert = require('node:assert/strict');
const Ledger = require('../ledger.js');

function baseDb(transaction) {
  return Ledger.applyPolicy({
    transactions: [transaction],
    manualTrades: [],
    externalHoldings: [],
    cash: {},
    quotes: {},
    meta: {
      securitiesCash: {
        enabled: true,
        asOf: '2026-10-07T09:00:00+08:00',
        accountBalanceTwd: 100000,
        reservedTwd: 32000,
        externalInvestmentTransfersTwd: 0,
        externalTransfers: [],
        investmentContributions: [],
        pendingSettlements: [Ledger.pendingSettlementFromTransaction(transaction)]
      }
    }
  });
}

test('pending settlement preserves its source transaction id', () => {
  const transaction = {id:'buy-1',date:'2026-10-07T22:00:00+08:00',account:'波段',ticker:'TEST',asset:'美股',side:'BUY',qty:50,price:20,fee:1,tax:0,fx:31.7,fxStatus:'estimate',currency:'USD'};
  const db = baseDb(transaction);
  assert.equal(db.meta.securitiesCash.pendingSettlements[0].transactionId, 'buy-1');
});

test('actual TWD amount finalizes FX, cost, and removes pending settlement', () => {
  const transaction = {id:'buy-1',date:'2026-10-07T22:00:00+08:00',account:'波段',ticker:'TEST',asset:'美股',side:'BUY',qty:50,price:20,fee:1,tax:0,fx:31.7,fxStatus:'estimate',currency:'USD'};
  const completed = Ledger.completeTransactionSettlement(baseDb(transaction), {transactionId:'buy-1',settledAt:'2026-10-08T10:00:00+08:00',actualTwd:31831.8});
  const saved = completed.transactions[0];
  assert.equal(saved.fxStatus, 'final');
  assert.equal(saved.settlementTwd, 31831.8);
  assert.equal(saved.fx, 31.8);
  assert.equal(completed.meta.securitiesCash.pendingSettlements.length, 0);
  assert.equal(Ledger.compute(completed).positions[0].costTwd, 31831.8);
});

test('actual batch FX can finalize a trade when the bank only shows net settlement', () => {
  const transaction = {id:'sell-1',date:'2026-10-07T23:00:00+08:00',account:'波段',ticker:'TEST',asset:'美股',side:'SELL',qty:10,price:30,fee:1,tax:0,fx:31.7,fxStatus:'estimate',currency:'USD'};
  const buy = {id:'opening',date:'2026-10-01T22:00:00+08:00',account:'波段',ticker:'TEST',asset:'美股',side:'BUY',qty:10,price:25,fee:0,tax:0,fx:31.7,fxStatus:'final',currency:'USD'};
  const db = baseDb(transaction);
  db.transactions.unshift(buy);
  const completed = Ledger.completeTransactionSettlement(db, {transactionId:'sell-1',settledAt:'2026-10-08T10:00:00+08:00',actualFx:31.82});
  const saved = completed.transactions.find(item => item.id === 'sell-1');
  assert.equal(saved.fx, 31.82);
  assert.equal(saved.settlementTwd, 299 * 31.82);
  assert.equal(completed.meta.securitiesCash.pendingSettlements.length, 0);
});

test('one bank debit finalizes a mixed buy and sell settlement batch', () => {
  const transactions = [
    {id:'asst-buy',date:'2026-10-08T22:00:00+08:00',account:'波段',ticker:'ASST',asset:'美股',side:'BUY',qty:20,price:28,fee:2,tax:0,fx:31.8,fxStatus:'estimate',currency:'USD'},
    {id:'on-sell',date:'2026-10-08T22:10:00+08:00',account:'波段',ticker:'ON',asset:'美股',side:'SELL',qty:20,price:80.5201,fee:2,tax:0.04,fx:31.8,fxStatus:'estimate',currency:'USD'},
    {id:'sndk-buy',date:'2026-10-09T22:00:00+08:00',account:'長期',ticker:'SNDK',asset:'美股',side:'BUY',qty:1,price:1600,fee:0.1,tax:0,fx:31.8,fxStatus:'estimate',currency:'USD'},
    {id:'avgo-369',date:'2026-10-09T22:05:00+08:00',account:'長期',ticker:'AVGO',asset:'美股',side:'BUY',qty:1,price:369,fee:0.1,tax:0,fx:31.8,fxStatus:'estimate',currency:'USD'},
    {id:'avgo-370',date:'2026-10-09T22:10:00+08:00',account:'長期',ticker:'AVGO',asset:'美股',side:'BUY',qty:1,price:370,fee:0.1,tax:0,fx:31.8,fxStatus:'estimate',currency:'USD'}
  ];
  const db = Ledger.applyPolicy({
    transactions,
    manualTrades:[],externalHoldings:[],cash:{},quotes:{},
    meta:{securitiesCash:{enabled:true,asOf:'2026-10-09T09:00:00+08:00',accountBalanceTwd:552494,reservedTwd:41338,externalInvestmentTransfersTwd:0,externalTransfers:[],investmentContributions:[],pendingSettlements:transactions.slice(0,2).map(Ledger.pendingSettlementFromTransaction)}}
  });
  const completed = Ledger.completeBatchSettlement(db,{transactionIds:transactions.map(item=>item.id),settledAt:'2026-10-12T10:00:00+08:00',actualTwd:41338});
  const expectedFx=41338/1292.938;
  assert.ok(Math.abs(completed.transactions[0].fx-expectedFx)<1e-10);
  assert.ok(completed.transactions.every(item=>item.fxStatus==='final'&&item.settledAt==='2026-10-12T10:00:00+08:00'));
  assert.ok(completed.transactions.every(item=>Math.abs(item.fx-expectedFx)<1e-10));
  assert.equal(completed.meta.securitiesCash.pendingSettlements.length,0);
  const signedTwd=completed.transactions.reduce((sum,item)=>sum+(item.side==='BUY'?item.settlementTwd:-item.settlementTwd),0);
  assert.ok(Math.abs(signedTwd-41338)<1e-8);
});

test('batch settlement rejects a TWD amount when the selected trades net to zero', () => {
  const transactions=[
    {id:'buy',date:'2026-10-09T22:00:00+08:00',account:'波段',ticker:'TEST',asset:'美股',side:'BUY',qty:1,price:100,fee:0,tax:0,fx:32,fxStatus:'estimate',currency:'USD'},
    {id:'sell',date:'2026-10-09T22:01:00+08:00',account:'波段',ticker:'TEST',asset:'美股',side:'SELL',qty:1,price:100,fee:0,tax:0,fx:32,fxStatus:'estimate',currency:'USD'}
  ];
  const db=Ledger.applyPolicy({transactions,manualTrades:[],externalHoldings:[],cash:{},quotes:{},meta:{}});
  assert.throws(()=>Ledger.completeBatchSettlement(db,{transactionIds:['buy','sell'],settledAt:'2026-10-12T10:00:00+08:00',actualTwd:100}),/淨額為 0/);
});
