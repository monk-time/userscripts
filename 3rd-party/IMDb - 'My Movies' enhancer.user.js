// File encoding: UTF-8
//
// This is a script for the IMDb site. It emphasize links to movies in your
// "My Movies" and "Vote History" lists. For instance, on an actor's page,
// you'll easily notice which of his/her movies you've already seen/voted.
//
// Copyright (c) 2008-2016, Ricardo Mendonça Ferreira (ric@mpcnet.com.br)
// Released under the GPL license - http://www.gnu.org/copyleft/gpl.html
//
// --------------------------------------------------------------------
//
// ==UserScript==
// @name          IMDb - "My Movies" enhancer
// @description   Emphasize the links for movies you rated and/or on your lists
// @namespace     http://www.flickr.com/photos/ricardo_ferreira/2502798105/
// @homepageURL   https://openuserjs.org/scripts/AltoRetrato/IMDb_My_Movies_enhancer
// @copyright     2008-2017, Ricardo Mendonca Ferreira
// @license       GPL v3; http://www.gnu.org/copyleft/gpl.html
// @author        Ricardo, monk-time
// @include       http://*.imdb.com/*
// @match         http://*.imdb.com/*
// @exclude       http://i.imdb.com/*
// @exclude       http://*imdb.com/images/*
// @exclude       http://*imdb.com/list/export*
// @exclude       http://*imdb.com/eyeblaster/*
// @icon          http://www.imdb.com/favicon.ico
// @version       2.0
// ==/UserScript==
//
// --------------------------------------------------------------------
//
// This is a Greasemonkey user script.
//
// To install, you either need Google Chrome (www.google.com/chrome)
// or Firefox (www.firefox.com) with Greasemonkey (www.greasespot.net).
// Install Greasemonkey, then restart Firefox and revisit this script.
//
// To uninstall, go to Tools/Greasemonkey/Manage User Scripts,
// select this script and click Uninstall.
//
// --------------------------------------------------------------------
//
// To-do:
//   - Add support for other types of lists
//
// History:
// --------
// 2017.11.31  [2.0]  A full rewrite in modern JS (ES6+).
//                    Added a flexible system of custom list priorities.
//                    The script now retries exporting a list if IMDb returns garbage instead of csv
//                    Changed the storage system so that it takes less space and time
//                    to create tooltips.
// 2017.03.16  [1.39] New IMDb layout, new highlightTitle()
// 2016.01.27  [1.38] New IMDb layout, new highlightTitle()
// 2014.12.19  [1.37] Work around IMDb CSV bug: https://openuserjs.org/scripts/Ricardo/IMDb_My_Movies_enhancer/issues/Script_doesnt_parse_movies_with_character_in_the_title
// 2014.10.31  [1.36] New script hosting (OpenUserJs.org); small fixes
// 2013.10.05  [1.35] Fixed bug where script buttons might not show up sometimes
// 2013.09.21  [1.33] Experimental: downloading all lists at once! (http://userscripts.org/topics/131873)
// 2013.09.20  [1.32] Fixed another change in the IMDb site (http://userscripts.org/topics/126010?page=2)
// 2013.05.31  [1.31] Adding some more error checking
// 2013.05.29  [1.30] Fixed bug in the "tabs" sections (trivia, connections, etc.)
// 2013.05.27  [1.29] Working again after changes on IMDb site; fixed tooltip bug
//                    that could affect navigation (thanks, somini!); fixed tooltip bug where
//                    the tooltip would appear behind another element; highlighting works
//                    on the main page of a title
// 2012.12.06  [1.28] Sorry... fixed a bug introduced in the previous bugfix. :P
// 2012.12.06  [1.27] Changed versioning model (since it wasn't working correctly on Chrome),
//                    fixed small bug where search results were not being highlighted.
// 2012.12.06  [1.26] Fix for IMDb site change, correctly shows how many lists it will load,
//                    should also work with dynamic loaded links and images
// 2011.10.06  [1.25] Workaround fixed Opera regex memory leak; Added code to give
//                    "color priority" for a specific list (see movieColor function)
// 2011.10.05  [1.24] Fixed bug where movie data was not captured if there were no votes for it;
//                    Small changes to try to fix possible memory leaks on Opera
// 2011.09.19  [1.23] Fixed & improved code to handle ratings, now should always show the
//                    correct rating for a movie in the tooltips
// 2011.09.17  [1.22] Small bugfixes; made it work again on Google Chrome
// 2011.09.14  [1.21] Works on xx.imdb.com; made it easier to support movies lists in
//                    languages other than English (if/when they are available)
// 2011.09.09  [1.20] To disable color highlighting for a list just remove its customColors
//                    entry, or make the color = ""; Now compatible with N900 again; Shows
//                    both your rating & IMDb rating in the tooltip
// 2011.09.07  [1.19] Fix for IMDb change in the format of the export link
// 2011.09.06  [1.18] Fixed bug where movies were still considered in a list when they were not
// 2011.09.04  [1.17] Using dhtml tooltips; added tooltip to movie titles;
// 2011.09.02  [1.16] Get lists id with new regex to avoid conflict with other scripts;
//                    Show in the link title all lists a movie is in;
//                    Enable custom lists colors by changing the script code (look for customColors)
// 2011.08.27c [1.15] Automatically reload page when changed sort/view
// 2011.08.27b [1.14] Don't stop downloads if can't find movies in a list;
//                    ignore lists not about titles
// 2011.08.27  [1.13] Slightly better handling of download errors
// 2011.08.26d [1.12] Fourth updade in a day! Now sorting option is user selectable
// 2011.08.26c [1.11] IMDb enabled list configuration... it's not working on all lists, though...
// 2011.08.26b [1.10] Less than an hour after uploading the script IMDB changed a few features again
// 2011.08.26  [1.9]  Changed how lists are displayed by default; allow manual update of information
// 2011.08.13  [1.8]  Working with new list design, using localStorage instead of GM_*Value
// 2010.06.17  [1.7]  Added functions "missing" from Chrome; thanks, ode!
// 2009.09.23  [1.6]  Fix for another site redesign
// 2009.08.12  [1.5]  Restored code to deal with links like those on http://www.imdb.com/Sections/Genres/Sci-Fi/average-vote
// 2009.07.28  [1.4]  Fix for IMDb site change, added debug information,
//                    exclude running on image URLs
// 2008.08.27  [1.3]  Explicitly send cookies (FF3 compatibility fix)
// 2008.07.27  [1.2]  Fixed bug where removed movies where not actually removed;
//                    now also highlight the title of the movies
// 2008.06.11  [1.1]  Fixed bug that ketp growing the movie data in Firefox;
//                    now also get the vote history
// 2008.05.18  [1.0]  First public release
// 2008.05.12  [0.1]  First test version, private use only

