// ==UserScript==
// @name        IMDb - Shorten and color credits
// @namespace   monk-time
// @author      monk-time
// @include     /https?://.*imdb\.com/name/nm\d+/(\?ref)?/
// @icon        http://www.imdb.com/favicon.ico
// ==/UserScript==

'use strict';

const shortenCredits = true;
const colorNonFeatures = true;

const $$ = (sel, context) => [...(context || document).querySelectorAll(sel)];
const section = type => `#filmography div[id^="filmo-head-${type}"] + .filmo-category-section`;

if (shortenCredits) {
    $$(`${section('act')} > .filmo-row > br`)
        .filter(el => {
            // Exclude entries with no credit
            const nextNode = el.nextSibling;
            const hasSpaceNext = nextNode && nextNode.nodeType === 3 && nextNode.length === 1;
            const hasAnchorNext = el.nextElementSibling && el.nextElementSibling.tagName === 'A';
            return !hasSpaceNext || hasAnchorNext;
        })
        .forEach(el => el.replaceWith(' — '));
}

if (colorNonFeatures) {
    $$(`${section('director')} > *`).forEach(el => {
        const text = el.textContent.trim().replace(/\n+/g, ' ');
        const re = /\([^)]*(segment|pre-production|uncredited)[^)]*\)/i;
        if (re.test(text)) {
            el.style.opacity = 0.6;
        }
    });
}
