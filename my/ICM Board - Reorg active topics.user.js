// ==UserScript==
// @name        ICM Board - Reorg active topics
// @description Hide topics and header, re-sort threads (by subforums, unread first)
// @namespace   monk-time
// @author      monk-time
// @include     https://forum.icmforum.com/search.php?*search_id=active_topics*
// @icon        https://www.icheckmovies.com/favicon.ico
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
];

// ids of threads to hide (regardless of their subforum)
const idsToHide = [
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
    const title = row.querySelector('.topictitle').textContent.trim();
    const forum = row.querySelector('.forum a').textContent.trim();
    const id = row.querySelector('.topictitle').href.match(/&t=(\d+)/);
    const key = forums.includes(forum) ?
        String(forums.indexOf(forum)) :
        String(forums.length) + forum;
    const isRead = row.querySelector('dt').title !== 'Unread posts';
    return {
        id: (id && id[1]) ?? '',
        title: title.toLowerCase(),
        forum,
        key,
        isRead,
    };
};

// The first table row is the header
const table = document.querySelector('.topics');
const allRows = [...table.children];
const rowData = new Map(allRows.map(r => [r, getRowData(r)]));

const compareByUnreadThenByForum = (rA, rB) => {
    const [dA, dB] = [rowData.get(rA), rowData.get(rB)];
    return dA.isRead - dB.isRead ||
        dA.key.localeCompare(dB.key);
};

const reorderThreads = rows => table.append(...rows.sort(compareByUnreadThenByForum));

// Hide by subforum (excluding specified threads) or by thread title
const hideThreads = rows => rows
    .filter(r => {
        const { forum, id } = rowData.get(r);
        return (forumsToHide.includes(forum) && !idsToLeave.includes(id)) ||
            idsToHide.includes(id);
    })
    .forEach(r => r.classList.add('rat-hidden'));

const hideHeaderAnnouncements = () => {
    const elToHide = document.querySelector('#phpbb_announcement');

    const cnt = document.createElement('div');
    cnt.id = 'announcements';
    cnt.style.display = 'none';
    elToHide.replaceWith(cnt);
    cnt.append(elToHide);

    const btn = document.createElement('button');
    btn.className = 'rat-toggle';
    btn.textContent = 'Toggle announcements';
    btn.addEventListener('click', () => {
        cnt.style.display = cnt.style.display === 'none' ? 'inline' : 'none';
    });
    document.querySelector('.action-bar.bar-top').append(btn);
};

document.head.insertAdjacentHTML('beforeend', `<style>
    .rat-toggle { float: left; padding: 5px; }
    .rat-hidden { display: none !important; }
</style>`);

reorderThreads(allRows);
hideThreads(allRows);
hideHeaderAnnouncements();