// TODO: test in Chrome
// TODO: check if the html returned instead of csv contains csv header
// TODO: list export format has changed? investigate

'use strict';

// ------- Settings -------

// Here you can add a custom color to one of your lists.
// If a movie is in several your lists, the list with the highest priority wins.
// Each entry should be ['<List title>', '<Color>']
//   (or just ['<List title>'] if you only need to set priority)
//   and provided in the descending order of their priority.
// You can remove lines for ratings/watchlists if you don't want to highlight them.
//
// To see some color names and codes, visit:
//   http://www.w3schools.com/tags/ref_color_tryit.asp?color=White
//   http://www.w3schools.com/html/html_colorvalues.asp
// To make it work: be sure to save the script, reload the lists page,
//   clear the highlight data (which will reload the lists page again)
//   and then refresh the highlight data!
const defaultColor = 'DarkCyan';
const defaultList = Symbol('default');
const defaultColors = [
    ['/. list', '#11B300'],
    ['/. 2016', '#11B300'],
    ['/. 2015', '#11B300'],
    ['/. 2014', '#11B300'],
    ['/. 2013', '#11B300'],
    ['/. 2012', '#11B300'],
    ['/. <400 checks (2015)', '#11B300'],
    ['Your ratings', 'Green'],
    ['John Silver Personal Video', 'DimGray'],
    ["Moscow State University's Essential Film Viewing List for Journalism Students", 'DarkRed'],
    ["Sergey Kudryavtsev's Highest Rated Films", 'DarkOrchid'],
    ['TSPDT + Harvard + >=8 + Favs', 'DodgerBlue'],
    ["count's Top 300 Must-See Foreign Films", 'Teal'],
    ['Намётки', 'DarkSlateBlue'],
    ['Гусские реки'],
    [defaultList],
    ['Your watchlist', 'DarkGoldenRod'],
];

