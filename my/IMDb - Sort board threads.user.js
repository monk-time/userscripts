// ==UserScript==
// @name        IMDb - Sort board threads
// @namespace   monk-time
// @author      monk-time
// @include     https://moviechat.org/tt*
// @icon        http://www.imdb.com/favicon.ico
// ==/UserScript==

'use strict';

const $$ = document.querySelectorAll.bind(document);
const $ = document.querySelector.bind(document);
const baseURL = `${document.location}?page=`;
const selThreads = '.thread-odd, .thread-even';
const selPostNum = '.row > div:nth-child(3)';
const selMaxPageNum = '.pagination :last-child a';
const getPageLinks = () => {
    const el = $(selMaxPageNum);
    if (!(el && el.href && el.href.match(/\d+$/))) {
        console.log('No other pages found');
        return [];
    }

    const maxPageNum = Number(el.href.match(/\d+$/)[0]);
    console.log(`Total pages: ${maxPageNum}`);
    return [...new Array(maxPageNum - 1)]
        .map((_, i) => i + 2)
        .map(i => `${baseURL}${i}`);
};

const container = $(selThreads).parentNode;

const getPostNum = thread => Number(thread.querySelector(selPostNum).textContent);
const sortAndAppend = threads => threads
    .sort((a, b) => getPostNum(b) - getPostNum(a))
    .forEach(el => container.appendChild(el));

const parseHTML = html => new DOMParser().parseFromString(html, 'text/html');
const extractThreads = async url => {
    const r = await fetch(url);
    return [...parseHTML(await r.text()).querySelectorAll(selThreads)];
};

const appendNextPages = () => {
    Promise.all(getPageLinks().map(extractThreads))
        .then(results => {
            const fetched = [].concat(...results);
            sortAndAppend([...$$(selThreads), ...fetched]);
        });
};

const link = $('#discover a');
link.href = '';
link.text = 'Sort and append next pages';
link.addEventListener('click', e => {
    e.preventDefault();
    console.log('Button clicked');
    $('.pagination').style.display = 'none';
    sortAndAppend([...$$(selThreads)]);
    appendNextPages();
});
