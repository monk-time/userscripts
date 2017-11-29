// ==UserScript==
// @name           Newsru.com - Archive fixes
// @description    Widen the columns and fix the links
// @namespace      monk-time
// @author         monk-time
// @include        http://classic.newsru.com/arch/*
// @include        https://classic.newsru.com/arch/*
// @require        https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @icon           http://classic.newsru.com/favicon.ico
// ==/UserScript==

'use strict';

const tableWidth = 800;

const tweakSubIndexPage = () => {
    // resize main table
    let $table = $('.mainContent');
    if (!$table.length) {
        $table = $('body > table[width="770"]').eq(3).addClass('mainContent');
    }

    $table.removeAttr('width').width(tableWidth);
    const $cols = $table.find('> tbody > tr > td');

    // process columns
    const $leftCol = $cols.eq(0);
    $leftCol.find('>table>tbody>tr>td').slice(2).remove();
    $leftCol.children().addBack().removeAttr('width').width(115);

    const $rightCol = $cols.eq(2);
    $rightCol.removeAttr('width').width('100%');

    // remove bottom
    $cols.filter('td[valign="bottom"]').remove();

    // hide & sort articles
    const $list = $rightCol.find('td:has(>a[name])');
    const curDay = parseInt(window.location.href.match(/\d+/)[0], 10);
    const arr = $list.children('a').get()
        // parse dates
        .map(el => {
            const $block = $(el).nextUntil('a').addBack();
            const date = $block.find('.explaindate').text().trim();
            const time = date.match(/(, )?(\d+:\d+)/)[2];
            let day = date.match(/^(\d+) /);
            day = day ? parseInt(day[1], 10) : curDay;
            return { day, time, $block };
        })
        // remove outdated articles and sort the rest
        .filter(({ day }) => day === curDay)
        .sort((a, b) => (a.date < b.date ? -1 : 1));

    // refresh page content
    $list.children().detach();
    arr.forEach(({ $block }) => {
        $list.append($block);
        // fix the links so that they are highlighted when visited (from the front page)
        // (won't work for front pages from archive)
        uniformArchiveUrls($block);
    });
};

const uniformArchiveUrls = $el => {
    $el.find('a').each(function () {
        const url = ($(this).attr('href') || '').replace('/arch/', '/');
        if (!/\/index\.html$/.test(url)) {
            $(this).attr('href', url);
        }
    });
};

if (/\/arch\/(?:[^/]+\/){2}index\.html/.test(document.URL)) { // index.html excl. the main page
    tweakSubIndexPage();
} else if (/\/arch\/[^/]+\/index\.html/.test(document.URL)) { // excl. archive calendar
    uniformArchiveUrls($('body'));
}
