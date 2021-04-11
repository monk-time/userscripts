// ==UserScript==
// @name        IMDb - Less connections
// @namespace   monk-time
// @author      monk-time
// @include     https://www.imdb.com/title/tt*/movieconnections/*
// @icon        http://www.imdb.com/favicon.ico
// ==/UserScript==

'use strict';

const elContainer = document.querySelector('#connections_content > .list');
// Reverse order simplifies getHeader significantly
const items = [...elContainer.children].map((el, i) => ({ el, i })).reverse();
const headers = items.filter(({ el }) => el.tagName === 'H4');
const getHeader = j => headers.find(({ i }) => i < j);
const re = /\((TV Episode|TV Mini-Series|TV Series|TV Movie|TV Short|Video Game|Video)\)/;

for (const { el, i } of items) {
    if (!el.classList.contains('soda')) continue;
    if (!el.querySelector('.mme-with-tooltip')) {
        if (re.test(el.textContent)) el.remove();
        continue;
    }

    getHeader(i).el.insertAdjacentElement('afterend', el);
}