const delayBetweenRequests = 100; // in ms

// ------- CSS / Tooltips / Progress bar -------

const injectCSS = () => document.head.insertAdjacentHTML('beforeend', `<style>
    #mme-tooltip {
        display: block;
        position: absolute;
        max-width: 500px;
        z-index: 100000;
    }

    #mme-tooltip-inner {
        display: block;
        padding: 2px 12px 3px 7px;
        margin-left: 5px;
        background: #666;
        color: #FFF;
        font: 11px/1.5 Verdana, Arial, Helvetica, sans-serif;
    }

    .mme-with-tooltip {
        font-weight: bold;
    }

    #mme-progress-box {
        background-color: white;
        border: 2px solid black;
        position: fixed;
        height: 30px;
        width: 200px;
    }

    #mme-progress-bar {
        background-color: green;
        border: none;
        height: 100%;
    }

    #mme-progress-text {
        text-align: center;
        margin-top: -25px;
        font-family: Verdana, sans-serif;
    }

    .mme-btn {
        margin-right: 10px !important;
        font-size: 11px;
    }

    .mme-btn-container {
        margin-top: 10px;
    }
</style>`);

// Modified version of Michael Leigeber's code, from:
// http://sixrevisions.com/tutorials/javascript_tutorial/create_lightweight_javascript_tooltip/
// http://userscripts.org/scripts/review/91851 & others
class Tooltip {
    constructor() {
        this.alpha = 0;
        this.listener = this.move.bind(this);
        // Configuration
        this.id = 'mme-tooltip';
        this.maxAlpha = 95;
        this.top = 3;
        this.left = 15;
        this.fadeStep = 10;
        this.delayMs = 20;
    }

    create() {
        this.tt = document.createElement('div');
        this.tt.id = this.id;
        this.inner = document.createElement('div');
        this.inner.id = `${this.id}-inner`;
        this.tt.appendChild(this.inner);
        document.body.appendChild(this.tt);
    }

    show(msg) {
        if (!msg) return;
        if (!this.tt) this.create();
        this.tt.style.display = 'block';
        this.inner.innerHTML = msg;
        document.addEventListener('mousemove', this.listener);
        clearInterval(this.intervalID);
        this.intervalID = setInterval(() => this.fade(true), this.delayMs);
    }

    hide() {
        if (!this.tt) return;
        clearInterval(this.intervalID);
        this.intervalID = setInterval(() => this.fade(), this.delayMs);
    }

    fade(fadeIn = false) {
        const a = this.alpha;
        if (a !== this.maxAlpha && fadeIn || a !== 0 && !fadeIn) {
            const remainder = fadeIn ? this.maxAlpha - a : a;
            const delta = Math.min(this.fadeStep, remainder);
            this.alpha = a + delta * (fadeIn ? 1 : -1);
            this.tt.style.opacity = this.alpha * 0.01;
        } else {
            clearInterval(this.intervalID);
            if (!fadeIn) {
                this.tt.style.display = 'none';
                document.removeEventListener('mousemove', this.listener);
            }
        }
    }

