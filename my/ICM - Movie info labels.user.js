// ==UserScript==
// @name          ICM - Movie info labels
// @description   Click 'Filter/Load data' above a list to add labels with checks/runtime that can sort lists on click.
// @namespace     https://openuserjs.org/users/monk-time
// @author        monk-time
// @copyright     2017, monk-time (https://github.com/monk-time)
// @license       MIT; https://opensource.org/licenses/MIT
// @homepageURL   https://openuserjs.org/scripts/monk-time/ICM_-_Movie_info_labels
// @updateURL     https://openuserjs.org/meta/monk-time/ICM_-_Movie_info_labels.meta.js
// @include       https://www.icheckmovies.com/lists/*
// @include       https://www.icheckmovies.com/search/movies/*
// @include       https://www.icheckmovies.com/movies/unchecked/*
// @include       https://www.icheckmovies.com/movies/checked/*
// @include       https://www.icheckmovies.com/movies/favorited/*
// @include       https://www.icheckmovies.com/movies/disliked/*
// @include       https://www.icheckmovies.com/movies/watchlist/*
// @include       https://www.icheckmovies.com/movies/?tags=*
// @exclude       https://www.icheckmovies.com/lists/
// @exclude       https://www.icheckmovies.com/lists/?*
// @exclude       https://www.icheckmovies.com/lists/favorited/*
// @exclude       https://www.icheckmovies.com/lists/disliked/*
// @exclude       https://www.icheckmovies.com/lists/watchlist/*
// @icon          https://www.icheckmovies.com/favicon.ico
// @version       1.0.2
// ==/UserScript==

/* Changelog:
 * 2016.03.14  [0.8.1]: Added some extra logging.
 * 2017.09.31  [0.9.0]: Fixed formatting.
 * 2017.11.23  [1.0.0]: Removed jQuery dependency, fixed for GM4.
 * 2017.11.23  [1.0.1]: Chrome didn't render sorting arrows correctly.
 * 2018.07.26  [1.0.2]: Fixed the watchlist page
 */

// TODO: keep sorting arrows visible

'use strict';

// Set to true to enable verbose logging
const debug = false;

const log = (msg, ...rest) => {
    if (!debug) return;
    console.log(`MIL: ${msg}`, ...rest);
};

const error = (msg, ...rest) => {
    console.error(`MIL: ${msg}`, ...rest);
};

// ----- Helper functions -----

const $ = (sel, context) => (context || document).querySelector(sel);
const $$ = (sel, context) => [...(context || document).querySelectorAll(sel)];
const getVisible = elements => [...elements].filter(el => el && el.style.display !== 'none');
const reflect = promise => promise
    .then(val => ({ val, status: 'resolved' }))
    .catch(err => ({ err, status: 'rejected' }));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Convert a value according to a list of thresholds and corresp. values
const convertByRange = (rangeMap, defValue) => n => {
    for (const [limit, value] of rangeMap) {
        if (n < limit) {
            return value;
        }
    }

    return defValue;
};

// ----- Main -----

const stylesheet = `
    .mil-trigger {
        cursor: pointer;
    }

    .mil-trigger:hover {
        background-color: #ccc !important;
    }

    .mil-label {
        color: #FFF;
        font-size: 12px;
        font-family: Calibri;
        padding-left: 3px;
        padding-right: 3px;
        border-radius: 3px;
        border-width: 0px;
        display: inline;
        margin-left: 4px;
        text-decoration: none;
        cursor: pointer;
    }

    .mil-label-checks {
        background-color: #3223c3;
    }

    .mil-label-mins {
        background-color: #c33223;
    }

    .mil-arrows {
        padding: 0px 4px;
        cursor: pointer;
        display: none;
    }

    .mil-data:hover + .mil-arrows,
    .mil-arrows:hover {
        display: inline;
    }
`;

const container = $('#itemListMovies');
const main = () => {
    log('Initializing "ICM - Movie info labels"...');
    if (!container) {
        throw new Error('"ICM - Movie info labels" script works only on movie lists.');
    }

    const trigger = $('#tagFilter > h4');
    if (!trigger) {
        log(`Unexpected tag filter layout:\n${$('#tagFilter').outerHTML}`);
        throw new Error('Can\'t find the "Filter" button.');
    }

    document.head.insertAdjacentHTML('beforeend', `<style>${stylesheet}</style>`);

    trigger.classList.add('mil-trigger');
    trigger.addEventListener('mouseenter', () => {
        trigger.textContent = 'Load data';
    });
    trigger.addEventListener('mouseleave', () => {
        trigger.textContent = 'Filter';
    });
    trigger.addEventListener('click', processList);

    // Allow row hiding on double click
    container.addEventListener('dblclick', e => {
        if (!e.target.classList.contains('listItemMovie')) return;
        e.target.style.display = 'none';
    });
};

const getVisibleMovies = () => getVisible(container.children);
const lookupTable = {};
const labelTypes = ['checks', 'mins'];

const processList = () => {
    // Load the hidden part of the list
    getVisible([$('#topListAllMovies')]).forEach(el => el.click());

    const moviesToProcess = getVisibleMovies()
        .filter(el => !el.classList.contains('mil-with-data'));
    if (!moviesToProcess.length) return;

    // The rest of handlers will be added after ajax requests
    ['rank', 'year', 'toplists'].forEach(attachHandlers);

    // Resolve all instead of stopping on the first rejected request
    Promise.all(moviesToProcess.map(processMovie).map(reflect))
        .then(results => {
            // Some movie links can fail (e.g. "()" from the Film Comment a-g list)
            const fails = results.filter(x => x.status === 'rejected').length;
            const total = results.length;
            log(`DLed data and appended labels for ${total - fails}/${total} movies`);
            log('Lookup table:', lookupTable);
            labelTypes.forEach(type => {
                // Subsequent runs can add new labels that don't have handlers yet
                types[type].allHandlersAttached = false;
                attachHandlers(type);
            });
        });
};

