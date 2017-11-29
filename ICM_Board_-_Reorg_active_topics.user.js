// ==UserScript==
// @name           ICM Board - Reorg active topics
// @description    Hide topics and header, re-sort threads (by subforums, unread first)
// @namespace      monk-time
// @author         monk-time
// @include        http://www.icmforum.com/search/*?c=5
// @require        http://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js
// @grant          none
// ==/UserScript==

'use strict';

// ----- SETTINGS -----

// names of subforums from which all topics will be hidden
const forumsToHide = [
    'Challenges',
    'Past Challenges',
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
    '8050665', // Do you eat meat?
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
    '652575', // What are you listening to right now?
    '8303834', // Armo's 555 favourite tracks
];

// the order of subforums (threads will be sorted by subforum, then by alphabet)
const catMap = [
    'iCM & List Discussion',
    'General Film Discussion',
    'Private Section',
    'Challenges',
];

// ----- MAIN -----

function getThreadId($row) {
    const url = $row.find('.c_cat-title:nth-of-type(2) > a').attr('href');
    const re = url.match(/topic\/(\d+)\/$/);
    return re && re[1] || '';
}

function getTitle($row) {
    return $row.find('.c_cat-title:first > a').text().trim().toLowerCase();
}

function getForum($row) {
    return $row.find('.c_cat-title:odd > a').text();
}

function getForumIndex($row) { // --> String
    const cat = getForum($row);
    if (catMap.includes(cat)) {
        return String(catMap.indexOf(cat));
    }

    return String(catMap.length) + cat;
}

let rows = $('.forums > tbody > tr').slice(1); // all threads except header

// hide by subforums, excluding specified threads
rows.filter((_, el) => forumsToHide.indexOf(getForum($(el))) > -1)
    .filter((_, el) => idsToLeave.indexOf(getThreadId($(el))) === -1)
    .hide();

// hide by topics
rows.filter((_, el) => idsToHide.indexOf(getThreadId($(el))) > -1)
    .hide();

// hide header announcements
const hideUntil = $('#search_results_topics, .cat-pages').first();
$('#main').children().eq(1).nextUntil(hideUntil)
    .wrapAll('<div id="announcements"/>')
    .parent()
    .toggle();
$('<button>Toggle announcements</button>')
    .click(() => $('#announcements').toggle())
    .add('<br>')
    .insertBefore('#announcements');

// re-sort topics (unread first)
rows = rows.filter(':visible');
const read = rows.filter((_, el) =>
    $(el).find('.c_cat-mark > img[alt*=" (No new posts)"]').length > 0);
const unread = rows.not(read);

[unread, read].forEach(topics => {
    topics.detach().sort((a, b) => {
        const $a = $(a);
        const $b = $(b);
        const aF = getForumIndex($a);
        const bF = getForumIndex($b);
        if (aF < bF) return -1;
        if (aF > bF) return 1;

        return getTitle($a) < getTitle($b) ? -1 : 1;
    }).appendTo('.forums > tbody');
});
