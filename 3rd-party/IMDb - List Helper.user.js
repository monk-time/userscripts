// ==UserScript==
// @name           IMDb - List Helper
// @description    Makes creating IMDb lists more efficient and convenient
// @namespace      imdb
// @author         themagician, monk-time
// @include        http://*imdb.com/list/*/edit
// @include        http://*imdb.com/list/*/edit?*
// @require        https://cdnjs.cloudflare.com/ajax/libs/d3-dsv/1.0.8/d3-dsv.min.js
// @icon           http://www.imdb.com/favicon.ico
// @grant          GM_addStyle
// @version        2.4.1
// ==/UserScript==

//
// CHANGELOG
//
// 3.0
// fixed: Enable on pages with a referal in the query string
// fixed: Search by movie title
// fixed: No longer requires jQuery; jquery-csv is replaced with d3-dsv
// fixed: Remove delay before auto-clicking on a search result
// changed: Criticker score conversion: 0..10 -> 1, 11..20 -> 2, 91..100 -> 10
// changed: Criticker importer requires .csv
// changed: If the regex fails, try searching for the whole string
//
// 2.4.1
// bugfix: In some instances the script wasn't loaded (bad @include)
// change: Limit number of setTimeOut calls
//
// 2.4.0
// fixed: IMDb changed layout
//
// 2.3.0
// fixed: importing ratings works again
//
// 2.2.0
// added: support for people
//
// 2.1.1
// added: only show import form if ratings is selected
//
// 2.1
// added: importers for imdb, rateyourmusic, criticker
//
// 2.0
// added: import ratings
// added: if regex doesn't match, skip entry
//
// 1.6.1.2
// added: input text suggestion as a placeholder
//
// 1.6.1.1
// fixed: some entries are skipped when adding imdb ids/urls
//

/* global d3 */

'use strict';

// milliseconds between each request
const REQUEST_DELAY = 1000;

// ----- DOM ELEMENTS: STYLING, CREATION AND TRACKING -----

document.head.insertAdjacentHTML('beforeend', `<style>
    #ilh-ui {
        margin: 0 5% 5% 5%;
        padding: 10px;
        border: 1px solid #e8e8e8;
    }

    #ilh-ui label {
        font-weight: normal;
    }

    #ilh-ui input[type=text] {
        width: 100%;
        font-family: monospace;
    }

    #ilh-ui #ilh-regexp {
        margin-top: 4px;
        margin-left: 1px;
    }

    #ilh-ui textarea {
        width: 100%;
        background-color: lightyellow;
        overflow: auto;
    }

    #ilh-ui span {
        font-weight: bold;
    }
</style>`);

const uiHTML = `
    <div id="ilh-ui">
        <p>
            <b>Import mode:</b>
            <label>
                <input type="radio" name="importmode" value="list" checked>List</input>
            </label>
            <label>
                <input type="radio" name="importmode" value="ratings">Ratings</input>
            </label>
        </p>
        <textarea id="ilh-film-list" rows="7" cols="60" placeholder="Input titles or IMDb IDs and click Start"></textarea>
        <br>
        <input type="button" value="Start" id="ilh-start">
        <input type="button" value="Skip"  id="ilh-skip">
        <input type="button" value="Retry" id="ilh-retry">
        <span>Remaining: <span id="ilh-films-remaining">0</span></span>
        <br><br>
        <span>Current: <input type="text" id="ilh-current-film" size="65""></span>
        <br>
        <span>Regexp (matches only): <input type="text" id="ilh-regexp" size="65"></span>
        <br>
        <p id="ilh-import" style="display: none">
            <b>Import .csv from:</b>
            <select name="import" id="ilh-import-sel">
                <option value="" selected disabled hidden>Select</option>
                <option value="imdb">IMDb</option>
                <option value="rym">RateYourMusic</option>
                <option value="criticker">Criticker</option>
            </select>
            <b>File:</b>
            <input type="file" id="ilh-file-import" disabled>
        </p>
    </div>`;

document.querySelector('div.lister-search').insertAdjacentHTML('afterend', uiHTML);

const innerIDs = [
    'film-list',
    'start',
    'skip',
    'retry',
    'films-remaining',
    'current-film',
    'regexp',
    'import',
    'import-sel',
    'file-import',
];

const camelCase = s => s.replace(/-[a-z]/g, m => m[1].toUpperCase());

// Main object for interacting with the script's UI; keys match element ids
const ui = Object.assign(...innerIDs.map(id => ({
    [camelCase(id)]: document.getElementById(`ilh-${id}`),
})));

[ui.radioList, ui.radioRatings] = document.querySelectorAll('#ilh-ui input[name=importmode]');
const elIMDbSearch = document.getElementById('add-to-list-search');
const elIMDbResults = document.getElementById('add-to-list-search-results');

// ----- HANDLERS AND ACTIONS -----

const convertRating = n => Math.ceil(n / 10) || 1; // 0..100 -> 1..10
// d3 skips a row if a row conversion function returns null
const joinOrSkip = (...fields) => (fields.includes(undefined) ? null : fields.join(','));
const rowConverters = {
    imdb: row => joinOrSkip(row['Your Rating'], row.Const),
    rym: row => joinOrSkip(row.Rating, row.Title),
    // .csv exported from Criticker have spaces between column names
    criticker: row => joinOrSkip(convertRating(+row.Score), row[' IMDB ID']),
};

