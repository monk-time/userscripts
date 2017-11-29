// ==UserScript==
// @name        IMDb - Sort board threads
// @namespace   monk-time
// @author      monk-time
// @include     https://filmboards.com/board/*
// @icon        http://www.imdb.com/favicon.ico
// ==/UserScript==

'use strict';

const $$ = document.querySelectorAll.bind(document);
const $ = document.querySelector.bind(document);
const selThreads = '.thread.odd, .thread.even';
const container = $('.threads');

const getPostNum = thread => Number(thread.querySelector(':scope .replies a').textContent);
const sortAndAppend = threads => threads
    .sort((a, b) => getPostNum(b) - getPostNum(a))
    .forEach(el => container.appendChild(el));

const parseHTML = html => new DOMParser().parseFromString(html, 'text/html');
const extractThreads = async url => {
    const r = await fetch(url);
    return [...parseHTML(await r.text()).querySelectorAll(selThreads)];
};

const appendNextPages = () => {
    const pagesLinks = [...$('.pagination').querySelectorAll('a:not(.current)')];
    $$('.threads-meta').forEach(pageBar => pageBar.remove());
    Promise.all(pagesLinks.map(page => extractThreads(page.href)))
        .then(results => {
            const fetched = [].concat(...results);
            sortAndAppend([...$$(selThreads), ...fetched]);
        });
};

sortAndAppend([...$$(selThreads)]);

for (const link of $$('.new-topic > a')) {
    link.href = '';
    link.text = 'Append next pages';
    link.addEventListener('click', e => {
        e.preventDefault();
        appendNextPages();
    });
}
