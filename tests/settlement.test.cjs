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
