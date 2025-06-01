// ==UserScript==
// @name           IMDb - List Helper
// @description    Makes creating IMDb lists more efficient and convenient
// @namespace      imdb
// @author         themagician, monk-time
// @include        https://*imdb.com/list/*/edit/
// @icon           https://www.imdb.com/favicon.ico
// @version        3.2
// ==/UserScript==

//
// CHANGELOG
//
// 3.2
// fixed: Support IMDb's new GraphQL API by sending requests directly instead of using the form
//        (I couldn't figure out how to use the React form through JS).
//        You have to update the page manually to see the changes
// removed: Had to remove the ability to import ratings as it didn't work anyway
//
// 3.1.1
// fixed: Support HTTPS pages
//
// 3.1
// fixed: 'Skip/retry' buttons failed to keep search results visible
// changed: The script searches for both IDs or titles by default again
// added: A more granular control for what is used for search
//
// 3.0.1
// fixed: New IMDb search results layout
// changed: Search only for regex matches by default
// added: A checkbox to toggle search mode (matches only vs. matches or full string)
//
// 3.0
// fixed: Search by movie title
// fixed: No longer requires jQuery; jquery-csv is replaced with d3-dsv
// fixed: Remove delay before auto-clicking on a search result
// changed: Criticker score conversion: 0..10 -> 1, 11..20 -> 2, 91..100 -> 10
// changed: Criticker importer requires .csv
// changed: If the regex fails, try searching for the whole string
//
// 2.4.1
// fixed: In some instances the script wasn't loaded (bad @include)
// changed: Limit number of setTimeOut calls
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
        margin: 0 0 5% 0;
        padding: 10px;
        border: 1px solid #e8e8e8;
    }

    #ilh-ui div {
        margin: 0.5em 0 0.75em
    }

    #ilh-ui label {
        font-weight: normal;
        margin-right: 6px;
    }

    #ilh-ui span,
    #ilh-ui label:first-child {
        font-weight: bold;
    }

    #ilh-ui textarea {
        width: 100%;
        background-color: lightyellow;
        overflow: auto;
    }

    #ilh-ui .ilh-block {
        display: flex;
    }

    #ilh-ui .ilh-block input[type=text] {
        font-family: monospace;
        flex-grow: 1;
    }
