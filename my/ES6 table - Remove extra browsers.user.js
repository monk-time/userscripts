// ==UserScript==
// @name        ES6 table - Remove extra browsers
// @namespace   monk-time
// @author      monk-time
// @include     http://kangax.github.io/compat-table/es6/*
// @include     https://kangax.github.io/compat-table/es6/*
// @include     http://kangax.github.io/compat-table/es2016plus/*
// @include     https://kangax.github.io/compat-table/es2016plus/*
// @include     http://kangax.github.io/compat-table/esnext/*
// @include     https://kangax.github.io/compat-table/esnext/*
// @icon        https://kangax.github.io/compat-table/favicon.ico
// ==/UserScript==

'use strict';

const $ = document.querySelectorAll.bind(document);

const cols = {
    desktop: [
        'ie10', 'ie11', 'ie11tp', 'safari7', 'safari71_8', 'safari9',
        'safaritp', 'webkit', 'opera', 'konq',
    ],
    engine: ['phantom', 'node012', 'node4', 'ejs', 'xs6', 'jxa', 'duktape'],
    compiler: ['tr', 'closure', 'jsx', 'typescript', 'es6shim'],
};
const fullSections = ['mobile'];

// fetch column names from headers
for (const col of fullSections) {
    cols[col] = Array.from($(`th.${col}`), el => el.dataset.browser);
}

for (const col of Object.keys(cols)) {
    for (const platform of cols[col]) {
        $(`[data-browser^=${platform}]`).forEach(el => el.remove());
    }

    const [header] = $(`#${col}-header`);
    const subHeaders = $(`th.${col}:not(.obsolete)`).length;
    if (subHeaders === 0) {
        header.remove();
    } else {
        header.colSpan = subHeaders;
    }
}

// Also delete all invisible obsolete platforms (they might be causing lag)
$('.obsolete').forEach(el => el.remove());
