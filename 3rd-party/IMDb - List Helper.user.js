// ==UserScript==
// @name           IMDb - List Helper
// @description    Makes creating IMDb lists more efficient and convenient
// @namespace      imdb
// @author         themagician, monk-time
// @include        http://*imdb.com/list/*/edit
// @include        http://*imdb.com/list/*/edit?*
// @require        https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @icon           http://www.imdb.com/favicon.ico
// @grant          GM_addStyle
// @version        2.4.1
// ==/UserScript==

//
// CHANGELOG
//
// 3.0
// fixed: enable on pages with a referal in the query string
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
        const format = $('select[name=import]').val();
        if (format === 'none') {
            alert('Select importer and try again.');
        } else if (parsers[format]) {
            parseFile(file, parsers[format]);
        }
    };

    const [file] = e.target.files;
    reader.readAsText(file);
};

const ListManager = {
    regex: '(tt\\d+)',
    processRegex: ([, filmTitle], cb) => cb(filmTitle),
    handleSelection: (imdbId, cb) => cb(),
};

const RatingManager = {
    rating: 0,
    regex: '^([1-9]|10),(.*)$',
    processRegex: ([, rating, filmTitle], cb) => {
        RatingManager.rating = rating;
        cb(filmTitle);
    },
    handleSelection: (imdbId, cb) => {
        console.log(`RatingManager::handleSelection: Rating ${imdbId}`);
        $.get(`http://www.imdb.com/title/${imdbId}`, data => {
            const authHash = $(data).find('#star-rating-widget').data('auth');
            const params = {
                tconst: imdbId,
                rating: RatingManager.rating,
                auth: authHash,
                tracking_tag: 'list',
                pageId: imdbId,
                pageType: 'title',
                subPageType: 'main',
            };
            $.post('http://www.imdb.com/ratings/_ajax/title', params, resp => {
                if (resp.status !== 200) {
                    alert(`Rating failed. Status code ${resp.status}`);
                } else {
                    cb();
                }
            }, 'json');
        });
    },
};

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
        <input type="button" id="ilh-start" value="Start">
        <input type="button" id="ilh-skip" value="Skip">
        <input type="button" id="ilh-retry" value="Retry">
        <span>Remaining: <span id="ilh-films-remaining">0</span></span>
        <br><br>
        <span>Current: <input type="text" id="ilh-current-film" size="65""></span>
        <br>
        <span>Regexp (matches only): <input type="text" id="ilh-regexp" size="65"></span>
        <br>
        <p id="ilh-import-form" style="display: none">
            <b>Import from:</b>
            <select name="import">
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
    'import-form',
    'file-import',
];

const camelCase = s => s.replace(/-[a-z]/g, m => m[1].toUpperCase());
// Main object for interacting with the script's UI; keys match element ids
const ui = Object.assign(...innerIDs.map(id => ({
    [camelCase(id)]: document.getElementById(`ilh-${id}`),
})));

[ui.radioList, ui.radioRatings] = document.querySelectorAll('#ilh-ui input[name=importmode]');

const App = {
    manager: ListManager,
    films: [],
    regexObj: null,
    run: () => {
        ui.regexp.value = App.manager.regex;

        ui.fileImport.addEventListener('change', handleImport);

        ui.radioList.addEventListener('change', () => {
            App.manager = ListManager;
            ui.importForm.style.display = 'none';
            ui.regexp.value = App.manager.regex;
        });

        ui.radioRatings.addEventListener('change', () => {
            App.manager = RatingManager;
            ui.importForm.style.display = 'block';
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
            $('#add-to-list-search').trigger('keydown');
        });
    },
    reset: () => {
        App.films = [];
        App.regexObj = null;

        [ui.filmList, ui.start, ui.regexp, ui.radioList, ui.radioRatings]
            .forEach(el => { el.disabled = false; });

        ui.currentFilm.value = '';

        $('#add-to-list-search', 'div.add').val('');
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
                // Set imdb search input field to film title
                $('#add-to-list-search').val(filmTitle2);

                // And perform search
                $('#add-to-list-search').trigger('keydown');
            });
        } else {
            App.handleNext();
        }
    },
    handleNext: () => {
        if (App.films.length !== 0) {
            App.search(App.films.shift());
        } else { // if last film
            App.reset();
        }
    },
};

// When a search result item is clicked by user or script
$('#add-to-list-search-results').on('click', 'a', function () {
    App.manager.handleSelection($(this).attr('id'), () => {
        // Some delay is needed
        setTimeout(() => App.handleNext(), REQUEST_DELAY);
    });
});

// Monitors for changes to the search result box
// If it recognizes an IMDBb URL/ID, it's clicked automatically
// since there's only one result
let clickId = null;
$('#add-to-list-search-results').bind('DOMNodeInserted', () => {
    if (clickId === null && $('a', '#add-to-list-search-results').length &&
        /([CHMNTchmnt]{2}[0-9]{7})/.test(ui.currentFilm.value)) {
        // Some delay is needed for all results to appear
        clickId = setTimeout(() => {
            $('a', '#add-to-list-search-results').first()[0].click();
            clearTimeout(clickId);
            clickId = null;
        }, REQUEST_DELAY);
    }
});

App.run();