const prepareImport = e => {
    const isLegalParser = Boolean(rowConverters[e.target.value]); // in case of html-js mismatch
    ui.fileImport.disabled = !isLegalParser;
};

const handleImport = e => {
    const format = ui.importSel.value;
    const reader = new FileReader();
    reader.onload = event => {
        const fileStr = event.target.result;
        ui.filmList.value = d3.csvParse(fileStr, rowConverters[format]).join('\n');
    };

    const [file] = e.target.files;
    reader.readAsText(file);
};

const RatingManager = {
    rating: 0,
    regex: '^([1-9]|10),(.*)$',
    processRegexMatch: ([, rating, filmTitle], callback) => {
        RatingManager.rating = rating;
        callback(filmTitle);
    },
    handleSelection: async (imdbID, callback) => {
        console.log(`RatingManager::handleSelection: Rating ${imdbID}`);
        const moviePage = await fetch(
            `http://www.imdb.com/title/${imdbID}/`,
            { credentials: 'same-origin' },
        );
        const authHash = new DOMParser()
            .parseFromString(await moviePage.text(), 'text/html')
            .getElementById('star-rating-widget')
            .dataset.auth;

        const params = {
            tconst: imdbID,
            rating: RatingManager.rating,
            auth: authHash,
            tracking_tag: 'list',
        };

        const postResp = await fetch('http://www.imdb.com/ratings/_ajax/title', {
            method: 'POST',
            body: new URLSearchParams(params),
            credentials: 'same-origin',
        });

        if (postResp.ok) {
            callback();
        } else {
            alert(`Rating failed. Status code ${postResp.status}`);
        }
    },
};

const ListManager = {
    regex: '((?:tt|nm)\\d+)',
    processRegexMatch: ([, filmTitle], callback) => callback(filmTitle),
    handleSelection: (imdbID, callback) => callback(),
};

const App = {
    manager: ListManager,
    films: [],
    regexObj: null,
    run: () => {
        ui.regexp.value = App.manager.regex;

        ui.importSel.addEventListener('change', prepareImport);
        ui.fileImport.addEventListener('change', handleImport);

        ui.radioList.addEventListener('change', () => {
            App.manager = ListManager;
            ui.import.style.display = 'none';
            ui.regexp.value = App.manager.regex;
        });

        ui.radioRatings.addEventListener('change', () => {
            App.manager = RatingManager;
            ui.import.style.display = 'block';
            ui.regexp.value = App.manager.regex;
        });

        // When start button is clicked
        ui.start.addEventListener('click', () => {
            App.regexObj = RegExp(ui.regexp.value || App.manager.regex, 'i');

            // Disable relevant UI elements
            [ui.filmList, ui.start, ui.regexp, ui.radioList, ui.radioRatings]
                .forEach(el => { el.disabled = true; });

            App.films = ui.filmList.value.trim().split('\n');
            App.handleNext();
        });

        // when skip button is clicked
        ui.skip.addEventListener('click', () => App.handleNext());

        // Sometimes the request fails forcing the user to skip an entry to continue
        ui.retry.addEventListener('click', () => {
            elIMDbSearch.dispatchEvent(new Event('keydown'));
        });
    },
    handleNext: () => {
        if (App.films.length) {
            App.search(App.films.shift());
        } else { // if last film
            App.reset();
        }
    },
    reset: () => {
        App.films = [];
        App.regexObj = null;

        [ui.filmList, ui.start, ui.regexp, ui.radioList, ui.radioRatings]
            .forEach(el => { el.disabled = false; });

        ui.currentFilm.value = '';
        elIMDbSearch.value = '';
    },
    search: filmTitle => {
        // Remove unnecessary whitespace
        filmTitle = filmTitle.trim();

        // Set current text to what we're searching
        ui.currentFilm.value = filmTitle;

        // Remove the first title from the text box and set the remaining number
        ui.filmsRemaining.textContent = App.films.length;
        ui.filmList.value = App.films.join('\n');

        // Run regex if it matches and let the manager process the result.
        // Otherwise try searching for the whole line before skipping it.
        // eslint-disable-next-line no-sparse-arrays
        const result = App.regexObj.exec(filmTitle) || [, filmTitle];
        if (result) {
            App.manager.processRegexMatch(result, filmTitle2 => {
                // Set imdb search input field to film title and trigger search
                elIMDbSearch.value = filmTitle2;
                elIMDbSearch.dispatchEvent(new Event('keydown'));
            });
        } else {
            App.handleNext();
        }
    },
};

// Handle clicks on search results by a user or the script
elIMDbResults.addEventListener('click', e => {
    const imdbID = e.target.dataset.const;
    if (!imdbID.startsWith('tt')) return;
    App.manager.handleSelection(imdbID, () => {
        setTimeout(() => App.handleNext(), REQUEST_DELAY);
    });
});

// Monitor for changes to the search result box.
// If the search was for IMDb URL/ID, the only result is clicked automatically
const mut = new MutationObserver(mutList => mutList.forEach(({ addedNodes }) => {
    if (!addedNodes.length || !/(nm|tt)\d{7}/i.test(ui.currentFilm.value)) return;
    addedNodes[0].click();
}));
mut.observe(elIMDbResults, { childList: true });

App.run();