</style>`);

const searchModeHints = {
    auto: 'Input titles, IMDb URLs or IDs here and click Start. ' +
        'If a line has an IMDb ID, it\'ll be auto-added to the list. ' +
        'Otherwise the whole line will be searched for, ' +
        'and you\'ll have to select the correct title manually.',
    imdbid: 'Input text containing IMDb IDs here and click Start. ' +
        'IMDb IDs are extracted from lines (only one per line) and ' +
        'auto-added to the list, skipping the rest.',
    line: 'Input titles or IMDb IDs here and click Start. ' +
        'Whole lines are used for search, nothing is skipped.',
    regexp: 'Input text here and click Start. Only captured groups of regex matches ' +
        'are used for search.',
};

const uiHTML = `
    <div id="ilh-ui">
        <textarea id="ilh-film-list" rows="7" placeholder="${searchModeHints.auto}"></textarea>
        <div>
            <input type="button" value="Start" id="ilh-start">
            <span>Remaining: <span id="ilh-films-remaining">0</span></span>
        </div>
        <div class="ilh-block">
            <label for="ilh-current-film">Current:</label>
            <input type="text" id="ilh-current-film">
        </div>
        <div class="ilh-block" id="ilh-regexp-box" style="display: none">
            <label for="ilh-regexp">Regexp:</label>
            <input type="text" id="ilh-regexp">
        </div>
        <div id="ilh-search-mode-box">
            <label for="ilh-search-mode">Search mode:</label>
            <select name="searchmode" id="ilh-search-mode">
                <option value="auto" selected>Auto</option>
                <option value="imdbid">IMDb IDs</option>
                <option value="line">Line</option>
                <option value="regexp">Regexp</option>
            </select>
        </div>
    </div>`;

document.querySelector('div[data-testid=add-const-to-list-container]')
    .insertAdjacentHTML('afterend', uiHTML);

const innerIDs = [
    'film-list',
    'start',
    'films-remaining',
    'current-film',
    'search-mode-box',
    'search-mode',
    'regexp-box',
    'regexp',
];

const camelCase = s => s.replace(/-[a-z]/g, m => m[1].toUpperCase());

// Main object for interacting with the script's UI; keys match element ids
const ui = Object.assign(...innerIDs.map(id => ({
    [camelCase(id)]: document.getElementById(`ilh-${id}`),
})));

ui.freezables = [ui.filmList, ui.start, ui.regexp, ui.searchMode];

// ----- HANDLERS AND ACTIONS -----

// eslint-disable-next-line no-promise-executor-return
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const App = {
    regex: /((?:tt|nm)\d+)/i, // IMDb IDs
    match: (line, mode, regex) => ({
        /* eslint-disable no-sparse-arrays */
        // 'auto' - search for an id (if a string has one) or for a full non-empty string
        auto: s => App.regex.exec(s) || (s && [, s]),
        imdbid: s => App.regex.exec(s),
        line: s => s && [, s],
        regexp: s => regex.exec(s),
        /* eslint-enable no-sparse-arrays */
    })[mode](line),
    films: [],
    regexObj: null,
    run: async () => {
        // Set the default value for the 'Regexp' mode
        ui.regexp.value = App.regex.source;

        ui.searchMode.addEventListener('change', () => {
            ui.regexpBox.style.display = ui.searchMode.value === 'regexp' ? '' : 'none';
            ui.filmList.placeholder = searchModeHints[ui.searchMode.value];
        });

        ui.start.addEventListener('click', async () => {
            // This will be used only for 'regexp' mode
            App.regexObj = new RegExp(ui.regexp.value, 'i');

            // Disable relevant UI elements
            ui.freezables.forEach(el => {
                el.disabled = true;
            });

            App.films = ui.filmList.value.trim().split('\n');
            await App.handleNext();
        });
    },
    handleNext: async () => {
        if (App.films.length) {
            await App.search(App.films.shift());
        } else { // if last film
            App.reset();
        }
    },
    reset: () => {
        App.films = [];
        App.regexObj = null;

        ui.freezables.forEach(el => {
            el.disabled = false;
        });

        ui.currentFilm.value = '';
    },
    search: async line => {
        line = line.trim();
        ui.currentFilm.value = line;
        ui.filmsRemaining.textContent = App.films.length;
        ui.filmList.value = App.films.join('\n');

        const result = App.match(line, ui.searchMode.value, App.regexObj);
        if (result) {
            console.log(`Searching for: ${result[1]}`);
            await App.fetch(result[1]);
            await sleep(REQUEST_DELAY);
        }

        await App.handleNext();
    },
    fetch: async imdbid => {
        await fetch('https://api.graphql.imdb.com/', {
            method: 'POST',
            mode: 'cors',
            credentials: 'include',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                query: 'mutation AddConstToList($listId: ID!, $constId: ID!, $includeListItemMetadata: Boolean!, $refTagQueryParam: String, $originalTitleText: Boolean, $isInPace: Boolean! = false) {\n  addItemToList(input: {listId: $listId, item: {itemElementId: $constId}}) {\n    listId\n    modifiedItem {\n      ...EditListItemMetadata\n      listItem @include(if: $includeListItemMetadata) {\n        ... on Title {\n          ...TitleListItemMetadata\n        }\n        ... on Name {\n          ...NameListItemMetadata\n        }\n        ... on Image {\n          ...ImageListItemMetadata\n        }\n        ... on Video {\n          ...VideoListItemMetadata\n        }\n      }\n    }\n  }\n}\n\nfragment EditListItemMetadata on ListItemNode {\n  itemId\n  createdDate\n  absolutePosition\n  description {\n    originalText {\n      markdown\n      plaidHtml(showLineBreak: true)\n      plainText\n    }\n  }\n}\n\nfragment TitleListItemMetadata on Title {\n  ...TitleListItemMetadataEssentials\n  latestTrailer {\n    id\n  }\n  plot {\n    plotText {\n      plainText\n    }\n  }\n  releaseDate {\n    day\n    month\n    year\n  }\n  productionStatus {\n    currentProductionStage {\n      id\n      text\n    }\n  }\n}\n\nfragment TitleListItemMetadataEssentials on Title {\n  ...BaseTitleCard\n  series {\n    series {\n      id\n      originalTitleText {\n        text\n      }\n      releaseYear {\n        endYear\n        year\n      }\n      titleText {\n        text\n      }\n    }\n  }\n}\n\nfragment BaseTitleCard on Title {\n  id\n  titleText {\n    text\n  }\n  titleType {\n    id\n    text\n    canHaveEpisodes\n    displayableProperty {\n      value {\n        plainText\n      }\n    }\n  }\n  originalTitleText {\n    text\n  }\n  primaryImage {\n    id\n    width\n    height\n    url\n    caption {\n      plainText\n    }\n  }\n  releaseYear {\n    year\n    endYear\n  }\n  ratingsSummary {\n    aggregateRating\n    voteCount\n  }\n  runtime {\n    seconds\n  }\n  certificate {\n    rating\n  }\n  canRate {\n    isRatable\n  }\n  titleGenres {\n    genres(limit: 3) {\n      genre {\n        text\n      }\n    }\n  }\n  canHaveEpisodes\n}\n\nfragment NameListItemMetadata on Name {\n  id\n  primaryImage {\n    url\n    caption {\n      plainText\n    }\n    width\n    height\n  }\n  nameText {\n    text\n  }\n  primaryProfessions {\n    category {\n      text\n    }\n  }\n  professions {\n    profession {\n      text\n    }\n  }\n  knownForV2(limit: 1) @include(if: $isInPace) {\n    credits {\n      title {\n        id\n        originalTitleText {\n          text\n        }\n        titleText {\n          text\n        }\n        titleType {\n          canHaveEpisodes\n        }\n        releaseYear {\n          year\n          endYear\n        }\n      }\n      episodeCredits(first: 0) {\n        yearRange {\n          year\n          endYear\n        }\n      }\n    }\n  }\n  knownFor(first: 1) {\n    edges {\n      node {\n        summary {\n          yearRange {\n            year\n            endYear\n          }\n        }\n        title {\n          id\n          originalTitleText {\n            text\n          }\n          titleText {\n            text\n          }\n          titleType {\n            canHaveEpisodes\n          }\n        }\n      }\n    }\n  }\n  bio {\n    displayableArticle {\n      body {\n        plaidHtml(\n          queryParams: $refTagQueryParam\n          showOriginalTitleText: $originalTitleText\n        )\n      }\n    }\n  }\n}\n\nfragment ImageListItemMetadata on Image {\n  id\n  url\n  height\n  width\n  caption {\n    plainText\n  }\n  names(limit: 4) {\n    id\n    nameText {\n      text\n    }\n  }\n  titles(limit: 1) {\n    id\n    titleText {\n      text\n    }\n    originalTitleText {\n      text\n    }\n    releaseYear {\n      year\n      endYear\n    }\n  }\n}\n\nfragment VideoListItemMetadata on Video {\n  id\n  thumbnail {\n    url\n    width\n    height\n  }\n  name {\n    value\n    language\n  }\n  description {\n    value\n    language\n  }\n  runtime {\n    unit\n    value\n  }\n  primaryTitle {\n    id\n    originalTitleText {\n      text\n    }\n    titleText {\n      text\n    }\n    titleType {\n      canHaveEpisodes\n    }\n    releaseYear {\n      year\n      endYear\n    }\n  }\n}',
                operationName: 'AddConstToList',
                variables: {
                    listId: window.location.href.match(/ls\d+/)[0],
                    constId: imdbid,
                    includeListItemMetadata: true,
                    refTagQueryParam: 'lsedt_add_items',
                    originalTitleText: false,
                    isInPace: false,
                },
            }),
        });
    },
};

App.run();
