// ==UserScript==
// @name           IMDb - Colorful vote history
// @description    Colorizes lists based on ratings and adds stats to the sidebar. Does only work in compact/tabular view.
// @author         kuehlschrank, monk-time
// @include        http://www.imdb.com/list/*
// @include        http://www.imdb.com/user/*/ratings*
// @exclude        http://www.imdb.com/user/*/ratings*view=detail*
// @icon           http://www.imdb.com/favicon.ico
// @version        2011.8.14
// ==/UserScript==

'use strict';

const thresholds = { good: 7, average: 5, bad: 0 };
const getMovies = () => document.querySelectorAll('.list_item[data-item-id]');

const extractCounts = () => {
    const num = {
        good: 0, average: 0, bad: 0, higher: 0, lower: 0, strong: 0,
    };

    for (const movie of getMovies()) {
        const [userRating, imdbRating] = ['.your_ratings', '.user_rating']
            .map(sel => Math.round(parseFloat(movie.querySelector(sel).textContent)));

        if (Number.isNaN(userRating)) continue;

        for (const [type, minRating] of Object.entries(thresholds)) {
            if (userRating >= minRating) {
                num[type]++;
                movie.classList.add(`${type}${userRating}`);
                break;
            }
        }

        if (Number.isNaN(imdbRating)) continue;

        if (Math.abs(userRating - imdbRating) > 2) {
            num.strong++;
        }

        if (userRating > imdbRating) {
            num.higher++;
        } else if (userRating < imdbRating) {
            num.lower++;
        }
    }

    num.ratings = num.good + num.average + num.bad;
    return num;
};

const colorize = () => {
    const num = extractCounts();
    if (num.ratings === 0) return;

    const sidebar = document.getElementById('sidebar');

    const percentOfAll = n => Math.round(n / num.ratings * 100);
    sidebar.insertAdjacentHTML('beforeend', `
        <div id="rStats" class="aux-content-widget-2">
            <h4>Ratings:</h4>
            <span class="stat good7">
                <b>${num.good}</b> (${percentOfAll(num.good)}%)
            </span>
            <span class="stat average6">
                <b>${num.average}</b> (${percentOfAll(num.average)}%)
            </span>
            <span class="stat bad4">
                <b>${num.bad}</b> (${percentOfAll(num.bad)}%)
            </span>
        </div>
    `);

    if (num.higher + num.lower === 0) return;

    sidebar.insertAdjacentHTML('beforeend', `
        <div id="dStats" class="aux-content-widget-2">
            <h4>Deviations from IMDb ratings:</h4>
            <b>${num.higher} higher</b> (${percentOfAll(num.higher)}%) and
            <b>${num.lower} lower</b> (${percentOfAll(num.lower)}%),<br/>
            thereof ${num.strong} stronger than 2 stars (${percentOfAll(num.strong)}%)
        </div>
    `);
};

const reset = () => {
    for (const movie of getMovies()) {
        movie.className = movie.className.replace(/good\d+|average\d|bad\d/, '');
    }

    for (const sel of ['rStats', 'dStats']) {
        const section = document.getElementById(sel);
        if (section) section.remove();
    }
};

const onNodeInserted = e => {
    if (e.target.nodeType === 1 && e.target.textContent.includes('Filtered list.')) {
        reset();
        colorize();
    }
};

const getCSS = (rank, color) =>
    `span.${rank}, tr.${rank} td { background-color: ${color} !important; }`;

document.head.insertAdjacentHTML('beforeend', `<style>
    span.stat { padding: 1px 8px !important; }
    ${getCSS('bad1', '#ff9191')} ${getCSS('bad2', '#ffa5a5')}
    ${getCSS('bad3', '#ffb8b8')} ${getCSS('bad4', '#ffcccc')}
    ${getCSS('average5', '#ffe2cc')} ${getCSS('average6', '#f3ffcc')}
    ${getCSS('good7', '#ccffcc')} ${getCSS('good8', '#b8ffb8')}
    ${getCSS('good9', '#a5ffa5')} ${getCSS('good10', '#91ff91')}
</style>`);

colorize();
document.addEventListener('DOMNodeInserted', onNodeInserted, false);