    move(e) {
        this.tt.style.top = `${e.pageY + this.top}px`;
        this.tt.style.left = `${e.pageX + this.left}px`;
    }

    attach(el, msg) {
        el.addEventListener('mouseenter', () => this.show(msg));
        el.addEventListener('mouseleave', () => this.hide());
    }
}

class ProgressBar {
    constructor(total) {
        this.done = 0;
        this.total = total;
        this.create();
    }

    create() {
        this.pbBox = document.createElement('div');
        this.pbBox.id = 'mme-progress-box';
        this.pbBox.style.top = `${Math.round(window.innerHeight / 2) - 15}px`;
        this.pbBox.style.left = `${Math.round(window.innerWidth / 2) - 100}px`;
        this.pbBox.innerHTML = `
            <div id="mme-progress-bar" style="width: 0%"></div>
            <div id="mme-progress-text">Loading 1/${this.total}...</div>
        `;
        document.body.appendChild(this.pbBox);
        [this.pb, this.pbTxt] = this.pbBox.children;
    }

    update() {
        this.done++;
        const percent = Math.round(this.done * 100 / this.total);
        this.pb.style.width = `${percent}%`;
        this.pbTxt.textContent = `Loaded ${this.done}/${this.total}`;
        if (this.done >= this.total) {
            alertNamed("OK, we're done!");
            this.hide();
        }
    }

    hide() {
        this.pbBox.remove();
    }
}

// ------- Page manipulation/parsing -------

const alertNamed = msg => alert(`[IMDb "My Movies" Enhancer]:\n\n${msg}`);
// Encode the number part of the IMDb movie id in base 36 to save memory
const encodeID = numStr => parseInt(numStr, 10).toString(36);

// Return name of user currently logged on IMDb (log on console if failed)
const getCurrentUser = () => {
    const errorMsg = `${window.location.href}\nUser not logged in (or couldn't get user info)`;
    const account = document.querySelector('#consumer_user_nav .navCategory > a[href*="/user/"]');
    if (!account) throw new Error(errorMsg);
    const loggedIn = account.textContent.trim();
    if (!loggedIn) throw new Error(errorMsg);

    return loggedIn;
};

// Make links for lists open in compact view and inverse sort order
const fixLinksForLists = () => {
    const parts = ['?tab=', '?list_id=', '/profile/lists', '/mymovies/list', '/list/create', '/list/ratings'];
    const anchors = document.getElementsByTagName('a');
    for (const a of anchors) {
        const m = a.href.match(/\/(watch)?list/);
        if (!m || parts.some(s => a.href.includes(s)) || a.href === '/lists') {
            continue;
        }

        a.href += '?start=1&view=compact&sort=listorian:desc';
    }
};

// userData.lists[0].name  == "Your watchlist"  -> Name of the list
// userData.lists[0].id    == "watchlist"       -> "id" of the list
// userData.lists[0].color == "DarkGoldenRod"   -> color used to highlight movies in this list
// userData.movies["1yjf"].m == 10          -> my rating
// userData.movies["1yjf"].i == 6.6         -> IMDB rating
// userData.movies["1yjf"].l == [0, 4, 7]   -> indices of lists in userData.lists with this movie
// "1yjf" = movie number (e.g. "tt0091419") encoded in base 36

// Parse all lists (name & id) for current user
// and set default colors for them (if not previously defined)
const parseMyLists = () => {
    // Temporarily index default colors by list name and preserve list priority
    const defaultsObj = defaultColors.reduce((obj, [name, color = defaultColor], rank) =>
        ({ ...obj, [name]: { name, rank, color } }), {});

    const mainLists = ['ratings', 'watchlist']
        .map(id => ({ id, ...defaultsObj[`Your ${id}`] }))
        .filter(x => x.name);

    // Get all other lists names in this page (should work only on imdb.com/user/xxx/lists)
    const customLists = [...document.querySelectorAll('.lists td.name')]
        // Lists can be about Titles, People, Characters & Images
        .filter(el => el.textContent.includes(' Titles)'))
        .map(({ children: [link] }) => {
            const id = link.href.match(/\/list\/([^/?]+)\/?/)[1];
            const name = link.text;
            // If custom priority for defaultList is missing, set the lowest priority
            const { rank = defaultColors.length, color } =
                defaultsObj[name] || defaultsObj[defaultList];
            return { id, name, rank, color };
        });

    if (!customLists.length) console.error('No custom movie lists found');

    return [...mainLists, ...customLists]
        .sort(({ rank: a }, { rank: b }) => a - b)
        .map(list => {
            delete list.rank;
            return list;
        });
};

