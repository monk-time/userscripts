// ==UserScript==
// @name        Anti-Anti-AdBlock
// @namespace   monk-time
// @author      monk-time
// @include     https://www.allmusic.com/*
// @include     https://openload.co/*
// @include     https://iomedia.ru/*
// @include     http://streamin.to/*
// @include     https://temp-mail.org/*
// @run-at      document-start
// @icon        https://adblockplus.org/favicon.ico
// ==/UserScript==

'use strict';

window.addEventListener('beforescriptexecute', e => {
    // e.target.remove();
    if (e.target.text.toLowerCase().includes('adblock')) {
        console.log('Gotcha! Anti-Adblock, Killing the following script:');
        console.log(e.target.text);
        e.preventDefault();
        e.stopPropagation();
    }
}, true);
