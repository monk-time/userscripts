// ==UserScript==
// @name        RTO - Slim search
// @namespace   monk-time
// @author      monk-time
// @include     http://rutracker.org/forum/tracker.php*
// @include     http://rutracker.cr/forum/tracker.php*
// @include     http://rutracker.nl/forum/tracker.php*
// @include     http://rutracker.net/forum/tracker.php*
// @include     https://rutracker.org/forum/tracker.php*
// @include     https://rutracker.cr/forum/tracker.php*
// @include     https://rutracker.nl/forum/tracker.php*
// @include     https://rutracker.net/forum/tracker.php*
// @icon        https://rutracker.net/favicon.ico
// ==/UserScript==

'use strict';

document.body.insertAdjacentHTML('beforeend', `
    <style>
        #fs-main {
            height: 70px;
            resize: both;
        }

        .fieldsets td:nth-child(2) > fieldset:first-of-type > div > * {
            display: inline;
        }
    </style>
`);

// Preserve the only useful link from a section to be removed
document.querySelector('.s-all-f').insertAdjacentHTML(
    'afterend',
    ' · <a class="med" href="viewtopic.php?t=101236">Помощь по поиску</a>',
);

// Remove sections
const sections = ['Показывать только', 'Торренты за', 'Автор', 'Ссылки'];
[...document.querySelectorAll('legend')]
    .filter(el => sections.includes(el.textContent))
    .forEach(el => el.parentNode.remove());