// ------- Downloading -------

// Async helpers
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const retryWithDelay = async (retries, delay, asyncFn) => {
    try {
        return await asyncFn();
    } catch (err) {
        if (retries > 0) {
            console.error(`${err.message}\nRetrying (${retries} attempts left)`);
            await sleep(delay);
            return retryWithDelay(retries - 1, delay, asyncFn);
        }

        throw err;
    }
};

// Asynchronously download all user lists at once
const downloadLists = async () => {
    userData.lists = parseMyLists();
    const progressBar = new ProgressBar(userData.lists.length);
    const [, userID] = window.location.pathname.match(/\/(ur\d+)/) || [];
    if (!userID) {
        alertNamed('Sorry, but I could not find your user ID (required to download your lists). :(');
        return;
    }

    const tasks = userData.lists.map(async (list, i) => {
        // Firing all requests at once seems to cause erroneous responses from the server
        await sleep(delayBetweenRequests * i);
        // For some reason sometimes IMDb returns HTML instead of an exported list
        const movieList = await retryWithDelay(3, 1000, () => downloadList(list, userID));
        progressBar.update();
        return movieList;
    });

    try {
        userData.movies = mergeMovies(await Promise.all(tasks));
        saveUserData();
    } catch (err) {
        alertNamed(err.message);
        console.error(err.message, err.stack);
        progressBar.hide();
    }
};

// Download a list
const downloadList = async ({ id, name }, userID) => {
    const exportURL = `http://${window.location.host}/list/export?list_id=${id}&author_id=${userID}`;
    try {
        const r = await fetch(exportURL, { credentials: 'same-origin' });
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return parseExportedList(await r.text());
    } catch (err) {
        throw new Error(`Can't export your list: ${err.message}\n` +
            `List: ${name}\nSource: ${exportURL}\n`);
    }
};

// Process a downloaded list; returns a sparse array
const parseExportedList = csv => {
    if (!csv.startsWith('"position","const",')) {
        throw new Error("The server didn't return a valid csv");
    }

    return csv.trim().split('\n').slice(1).map(line => {
        // CSV structure:
        // 00: position    | 06: Title type     | 12:Genres
        // 01: const       | 07: Directors      | 13:Num. Votes
        // 02: created     | 08: You rated      | 14:Release Date (month/day/year)
        // 03: modified    | 09: IMDb Rating    | 15:URL
        // 04: description | 10: Runtime (mins) |
        // 05: Title       | 11: Year           |
        const fields = line.split('","');
        if (line.length < 50 || fields.length !== 16 || !fields[1].startsWith('tt')) {
            throw new Error(`Got malformed line in csv: ${line}`);
        }

        const mID = encodeID(fields[1].substr(2));
        const [m, i] = fields.slice(8, 10).map(parseFloat);
        // Store ratings only if they are set (both can be missing)
        return { mID, ratings: { ...m && { m }, ...i && { i } } };
    });
};

const mergeMovies = movieLists => movieLists.reduce((movies, movieList, listIndex) => {
    for (const { mID, ratings } of movieList) {
        if (!movies[mID]) movies[mID] = { ...ratings, l: [] };
        // Update an array of indices of lists that this movie is in
        movies[mID].l.push(listIndex);
    }

    return movies;
}, {});

// ------- Storage -------

