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
// @version        2.4.0
// ==/UserScript==

//
// CHANGELOG
//
// 3.0
// fixed: enable on pages with a referal in the query string
// changed: criticker score conversion: 0..10 -> 1, 11..20 -> 2, 91..100 -> 10
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

const process = (file, parser) => {
    for (const line of file.split('\n')) {
        const m = parser(line);
        if (!m) continue;
        $('#film-list').append(`${m.rating},${m.movie}\n`);
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
            process(file, parsers[format]);
        }
    };

    const [file] = e.target.files;
    reader.readAsText(file);
};

const ListManager = {
    regex: '^(.*)$',
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

const App = {
    manager: ListManager,
    films: [],
    regexObj: null,
    isEmpty: () => App.films.length === 0,
    next: () => App.films.shift(),
    run: () => {
        GM_addStyle(`
            #imdb-list-text-edit {
                margin: 0 5% 5% 5%;
                padding: 10px;
                border: 1px solid #e8e8e8;
            }

            #imdb-list-text-edit input[type=text] {
                width: 100%;
                font-family: monospace;
            }

            #imdb-list-text-edit #film-regexp {
                margin-top: 4px;
                margin-left: 1px;
            }

            #imdb-list-text-edit textarea {
                width: 100%;
                background-color: lightyellow;
            }

            #imdb-list-text-edit span {
                font-weight: bold;
            }
        `);
        const textEdit = `
            <div id="imdb-list-text-edit">
                <p>
                    <b>Import mode:</b>
                    <input type="radio" name="importmode" value="list" checked="checked">List</input>
                    <input type="radio" name="importmode" value="ratings">Ratings</input>
                </p>
                <textarea id="film-list" rows="7" cols="60" placeholder="Input titles or IMDb IDs and click Start"></textarea>
                <br>
                <input type="button" id="doList" value="Start">
                <input type="button" id="skipFilm" value="Skip">
                <input type="button" id="retryPost" value="Retry">
                <span>Remaining: <span id="films-remaining">0</span></span>
                <br><br>
                <span>Current: <input type="text" id="film-current" size="65""></span>
                <br>
                <span>Regexp (matches only): <input type="text" id="film-regexp" size="65"></span>
                <br>
                <p id="importform" style="display: none">
                    <b>Import from:</b>
                    <select name="import">
                        <option value="none">Select</option>
                        <option value="imdb">IMDb</option>
                        <option value="rym">RateYourMusic</option>
                        <option value="criticker">Criticker</option>
                    </select>
                    <b>File:</b>
                    <input type="file" id="fileimport">
                </p>
            </div>`;
        $('div.lister-search').after(textEdit);

        $('#film-regexp').val(App.manager.regex);

        $('#fileimport').on('change', handleImport);

        $('#imdb-list-text-edit').on('change', 'input[name=importmode]', function () {
            const value = $(this).val();
            if (value === 'list') {
                App.manager = ListManager;
                $('#importform').hide();
            } else {
                App.manager = RatingManager;
                $('#importform').show();
            }

            $('#film-regexp').val(App.manager.regex);
        });

        // When start button is clicked
        $('#imdb-list-text-edit').on('click', '#doList', () => {
            const $regexBox = $('#film-regexp');
            if ($regexBox.val()) {
                App.regexObj = RegExp($regexBox.val());
            } else {
                App.regexObj = RegExp(App.manager.regex);
            }

            // Disable the text area and the button and the regexp box
            // as well as the import mode
            const $filmList = $('#film-list');
            $filmList.attr('disabled', 'disabled');
            $regexBox.attr('disabled', 'disabled');
            $('#doList').attr('disabled', 'disabled');
            $('input[name=importmode]').attr('disabled', 'disabled');

            App.films = $filmList.val().split('\n');
            App.handleNext();
        });

        // when skip button is clicked
        $('#imdb-list-text-edit').on('click', '#skipFilm', () => {
            App.handleNext();
        });

        // Sometimes the request fails forcing the user to skip an entry to continue
        $('#imdb-list-text-edit').on('click', '#retryPost', () => {
            $('#add-to-list-search').trigger('keydown');
        });
    },
    reset: () => {
        App.films = [];
        App.regexObj = null;

        $('#film-list').removeAttr('disabled');
        $('#film-regexp').removeAttr('disabled'); // leave regex
        $('#doList').removeAttr('disabled');
        $('input[name=importmode]').removeAttr('disabled');

        $('#film-current').val('');

        $('#add-to-list-search', 'div.add').val('');
        // $("div.results", "div.add").html("");
    },
    search: filmTitle => {
        // remove unnecessary whitespace
        filmTitle = $.trim(filmTitle);

        // set current text to what we're searching
        $('#film-current').val(filmTitle);

        // remove the first title from the text box and set the remaining number
        const $filmList = $('#film-list');
        const newList = $filmList.val().split('\n');
        $('#films-remaining').text(newList.length - 1);
        $filmList.val(newList.slice(1).join('\n'));

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
        if (!App.isEmpty()) {
            // if there's more items, search next...
            App.search(App.next());
        } else {
            // if last film
            App.reset();
        }
    },
};

$(document).ready(App.run);

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
    if ($('#film-current').val().match(/([CHMNTchmnt]{2}[0-9]{7})/) !== null &&
        $('a', '#add-to-list-search-results').length) {
        // Some delay is needed for all results to appear
        clickId = setTimeout(() => {
            $('a', '#add-to-list-search-results').first()[0].click();
            clearTimeout(clickId);
        }, REQUEST_DELAY);
    }
});
