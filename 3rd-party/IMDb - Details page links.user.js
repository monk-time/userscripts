// ==UserScript==
// @name        IMDb - Details page links
// @namespace   IMDb.com
// @description Adds some links to IMDb details page
// @author      themagician, monk-time
// @include     *imdb.com/title/*
// @icon        http://www.imdb.com/favicon.ico
// ==/UserScript==

'use strict';

// Empty arrays are separators, 2-sized are normal urls, 3-sized are inner urls
// Available segments:
//   {title}  {title_plain} {title_plused}
//   {year}   {year_min}   {year_max}
//   {imdbid} {nottimdbid}
const urlTemplates = [
    ['Refs', 'movieconnections', 'Connections'],
    ['Reviews', 'reviews?sort=helpfulnessScore', 'User Reviews'],
    ['FAQ', 'faq', 'FAQ'],
    ['Trivia', 'trivia', 'Trivia'],
    ['Board', 'https://www.moviechat.org/movies/{imdbid}'],
    [],
    ['iCheckMovies', 'https://www.icheckmovies.com/search/movies/?query={imdbid}'],
    ['Wikipedia', 'https://en.wikipedia.org/w/index.php?title=Special:Search&search={title}'],
    ['RYM', 'http://rateyourmusic.com/search?searchterm={title}&searchtype=F'],
    ['KinoPoisk', 'https://www.kinopoisk.ru/index.php?level=7&from=forma&result=adv&m_act[from]=forma&m_act[what]=content&m_act[find]={title_plused}&m_act[from_year]={year_min}&m_act[to_year]={year_max}'],
    [],
    ['RuTracker', 'https://rutracker.net/forum/tracker.php?nm={title_plain} {year}&o=7&s=2'],
    ['Kinozal', 'http://kinozal.tv/browse.php?s={title_plused}+{year}'],
    ['KaraGarga', 'https://karagarga.in/browse.php?incldead=&d=&sort=added&d=DESC&search={nottimdbid}&search_type=imdb'],
    ['PassThePopcorn', 'https://passthepopcorn.me/torrents.php?action=advanced&searchstr={imdbid}'],
    ['ThePirateBay', 'https://thepiratebay.org/search/{title_plain} {year}/0/5/0'],
    ['Kickass', 'https://katcr.co/new/search-torrents.php?search=%22{title}%22'],
    ['OpenSubtitles', 'https://www.opensubtitles.org/en/search2/sublanguageid-eng/subsumcd-1/imdbid-{imdbid}'],
    ['YouTube', 'https://www.youtube.com/results?search_query={title} {year}'],
    [],
    ['Reddit', 'https://www.reddit.com/r/gamerghazi+truefilm/search?q={title}&restrict_sr=on&include_over_18=on&sort=comments&t=all'],
    ['ФЭР', 'https://www.google.com/search?q=site:club443.ru %22{title}%22'],
    ['RottenTomatoes', 'https://www.rottentomatoes.com/search/?search={title_plain}'],
    ['Letterboxd', 'https://letterboxd.com/search/films/{imdbid}'],
    ['Google', 'https://www.google.com/search?q={title} {year}'],
    ['MUBI', 'https://www.google.com/search?q=site:mubi.com {title} {year}'],
    ['WhatTheMovie', 'https://whatthemovie.com/search?t=movie&q={imdbid}'],
];

// ----- Diacritics -----