// Load data for the current user
const loadUserData = () => {
    const json = localStorage.getItem(`myMovies-${user}`);
    try {
        if (!json) throw new Error(`No script data for ${user} saved in storage`);
        const data = JSON.parse(json);
        if (!data.movies) throw new Error('Pre-v2.0 data is incompatible with v2.0+');
        return data;
    } catch (err) {
        console.error(`Error loading previous data!\n${err.message}`);
        eraseUserData();
        return null;
    }
};

// Save all data for the current user
const saveUserData = () => {
    const json = JSON.stringify(userData);
    localStorage.setItem(`myMovies-${user}`, json);
};

// Clear the storage for the current user but keep lists information in memory
const eraseUserData = () => {
    localStorage.removeItem(`myMovies-${user}`);
};

// ------- Highlighting -------

// Highlight the title header in the current page
const highlightTitle = () => {
    const title = document.querySelector('.title_wrapper h1');
    if (!title) return;
    highlightElement(title, window.location.href);
};

// Highlight all links in the current page for an IMDb movie page
const selIMDbLink = 'a[href*="/tt"], a[href*="/Title?"]';
const badSegments = ['cons_tt_contact', 'tt_moviemeter_why'];
const highlightLinks = (ctx = document.body) => {
    if (!(ctx instanceof Element)) return;
    const anchors = ctx.matches(selIMDbLink) ? [ctx] : ctx.querySelectorAll(selIMDbLink);
    for (const a of anchors) {
        if (a.classList.contains('mme-with-tooltip')) continue;
        if (badSegments.some(s => a.href.includes(s))) continue;
        highlightElement(a, a.href);
    }
};

// Highlight any element based on a known IMDb ID in a url
const highlightElement = (el, url) => {
    // Match both modern and old-style urls like http://www.imdb.com/Title?0266543
    const match = url.match(/(?:tt|imdb\..{2,3}\/Title\?)0*(\d+)\/?(?:$|\?)/);
    if (!match) return;
    const mID = encodeID(match[1]);
    if (!userData.movies[mID]) return;
    el.style.color = getMovieColor(mID);
    tooltip.attach(el, formMovieListsHTML(mID));
    if (el.tagName !== 'H1' && el.parentElement.tagName !== 'H1') {
        el.classList.add('mme-with-tooltip');
    }
};

// Receive an IMDb movie code and return the highlight color (if any)
// for the first list containing the movie
const getMovieColor = mID => {
    // All movies in userData have at least one listIndex, and all lists have a color
    const [listIndex] = userData.movies[mID].l;
    return userData.lists[listIndex].color;
};

// Receive an IMDb movie code and return the names of lists containing the movie
const formMovieListsHTML = mID => {
    const { m, i, l: lists } = userData.movies[mID];
    const names = lists.map(listID => userData.lists[listID].name);
    if (m) names.splice(names.indexOf('Your ratings'), 1);

    const ratings = m ?
        `Your rating: ${m}${i ? ` (IMDb: ${i})<br>` : ''}` :
        i ? `IMDb rating: ${i}<br>` : '';
    if (!names.length) return ratings;

    const header = names.length === 1 ?
        '<b>In your list:</b><br>' :
        `<b>In ${names.length} of your lists:</b><br>`;

    return `${ratings}${header}
        <div style="margin-left: 15px">
            ${names.join('<br>')}
        </div>`;
};

// ------- Buttons -------

const addButtons = reverseLists => {
    const h1 = document.getElementsByTagName('h1');
    if (!h1.length) {
        console.log('Could not find the "main" div to insert buttons!');
        return;
    }

    const div = document.createElement('div');
    div.className = 'aux-content-widget-2 mme-btn-container';
    const buttons = [btnRefresh, btnClear, btnSort(reverseLists), btnHelp]
        .map(createButton);
    div.append(...buttons);
    h1[0].appendChild(div);
};

