// ==UserScript==
// @name        IMDb - Less connections
// @namespace   monk-time
// @author      monk-time
// @include     https://www.imdb.com/title/tt*/movieconnections*
// @icon        http://www.imdb.com/favicon.ico
// ==/UserScript==

'use strict';

const elContainer = document.querySelector('.ipc-page-grid__item--span-2');
const badTypes = [
    'TV Episode',
    'TV Mini-Series',
    'TV Series',
    'TV Movie',
    'TV Short',
    'TV Special',
    'Video Game',
    'Video',
    'Podcast Episode',
];
const re = new RegExp(`\\(${badTypes.join('|')}`);

const removeConnections = () => {
    const items = elContainer.querySelectorAll('.ipc-metadata-list__item');
    for (const el of items) {
        if (re.test(el.textContent)) {
            el.remove();
        }
    }
};

removeConnections();

const mut = new MutationObserver(mutList => mutList.forEach(({ addedNodes }) => {
    console.log('Mutated', addedNodes);
    if (!addedNodes.length) return;
    removeConnections();
}));
mut.observe(elContainer, { childList: true, subtree: true });
