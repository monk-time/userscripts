// ==UserScript==
// @name           ICM Board - Reorg active topics
// @description    Hide topics and header, re-sort threads (by subforums, unread first)
// @namespace      monk-time
// @author         monk-time
// @include        http://www.icmforum.com/search/*?c=5
// @icon           https://www.icheckmovies.com/favicon.ico
// ==/UserScript==

'use strict';

// ----- SETTINGS -----

// names of subforums from which all topics will be hidden
const forumsToHide = [
    'Challenges',
    'Past Challenges',
    'Games',
    // 'Music, Games, Books and TV',
    // 'Off-Topic',
];

// ids of specific threads from subforums above that should not be hidden
const idsToLeave = [
    '7287307', // TSPDT challenge
    '8194461', // TSPDT challenge 2
    '7836049', // What podcasts do you follow?
    '7496609', // Technical Support
    '8019558', // W10
    '7005371', // Welcome
    '8044020', // Suggestions
    '7151806', // Future challenges
    '7975745', // Japanese Music
    '7342342', // The Music Lounge
];

// ids of threads to hide (regardless of their subforum)
const idsToHide = [
    '7268271', // Similar Title Game
    '7109284', // one
    // '7267177', // The Off-Topic Lounge
    // '7354053', // The Fashion Lounge
    '7068112', // Football
    '7662108', // Celebrity Crush
    '7292379', // Weight Loss
    '652575',  // What are you listening to right now?
    '8303834', // Armo's 555 favourite tracks
    '7837525', // Guess the song
];

// the order of subforums (threads will be sorted by subforum, then by alphabet)
const forums = [
    'List Discussion',
    'General Film Discussion',
    'Private Section',
    'Our lists and projects',
    'Challenges',
];

// ----- MAIN -----

const getRowData = row => {
    const [title, forum] = [...row.querySelectorAll('.c_cat-title > a')]
        .map(x => x.textContent.trim());
    const id = row.querySelector('a').href.match(/topic\/(\d+)\/$/);
    const key = forums.includes(forum) ?
        String(forums.indexOf(forum)) :
        String(forums.length) + forum;
    const isRead = row.querySelector('img').alt.endsWith(' (No new posts)');
    return {
        id: id && id[1] || '',
        title: title.toLowerCase(),
        forum,
        key,
        isRead,
    };
};

// The first table row is the header
const table = document.querySelector('.forums > tbody');
const allRows = [...table.children].slice(1); // skip the header
const rowData = new Map(allRows.map(r => [r, getRowData(r)]));

// Compare topics by unread/read, then by forum, then by title
const compareByUnreadForumTitle = (rA, rB) => {
    const [dA, dB] = [rowData.get(rA), rowData.get(rB)];
    return dA.isRead - dB.isRead ||
        dA.key.localeCompare(dB.key) ||
        dA.title.localeCompare(dB.title);
};

const reorderThreads = rows => table.append(...rows.sort(compareByUnreadForumTitle));

// Hide by subforum (excluding specified threads) or by thread title
const hideThreads = rows => rows
    .filter(r => {
        const { forum, id } = rowData.get(r);
        return forumsToHide.includes(forum) && !idsToLeave.includes(id) ||
            idsToHide.includes(id);
    })
    .forEach(r => r.classList.add('rat-hidden'));

const hideHeaderAnnouncements = () => {
    const topElems = [...document.querySelector('#main').children];
    const firstVisible = topElems.find(el => el.matches('#search_results_topics, .cat-pages'));
    const elemsToHide = topElems.slice(0, topElems.indexOf(firstVisible));

    const cnt = document.createElement('div');
    cnt.id = 'announcements';
    cnt.style.display = 'none';
    cnt.append(...elemsToHide);
    firstVisible.before(cnt);

    const btn = document.createElement('button');
    btn.textContent = 'Toggle announcements';
    btn.addEventListener('click', () => {
        cnt.style.display = cnt.style.display === 'none' ? 'inline' : 'none';
    });
    document.getElementById('nav').append(btn);
};

document.head.insertAdjacentHTML('beforeend', `<style>
    ul.cat-pages { margin:  5px 0 }
    .rat-hidden  { display: none }
</style>`);

reorderThreads(allRows);
hideThreads(allRows);
hideHeaderAnnouncements();
