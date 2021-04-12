// ==UserScript==
// @name          IMDB - Highlight movies with 400 checks on lists
// @description   Adds movie check counts from ICM to IMDb lists
// @namespace     bobbybrown
// @author        monk-time
// @copyright     2017, monk-time (https://github.com/monk-time)
// @license       MIT; https://opensource.org/licenses/MIT
// @homepageURL   https://openuserjs.org/scripts/monk-time/IMDB_-_Highlight_movies_with_400_checks_on_lists
// @updateURL     https://openuserjs.org/meta/monk-time/IMDB_-_Highlight_movies_with_400_checks_on_lists.meta.js
// @include       http://*.imdb.com/list/*
// @include       https://*.imdb.com/list/*
// @require       https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @icon          https://ia.media-imdb.com/images/G/01/imdb/images/favicon-2165806970.ico
// @grant         GM_xmlhttpRequest
// @grant         GM.xmlHttpRequest
// @connect       icheckmovies.com
// @version       1.3.1
// ==/UserScript==

/* Changelog:
 * 2017.09.01  [1.2]: YQL no longer works, switched to GM_xmlhttpRequest for cross-origin requests.
 * 2017.11.24  [1.3]: Fixed GM_xmlhttpRequest for GM4/other engines compatibility.
 * 2018.15.02  [1.3.1]: Enabled on HTTPS pages.
 */

'use strict';

/* global GM: true */
// Polyfill for other userscript engines
if (typeof GM === 'undefined') {
    GM = {};
    const old = this.GM_xmlhttpRequest;
    if (!old) throw new Error('xmlhttpRequest is not available (both old and new API)');
    GM.xmlHttpRequest = (...args) => new Promise((resolve, reject) => {
        try {
            resolve(old(...args));
        } catch (e) {
            reject(e);
        }
    });
}

const getChecks = html => {
    try {
        const numStr = html.match(/id="movieChecks">[^<]+?</g)[0].replace(/\D/g, '');
        return Number(numStr);
    } catch (e) {
        console.error(`Error while parsing ICM - ${e.name}: ${e.message}`);
        return null;
    }
};

const addChecks = ($movie, entry) => {
    const target = $movie.find('.created');
    let $elem = $(`<a href="${entry.icmUrl}">${entry.checks}</a>`);
    if (entry.checks >= 400) {
        $elem.attr('style', 'color: red !important; font-size: 110% !important;');
        $elem = $('<b>').append($elem);
    }

    target.empty().append($elem);
};

const icmq = 'https://www.icheckmovies.com/search/movies/?query=';

const imdb2icm = $movie => {
    const [imdbId] = $movie.find('.title a').attr('href').match(/\d+/) || [];
    if (!imdbId) {
        console.error('Can\'t extract IMDb id from a list item');
        return;
    }

    GM.xmlHttpRequest({
        method: 'GET',
        url: `${icmq}tt${imdbId}`,
        onload(response) {
            const icmUrl = response.finalUrl;
            if (response.status !== 200) {
                console.error(`Can't load ${icmUrl}: server returned ${response.status}`);
                return;
            }

            const checks = getChecks(response.responseText);
            if (checks === null) {
                console.error(`Can't load ${icmUrl}`);
                return;
            }

            addChecks($movie, { icmUrl, checks });
        },
    });
};

const $btn = $('<button class="btn small">Add checks</button>');
$btn.appendTo('.rightcornerlink').one('click', () => {
    const $movies = $('.list_item').not(':first');
    $('th.created').text('#Checks');
    for (const el of $movies) {
        imdb2icm($(el));
    }

    $btn.addClass('disabled');
});