const processMovie = async (el, i) => {
    await sleep(10 * i);
    const target = $('.info', el);
    let url = $('h2 > a', el).href;
    // ICM bug: search pages redirect links to http: that gets blocked by Mixed Content Policy
    if (url.startsWith('/search/result')) {
        const [, moviePath] = url.split('&url=');
        url = `//www.icheckmovies.com${decodeURIComponent(moviePath)}`;
    }

    try {
        await appendLabels(url, target, el.id);
        el.classList.add('mil-with-data');
    } catch (e) {
        error(`Error while loading ${url}dialog/:`, e);
        throw e;
    }
};

// ----- Labels -----

const types = {
    rank: {
        sel: '.rank',
        asc: false,
        showButton: false,
    },
    year: {
        sel: '.info > a[title*="year"]',
        asc: true,
        showButton: true,
    },
    toplists: {
        sel: '.info > a[href*="/rankings/"]',
        asc: false,
        showButton: true,
    },
    checks: {
        regex: /movieChecks">([^<]+?)</,
        getOpacity: convertByRange([[10, 0.2], [100, 0.4], [400, 0.7], [1000, 0.9]], 1),
        sel: '.mil-label-checks',
        asc: false,
        showButton: false,
    },
    mins: {
        regex: /Runtime<\/dt>\s*<dd>([^<]+?)</,
        getOpacity: convertByRange([[20, 0.4], [40, 0.7], [120, 0.9]], 1),
        sel: '.mil-label-mins',
        asc: true,
        showButton: false,
    },
};

for (const typeObj of Object.values(types)) {
    typeObj.allHandlersAttached = false;
}

const appendLabels = async (url, target, id) => {
    if (lookupTable[id] === undefined) {
        lookupTable[id] = {};
    }

    const { html } = await (await fetch(`${url}dialog/`)).json();
    for (const type of labelTypes) {
        const val = extractInt(html, types[type].regex);
        lookupTable[id][type] = val || 0;
        // Create label only if value is not NaN
        const label = createLabel(type, val);
        if (label) target.appendChild(label);
    }
};

const createLabel = (type, val) => {
    if (Number.isNaN(val)) return undefined;

    const label = document.createElement('span');
    label.classList.add('mil-label', `mil-label-${type}`);
    label.style.opacity = types[type].getOpacity(val);
    label.title = type;
    label.textContent = val;
    return label;
};

// Returns NaN if can't match or matched fragment has no numbers
const extractInt = (text, re) => {
    const match = text.match(re);
    if (!match) {
        error(`Got malformed dialog page:\n${text}`);
        return NaN;
    }

    return parseInt(match[1].replace(/\D/g, ''), 10);
};

// ----- Sortings -----

const debugCounters = {};

const attachHandlers = type => {
    const { allHandlersAttached, sel, showButton } = types[type];
    if (allHandlersAttached) return;
    log(`Attaching handlers for ${type}`);

    $$(sel, container).forEach(el => {
        // If it's not the first run, skip items that already have data loaded
        if (el.dataset.hasHandler) return;
        // Track clicks on a button or an element itself
        const clickTarget = showButton ? addSortButton(el) : el;
        clickTarget.addEventListener('click', e => {
            e.preventDefault();
            Object.assign(debugCounters, { created: 0, parsed: 0 });
            getVisibleMovies()
                .sort(by(type))
                .forEach(m => container.appendChild(m));
            const { created, parsed } = debugCounters;
            if (created + parsed > 0) {
                log((created ? `created ${created}, ` : '') + (parsed ? `parsed ${parsed}` : ''));
            }

            // toggle sorting direction
            types[type].asc = !types[type].asc;
            log('Lookup table:', lookupTable);
        });
        el.dataset.hasHandler = true;
    });

    types[type].allHandlersAttached = true;
};

let sortButton = document.createElement('template');
sortButton.innerHTML = '<a class="mil-arrows" href="#">\u2191\u2193</a>';
sortButton = sortButton.content.firstChild;

const addSortButton = el => {
    el.classList.add('mil-data');
    const clone = sortButton.cloneNode(true);
    // insert after element (omg)
    return el.parentNode.insertBefore(clone, el.nextSibling);
};

// Universal sorting: the order is determined by a type-specific parameter
const by = type => (elA, elB) => {
    const [valA, valB] = [elA, elB].map(lookup(type));
    return types[type].asc ? valA - valB : valB - valA;
};

// Missing values are parsed with type-specific selectors and stored in a lookup table.
// Always returns a number.
const lookup = type => el => {
    if (lookupTable[el.id] === undefined) {
        lookupTable[el.id] = {};
        debugCounters.created++;
    }

    const data = lookupTable[el.id];
    if (data[type] !== undefined) return data[type];
    // Label types that haven't been loaded yet (e.g. after loading data
    // on a partial (New/Checked/etc.) view and switching to another view)
    // or non-label types can be missing from the lookup table
    if (labelTypes.includes(type)) return 0;

    // Missing non-label types must be parsed from the page
    data[type] = parseFromPage(type, el);
    debugCounters.parsed++;
    return data[type];
};

const parseFromPage = (type, el) => {
    const src = $(types[type].sel, el);
    if (src) return +src.textContent.match(/\d+/);

    error(`Can't parse ${type} for ${el.id} on this page`);
    return 0;
};

main();
