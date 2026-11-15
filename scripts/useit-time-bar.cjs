'use strict';

// Reuse the established runtime colours and row layout across the newer reports.
const phases=[
 ['planning','模型请求与等待'],
 ['generation','生图'],
 ['placement','装配与保存'],
 ['other','其他执行与衔接']
];

module.exports=function renderTimeBar(parts){
 const total=parts?.reduce((sum,n)=>sum+n,0);
 if(parts?.length!==phases.length||!parts.every(n=>Number.isFinite(n)&&n>=0)||!(total>0))return '';
 const seconds=n=>`${n.toFixed(1)} 秒`;
 const percent=n=>n/total*100;
 const bars=phases.map(([key,title],i)=>`<span class="runtime-color-${key}" style="width:${percent(parts[i])}%" title="${title} ${seconds(parts[i])} · ${percent(parts[i]).toFixed(1)}%"></span>`).join('');
 const rows=phases.map(([key,title],i)=>`<div class="runtime-row runtime-color-${key}"><span class="runtime-dot" aria-hidden="true"></span><div><strong>${title}</strong></div><div class="runtime-value"><b>${seconds(parts[i])}</b><small>${percent(parts[i]).toFixed(1)}%</small></div></div>`).join('');
 return `<div class="time-composition"><div class="runtime-stack" role="img" aria-label="时间组成：${phases.map(([,title],i)=>title+' '+seconds(parts[i])).join('；')}">${bars}</div><div class="runtime-list">${rows}</div></div>`;
};
