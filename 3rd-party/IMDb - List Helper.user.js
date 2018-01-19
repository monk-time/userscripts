// ==UserScript==
// @name           IMDb - List Helper
// @description    Makes creating IMDb lists more efficient and convenient
// @namespace      imdb
// @author         themagician, monk-time
// @include        http://*imdb.com/list/*/edit
// @include        http://*imdb.com/list/*/edit?*
// @icon           http://www.imdb.com/favicon.ico
// @grant          GM_addStyle
// @version        2.4.1
// ==/UserScript==

//
// CHANGELOG
//
// 3.0
// fixed: enable on pages with a referal in the query string
// fixed: search by movie title
// fixed: no longer requires jQuery
// changed: criticker score conversion: 0..10 -> 1, 11..20 -> 2, 91..100 -> 10
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
    }

    #ilh-ui span {
        font-weight: bold;
    }
</style>`);

const uiHTML = `
    <div id="ilh-ui">
        <p>
            <b>Import mode:</b>
            <input type="radio" name="importmode" value="list" checked>List</input>
            <input type="radio" name="importmode" value="ratings">Ratings</input>
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
            <b>Import from:</b>
            <select name="import" id="ilh-import-sel">
                <option value="none">Select</option>
                <option value="imdb">IMDb</option>
                <option value="rym">RateYourMusic</option>
                <option value="criticker">Criticker</option>
            </select>
            <b>File:</b>
            <input type="file" id="ilh-file-import">
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

const parsers = {
    imdb: line => {
        // TODO: fix for the new layout
        const fields = line.split('","');
        if (fields.length !== 16 || !fields[1].startsWith('tt') || !fields[8]) return null;
        return { movie: fields[1], rating: fields[8] };
    },
    rym: line => {
        const fields = line.split('","');
        if (fields.length < 6) return null;
        return { movie: fields[1], rating: fields[4] };
    },
    criticker: line => { // if exported as .txt
        const fields = line.match(/(\d+)\t(.+)/);
        if (!fields || Number.isNaN(+fields[1])) return null;
        return { movie: fields[2], rating: Math.ceil(+fields[1] / 10) || 1 };
    },
};

const parseFile = (file, parser) => {
    for (const line of file.split('\n')) {
        const m = parser(line);
        if (!m) continue;
        ui.filmList.append(`${m.rating},${m.movie}\n`);
    }
};

const handleImport = e => {
    const reader = new FileReader();
    reader.onload = event => {
        const file = event.target.result;
        const format = ui.importSel.value;
        if (format === 'none') {
            alert('Select importer and try again.');
        } else if (parsers[format]) {
            parseFile(file, parsers[format]);
        }
    };

    const [file] = e.target.files;
    reader.readAsText(file);
};

const RatingManager = {
    rating: 0,
    regex: '^([1-9]|10),(.*)$',
    processRegex: ([, rating, filmTitle], callback) => {
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
    regex: '(tt\\d+)',
    processRegex: ([, filmTitle], callback) => callback(filmTitle),
    handleSelection: (imdbID, callback) => callback(),
};

const App = {
    manager: ListManager,
    films: [],
    regexObj: null,
    run: () => {
        ui.regexp.value = App.manager.regex;

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
            if (ui.regexp.value) {
                App.regexObj = RegExp(ui.regexp.value);
            } else {
                App.regexObj = RegExp(App.manager.regex);
            }

            // Disable relevant UI elements
            [ui.filmList, ui.start, ui.regexp, ui.radioList, ui.radioRatings]
                .forEach(el => { el.disabled = true; });

            App.films = ui.filmList.value.split('\n');
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
        if (App.films.length !== 0) {
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
        // remove unnecessary whitespace
        filmTitle = filmTitle.trim();

        // set current text to what we're searching
        ui.currentFilm.value = filmTitle;

        // remove the first title from the text box and set the remaining number
        const newList = ui.filmList.value.split('\n');
        ui.filmsRemaining.textContent = newList.length - 1;
        ui.filmList.value = newList.slice(1).join('\n');

        // Run regex if it matches and let the manager process the result
        const result = App.regexObj.exec(filmTitle);
        if (result !== null) {
            App.manager.processRegex(result, filmTitle2 => {
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
let clickID = null;
const mut = new MutationObserver(mutList => mutList.forEach(({ addedNodes }) => {
    if (!addedNodes.length || clickID || !/(nm|tt)\d{7}/i.test(ui.currentFilm.value)) return;
    // Some delay is needed for all results to appear
    clickID = setTimeout(() => {
        addedNodes[0].click();
        clearTimeout(clickID);
        clickID = null;
    }, REQUEST_DELAY);
}));
mut.observe(elIMDbResults, { childList: true });

App.run();
