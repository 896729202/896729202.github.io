'use strict';
const search=document.querySelector('[data-case-search]');
search?.addEventListener('input',()=>{let count=0;document.querySelectorAll('[data-case]').forEach(card=>{card.hidden=!card.dataset.case.toLowerCase().includes(search.value.trim().toLowerCase());if(!card.hidden)count++;});document.querySelector('[data-case-empty]').hidden=count>0;});
const spanSearch=document.querySelector('[data-span-search]'),errorsOnly=document.querySelector('[data-errors-only]');
function filterSpans(){let count=0;document.querySelectorAll('[data-span]').forEach(row=>{row.hidden=!row.dataset.span.toLowerCase().includes(spanSearch.value.trim().toLowerCase())||(errorsOnly.checked&&row.dataset.failed!=='true');if(!row.hidden)count++;});document.querySelector('[data-span-count]').textContent=`${count} 条`;document.querySelector('[data-span-empty]').hidden=count>0;}
spanSearch?.addEventListener('input',filterSpans);errorsOnly?.addEventListener('change',filterSpans);
