// Market quotes are fetched on the owner's device. No portfolio is uploaded to GitHub.
(function(root){
  'use strict';
  function parseQuote(payload, fetchedAt = new Date()){
    if(payload?.error)throw Error(String(payload.error));
    const price=Number(payload?.c),timestamp=Number(payload?.t);
    if(!Number.isFinite(price)||price<=0||!Number.isFinite(timestamp)||timestamp<=0)throw Error('沒有可用的行情');
    const updated=new Date(timestamp*1000);
    if(!Number.isFinite(updated.getTime())||updated.getTime()>fetchedAt.getTime()+300000)throw Error('行情時間錯誤');
    if(fetchedAt.getTime()-updated.getTime()>7*86400000)throw Error('行情超過 7 天，未覆寫舊價格');
    return {price,updated:updated.toISOString(),fetchedAt:fetchedAt.toISOString(),source:'Finnhub'};
  }
  async function fetchQuote(ticker,key,fetcher=fetch){
    const url=new URL('https://finnhub.io/api/v1/quote');
    url.searchParams.set('symbol',ticker);
    url.searchParams.set('token',key);
    const response=await fetcher(url.toString(),{cache:'no-store'});
    if(!response.ok)throw Error(response.status===429?'行情服務請求太頻繁':`行情服務 HTTP ${response.status}`);
    return parseQuote(await response.json());
  }
  const api={parseQuote,fetchQuote};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.MarketQuotes=api;
})(typeof globalThis!=='undefined'?globalThis:this);
