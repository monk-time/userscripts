// ==UserScript==
// @name        IMDb - Colorful vote history
// @description Colorizes lists based on ratings and adds stats to the sidebar (compact view only).
// @author      kuehlschrank, monk-time
// @include     https://www.imdb.com/list/*
// @icon        http://www.imdb.com/favicon.ico
// @version     2021.03.12
// ==/UserScript==

'use strict';

const thresholds = { good: 7, average: 5, bad: 0 };
const movieSel = '.lister-item.mode-simple';
const userRatingSel = '.col-user-rating .ipl-rating-star__rating';

const getMovies = () => [...document.querySelectorAll(movieSel)];
const getUserRating = movie => {
    const s = movie.querySelector(userRatingSel).textContent;
    return Math.round(parseFloat(s));
};

const getMovieData = movie => ({ movie, userRating: getUserRating(movie) });

const extractCounts = () => {
    const num = { good: 0, average: 0, bad: 0 };

    const movieData = getMovies().map(getMovieData);
    for (const { movie, userRating } of movieData) {
        if (!userRating) continue;

        for (const [type, minRating] of Object.entries(thresholds)) {
            if (userRating >= minRating) {
                num[type]++;
                movie.classList.add(`${type}${userRating}`);
                break;
            }
        }
    }

    num.ratings = num.good + num.average + num.bad;
    return num;
};

const colorize = () => {
    const num = extractCounts();
    if (num.ratings === 0) return;

    const sidebar = document.getElementById('sidebar');
    const percentOfAll = n => Math.round((n / num.ratings) * 100);
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
};

const reset = () => {
    for (const movie of getMovies()) {
        movie.className = movie.className.replace(/good\d+|average\d|bad\d/, '');
    }

    const section = document.getElementById('rStats');
    if (section) section.remove();
};

const getCSS = (rank, color) =>
    `span.${rank}, ${movieSel}.${rank} { background-color: ${color} !important; }`;

// ----- MAIN -----

document.head.insertAdjacentHTML('beforeend', `<style>
    span.stat { padding: 1px 8px !important; }
    ${getCSS('bad1', '#ff9191')}
    ${getCSS('bad2', '#ffa5a5')}
    ${getCSS('bad3', '#ffb8b8')}
    ${getCSS('bad4', '#ffcccc')}
    ${getCSS('average5', '#ffe2cc')}
    ${getCSS('average6', '#f3ffcc')}
    ${getCSS('good7', '#ccffcc')}
    ${getCSS('good8', '#b8ffb8')}
    ${getCSS('good9', '#a5ffa5')}
    ${getCSS('good10', '#91ff91')}
</style>`);

colorize();

const mut = new MutationObserver(mutList => mutList.forEach(({ addedNodes }) => {
    if (!addedNodes.length) return;
    reset();
    colorize();
}));

const container = document.querySelector('.lister-list');
mut.observe(container, { childList: true });