const createButton = ({ text, help, trigger }) => {
    const btn = document.createElement('button');
    btn.className = 'mme-btn btn';
    btn.textContent = text;
    btn.title = help;
    btn.addEventListener('click', trigger);
    return btn;
};

const btnRefresh = {
    text: 'Refresh highlight data',
    help: 'Reload movie information from your lists - might take a few seconds',
    trigger() {
        alertNamed(`${user}, I'll get some info from IMDb to be able to highlight your movies,\n` +
            'please click [OK] and wait a bit...');
        eraseUserData();
        downloadLists();
    },
};

const btnClear = {
    text: 'Clear highlight data',
    help: 'Disable color highlighting of movie titles',
    trigger() {
        eraseUserData();
        alertNamed('Done! Information cleared, so highlighting is now disabled.');
    },
};

const btnSort = reverseLists => ({
    text: `Sort/view: ${reverseLists ? 'old style' : 'default'}`,
    help: "Enable/disable your lists to open by default in compact mode and inverse order (like in the 'old style')",
    trigger() {
        const sort = localStorage.getItem(`myMovies-${user}-sort`) === 'true';
        const toggled = !sort;
        localStorage.setItem(`myMovies-${user}-sort`, toggled);
        window.location.reload();
    },
});

const btnHelp = {
    text: "What's this?",
    help: 'Click for help on these buttons',
    trigger() {
        alertNamed('This is a user script that:\n' +
            '\t - highlights links for movies in your lists\n' +
            '\t - changes the default view of your lists\n' +
            '\t - shows in which of your lists a movie is (in a tooltip)\n\n' +
            'In order to highlight the movies ' +
            'in all IMDb pages as fast as possible, we need to download ' +
            'the data from your lists into your browser. Unfortunately ' +
            'this can be slow, so it is not done automatically. I suggest ' +
            'you to update this information at most once a day.\n\n' +
            '[Refresh highlight data] updates the data in your browser.\n' +
            '[Clear highlight data] disables color highlighting.\n' +
            '[Sort/View] changes how lists are displayed by default (click to toggle; requires page reload).\n\n' +
            'For more information and updates, visit http://userscripts.org/scripts/show/26818');
    },
};

// ------- Main -------

// Find current logged in user, or quit script
const user = getCurrentUser(); // Current user name/alias

// Fix links for lists
const reverseLists = localStorage.getItem(`myMovies-${user}-sort`) === 'true';
if (reverseLists) fixLinksForLists();

injectCSS();
const tooltip = new Tooltip();

let userData = { lists: [], movies: {} };
if (window.location.href.match(/\.imdb\.com\/user\/[^/]+\/lists/)) {
    // Allow user to manually update his/her list of movies
    addButtons(reverseLists);
} else {
    // Load movie data for this user from localStorage
    userData = loadUserData() || userData;
}

// Highlight movie links
if (userData.lists.length) {
    highlightTitle();
    highlightLinks();

    const mut = new MutationObserver(mutList => mutList.forEach(({ addedNodes }) => {
        if (!addedNodes.length) return;
        addedNodes.forEach(highlightLinks);
    }));
    mut.observe(document.body, { childList: true, subtree: true });
}

// Test URLs:
//    http://www.imdb.com/mymovies/list
//    http://www.imdb.com/title/tt0110912/trivia?tab=mc
//    http://www.imdb.com/chart/top
//    http://www.imdb.com/genre/sci_fi
//    http://www.imdb.com/search/title?genres=sci_fi&title_type=feature&num_votes=1000,&sort=user_rating,desc
//    http://www.imdb.com/event/ev0000003/2011
//    http://www.imdb.com/year/2004
//    Over the "instantaneous results" below the search box
//       Funny... Shark Tale on the page above points to http://www.imdb.com/title/tt0384531/,
//       but when opened it redirects to ............... http://www.imdb.com/title/tt0307453/
//    Titles producing invalid CSV files:
//    http://www.imdb.com/title/tt0095675/
//    http://www.imdb.com/title/tt0365748/