// For kinopoisk, rutracker and other non-Unicode sites
// source: https://stackoverflow.com/a/18391901 - modified to remove chars covered by NFKD
const defaultDiacriticsRemovalMap = {
    A:  '\u023A\u2C6F',
    AA: '\uA732',
    AE: '\u00C6',
    AO: '\uA734',
    AU: '\uA736',
    AV: '\uA738\uA73A',
    AY: '\uA73C',
    B:  '\u0243\u0182\u0181',
    C:  '\u0187\u023B\uA73E',
    D:  '\u0110\u018B\u018A\u0189\uA779',
    E:  '\u0190\u018E',
    F:  '\u0191\uA77B',
    G:  '\u01E4\u0193\uA7A0\uA77D\uA77E',
    H:  '\u0126\u2C67\u2C75\uA78D',
    I:  '\u0197',
    J:  '\u0248',
    K:  '\u0198\u2C69\uA740\uA742\uA744\uA7A2',
    L:  '\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780',
    M:  '\u2C6E\u019C',
    N:  '\u0220\u019D\uA790\uA7A4',
    O:  '\u00D8\u0186\u019F\uA74A\uA74C',
    OI: '\u01A2',
    OO: '\uA74E',
    OU: '\u0222',
    OE: '\u008C\u0152',
    oe: '\u009C\u0153',
    P:  '\u01A4\u2C63\uA750\uA752\uA754',
    Q:  '\uA756\uA758\u024A',
    R:  '\u024C\u2C64\uA75A\uA7A6\uA782',
    S:  '\u1E9E\u2C7E\uA7A8\uA784',
    T:  '\u0166\u01AC\u01AE\u023E\uA786',
    TZ: '\uA728',
    U:  '\u0244',
    V:  '\u01B2\uA75E\u0245',
    VY: '\uA760',
    W:  '\u2C72',
    Y:  '\u01B3\u024E\u1EFE',
    Z:  '\u01B5\u0224\u2C7F\u2C6B\uA762',
    a:  '\u2C65\u0250',
    aa: '\uA733',
    ae: '\u00E6',
    ao: '\uA735',
    au: '\uA737',
    av: '\uA739\uA73B',
    ay: '\uA73D',
    b:  '\u0180\u0183\u0253',
    c:  '\u0188\u023C\uA73F\u2184',
    d:  '\u0111\u018C\u0256\u0257\uA77A',
    e:  '\u0247\u025B\u01DD',
    f:  '\u0192\uA77C',
    g:  '\u01E5\u0260\uA7A1\u1D79\uA77F',
    h:  '\u0127\u2C68\u2C76\u0265',
    hv: '\u0195',
    i:  '\u0268\u0131',
    j:  '\u0249',
    k:  '\u0199\u2C6A\uA741\uA743\uA745\uA7A3',
    l:  '\u0142\u019A\u026B\u2C61\uA749\uA781\uA747',
    m:  '\u0271\u026F',
    n:  '\u019E\u0272\uA791\uA7A5',
    o:  '\u00F8\u0254\uA74B\uA74D\u0275',
    oi: '\u01A3',
    ou: '\u0223',
    oo: '\uA74F',
    p:  '\u01A5\u1D7D\uA751\uA753\uA755',
    q:  '\u024B\uA757\uA759',
    r:  '\u024D\u027D\uA75B\uA7A7\uA783',
    s:  '\u00DF\u023F\uA7A9\uA785',
    t:  '\u0167\u01AD\u0288\u2C66\uA787',
    tz: '\uA729',
    u:  '\u0289',
    v:  '\u028B\uA75F\u028C',
    vy: '\uA761',
    w:  '\u2C73',
    y:  '\u01B4\u024F\u1EFF',
    z:  '\u01B6\u0225\u0240\u2C6C\uA763',
};

const diacriticsMap = {};
for (const [base, letters] of Object.entries(defaultDiacriticsRemovalMap)) {
    for (const letter of letters.split('')) {
        diacriticsMap[letter] = base;
    }
}

const removeDiacritics = s => s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[^\u0000-\u007E]/g, x => diacriticsMap[x] || x);

// ----- Main -----

document.head.insertAdjacentHTML('beforeend', `<style>
    #pagecontent {
        position: relative;
    }

    #dpl-linkbar {
        width: 148px;
        padding: 10px;
        text-align: right;
        position: absolute;
        top: 1px;
        left: -148px;
        background-color: #fff;
    }

    .dpl-link {
        display: block;
        margin-bottom: 2px;
    }
</style>`);

const addLinkbar = () => {
    const linkbar = document.createElement('div');
    linkbar.id = 'dpl-linkbar';

    for (const [text, urlTemplate, innerTitle] of urlTemplates) {
        let linkHTML = '';
        if (!text) {
            linkHTML = '<hr>';
        } else if (!innerTitle) {
            const url = makeUrl(urlTemplate);
            linkHTML = `<a class="dpl-link" href="${url}">${text}</a>`;
        } else if (hasInnerPage(innerTitle)) {
            linkHTML = `<a class="dpl-link" href="${urlTemplate}"><b>${text}</b></a>`;
        }

        linkbar.insertAdjacentHTML('beforeend', linkHTML);
    }

    const root = document.getElementById('pagecontent');
    root.appendChild(linkbar);
};

const makeUrl = urlTemplate => {
    const { title, year, imdbID, nottImdbID } = parseMovieInfo();
    const titlePlain = encodeURIComponent(removeDiacritics(title));
    return urlTemplate
        .replace('{title}', encodeURIComponent(title))
        .replace('{title_plain}', titlePlain)
        .replace('{title_plused}', titlePlain.replace(/%20/g, '+'))
        .replace('{year}', year)
        .replace('{year_min}', year - 2)
        .replace('{year_max}', year + 2)
        .replace('{imdbid}', imdbID)
        .replace('{nottimdbid}', nottImdbID);
};

const parseMovieInfo = () => {
    const metaTitle = document.querySelector('meta[property="og:title"]').content;
    const match = metaTitle.match(/(.+) \(.*?([\d–-]+)\s*\)/);
    if (!match) {
        throw new Error(`Can't parse title and year from the meta tag: "${metaTitle}"`);
    }

    const [, title, year] = match;
    const [imdbID] = window.location.href.match(/(tt[0-9]+)/);
    return {
        title,
        year: parseInt(year, 10),
        imdbID,
        nottImdbID: imdbID.replace('tt', ''),
    };
};

const hasInnerPage = innerPageTitle =>
    ![...document.querySelectorAll('#full_subnav .quicklink')]
        .filter(el => el.textContent === innerPageTitle)[0]
        .classList.contains('quicklinkGray');

// Extra: make the whole title clickable
const fixHeaderLink = () => {
    const header = document.querySelector('.title_wrapper h1');
    const titleNode = header.childNodes[0];
    const title = titleNode.textContent.trim();
    titleNode.textContent = ' ';
    header.insertAdjacentHTML('afterbegin', `<a href="${document.URL}">${title}</a>`);
};

addLinkbar();
fixHeaderLink();
