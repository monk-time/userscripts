// ==UserScript==
// @name          IMDB - Highlight movies with 400 checks on lists
// @description   Adds movie check counts from ICM to IMDb lists
// @namespace     bobbybrown
// @author        monk-time
// @copyright     2017, monk-time (https://github.com/monk-time)
// @license       MIT; https://opensource.org/licenses/MIT
// @homepageURL   https://openuserjs.org/scripts/monk-time/IMDB_-_Highlight_movies_with_400_checks_on_lists
// @updateURL     https://openuserjs.org/meta/monk-time/IMDB_-_Highlight_movies_with_400_checks_on_lists.meta.js
// @include       https://*.imdb.com/list/*
// @icon          https://ia.media-imdb.com/images/G/01/imdb/images/favicon-2165806970.ico
// @grant         GM.xmlHttpRequest
// @connect       icheckmovies.com
// @version       1.4.1
// ==/UserScript==

/* Changelog:
 * 2017.09.01  [1.2.0]: Switched from YQL to GM_xmlhttpRequest for cross-origin requests.
 * 2017.11.24  [1.3.0]: Fixed GM_xmlhttpRequest for GM4/other engines compatibility.
 * 2018.15.02  [1.3.1]: Enabled on HTTPS pages.
 * 2021.04.12  [1.4.0]: Removed jQuery dependency and GM4 polyfill.
 * 2021.04.12  [1.4.1]: Added a warning about working only in compact view.
 */

'use strict';

const getChecks = html => {
    try {
        const numStr = html.match(/id="movieChecks">[^<]+?</g)[0].replace(/\D/g, '');
        return Number(numStr);
    } catch (e) {
        console.error(`Error while parsing ICM - ${e.name}: ${e.message}`);
        return null;
    }
};

const addChecks = (elMovie, { icmUrl, checks }) => {
    const elTarget = elMovie.querySelector('.col-watchlist-ribbon');
    elTarget.innerHTML = `
        <a class="ihm-icm ${checks >= 400 ? 'ihm-above' : ''}" href="${icmUrl}">
            ${checks}
        </a>
    `;
};

const icmQuery = 'https://www.icheckmovies.com/search/movies/?query=';

const imdb2icm = elMovie => {
    const [imdbId] = elMovie.querySelector('.col-title a').href.match(/\d+/) || [];
    if (!imdbId) {
        console.error('Can\'t extract IMDb id from a list item');
        return;
    }

    GM.xmlHttpRequest({
        method: 'GET',
        url: `${icmQuery}tt${imdbId}`,
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

            addChecks(elMovie, { icmUrl, checks });
        },
    });
};

const attachTriggerButton = () => {
    const elContainer = document.querySelector('.overflow-menu');
    // For some reason the script runs a few times before the page is ready
    if (!elContainer) return;

    elContainer.insertAdjacentHTML('beforeend', `
        <button id="ihm-button" class="btn small">Add checks</button>
    `);

    const elButton = document.querySelector('#ihm-button');
    elButton.addEventListener('click', () => {
        if (elButton.classList.contains('disabled')) return;
        if (!document.querySelector('.lister-mode.simple.active')) {
            alert('The script works only in compact view. Please switch and try again.');
            return;
        }

        elButton.classList.add('disabled');
        const elMovies = document.querySelectorAll('.lister-item');
        elMovies.forEach(imdb2icm);
    });

    document.head.insertAdjacentHTML('beforeend', `<style>
        #ihm-button { float: right; }
        a.ihm-above { color: red; font-weight: bold; }
    </style>`);
};

attachTriggerButton();
