// ==UserScript==
// @name        IMDb - DL links in search results
// @namespace   monk-time
// @author      monk-time
// @include     https://www.imdb.com/search/title/*
// @icon        http://www.imdb.com/favicon.ico
// ==/UserScript==

'use strict';

// fix for kinopoisk, rutracker and other non-Unicode sites
// source: http://stackoverflow.com/a/18391901 - modified to remove chars covered by NFKD

const defaultDiacriticsRemovalMap = {
    A: '\u023A\u2C6F',
    AA: '\uA732',
    AE: '\u00C6',
    AO: '\uA734',
    AU: '\uA736',
    AV: '\uA738\uA73A',
    AY: '\uA73C',
    B: '\u0243\u0182\u0181',
    C: '\u0187\u023B\uA73E',
    D: '\u0110\u018B\u018A\u0189\uA779',
    E: '\u0190\u018E',
    F: '\u0191\uA77B',
    G: '\u01E4\u0193\uA7A0\uA77D\uA77E',
    H: '\u0126\u2C67\u2C75\uA78D',
    I: '\u0197',
    J: '\u0248',
    K: '\u0198\u2C69\uA740\uA742\uA744\uA7A2',
    L: '\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780',
    M: '\u2C6E\u019C',
    N: '\u0220\u019D\uA790\uA7A4',
    O: '\u00D8\u0186\u019F\uA74A\uA74C',
    OI: '\u01A2',
    OO: '\uA74E',
    OU: '\u0222',
    OE: '\u008C\u0152',
    oe: '\u009C\u0153',
    P: '\u01A4\u2C63\uA750\uA752\uA754',
    Q: '\uA756\uA758\u024A',
    R: '\u024C\u2C64\uA75A\uA7A6\uA782',
    S: '\u1E9E\u2C7E\uA7A8\uA784',
    T: '\u0166\u01AC\u01AE\u023E\uA786',
    TZ: '\uA728',
    U: '\u0244',
    V: '\u01B2\uA75E\u0245',
    VY: '\uA760',
    W: '\u2C72',
    Y: '\u01B3\u024E\u1EFE',
    Z: '\u01B5\u0224\u2C7F\u2C6B\uA762',
    a: '\u2C65\u0250',
    aa: '\uA733',
    ae: '\u00E6',
    ao: '\uA735',
    au: '\uA737',
    av: '\uA739\uA73B',
    ay: '\uA73D',
    b: '\u0180\u0183\u0253',
    c: '\u0188\u023C\uA73F\u2184',
    d: '\u0111\u018C\u0256\u0257\uA77A',
    e: '\u0247\u025B\u01DD',
    f: '\u0192\uA77C',
    g: '\u01E5\u0260\uA7A1\u1D79\uA77F',
    h: '\u0127\u2C68\u2C76\u0265',
    hv: '\u0195',
    i: '\u0268\u0131',
    j: '\u0249',
    k: '\u0199\u2C6A\uA741\uA743\uA745\uA7A3',
    l: '\u0142\u019A\u026B\u2C61\uA749\uA781\uA747',
    m: '\u0271\u026F',
    n: '\u019E\u0272\uA791\uA7A5',
    o: '\u00F8\u0254\uA74B\uA74D\u0275',
    oi: '\u01A3',
    ou: '\u0223',
    oo: '\uA74F',
    p: '\u01A5\u1D7D\uA751\uA753\uA755',
    q: '\u024B\uA757\uA759',
    r: '\u024D\u027D\uA75B\uA7A7\uA783',
    s: '\u00DF\u023F\uA7A9\uA785',
    t: '\u0167\u01AD\u0288\u2C66\uA787',
    tz: '\uA729',
    u: '\u0289',
    v: '\u028B\uA75F\u028C',
    vy: '\uA761',
    w: '\u2C73',
    y: '\u01B4\u024F\u1EFF',
    z: '\u01B6\u0225\u0240\u2C6C\uA763',
};

const diacriticsMap = {};
for (const [base, letters] of Object.entries(defaultDiacriticsRemovalMap)) {
    for (const letter of letters.split('')) {
        diacriticsMap[letter] = base;
    }
}

const removeDiacritics = s => s
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[^\u0000-\u007E]/g, a => diacriticsMap[a] || a);

// ----- MAIN -----

const resources = [
    {
        label: 'RTO',
        url: 'https://rutracker.net/forum/tracker.php?nm={titleLat} {year} -DVD5 -DVD9&o=7&s=2',
        color: '#428442',
    }, {
        label: 'KZ',
        url: 'https://kinozal.me/browse.php?s={titleLat} {year}',
        color: '#E0923F',
    }, {
        label: 'PTP',
        url: 'https://tls.passthepopcorn.me/torrents.php?action=advanced&searchstr={id}',
        color: '#3223C3',
    }, {
        label: 'KG',
        url: 'https://karagarga.in/browse.php?sort=added&d=DESC&search={nottid}&search_type=imdb',
        color: '#2364C4',
    }, {
        label: 'TPB',
        url: 'https://thepiratebay.org/s/?q={titlePlus}+{year}&category=0&page=0&orderby=5',
        color: '#03B1A5',
    }, {
        label: 'SUB',
        url: 'http://www.opensubtitles.org/en/search2/sublanguageid-eng/subsumcd-1/subformat-srt/imdbid-{id}',
        color: '#BC2020',
    },
];

const btnStyles = resources.map(({ label, color }) => `
    .userscript-${label.toLowerCase()} {
        background-color: ${color};
    }
`).join('');

document.head.insertAdjacentHTML('beforeend', `<style>
    #idll-trigger {
        background-color: #DD00AA;
    }
    .userscript-btn {
        color: #FFF;
        font-size: 12px;
        font-family: Calibri;
        padding-left: 3px;
        padding-right: 3px;
        border-radius: 3px;
        border-width: 0px;
        display: inline;
        margin-right: 4px;
        text-decoration: none;
    }
    ${btnStyles}
</style>`);

const buildFullURL = (template, dataObj) => {
    for (const key of Object.keys(dataObj)) {
        template = template.replace(new RegExp(`{${key}}`, 'g'), dataObj[key]);
    }

    return template.replace('\'', '&#39;');
};

const parseMovie = titleEl => {
    const linkEl = titleEl.querySelector('a.ipc-title-link-wrapper');
    const id = linkEl.href.match(/(tt[0-9]+)/)[0];
    const nottid = id.replace('tt', '');
    const year = titleEl.querySelector('.cli-title-metadata, .dli-title-metadata')
        .textContent.match(/\d{4}/)[0];
    const title = linkEl.textContent.match(/^\d+\. (.+)/)[1].trim();
    const titleLat = encodeURIComponent(removeDiacritics(title));
    const titlePlus = titleLat.replace(/%20/g, '+');
    return { id, nottid, year, title, titleLat, titlePlus };
};

// Add link-buttons
const createButtons = movie => resources.map(({ label, url }) =>
    `<a href='${buildFullURL(url, movie)}'
        class='userscript-btn userscript-${label.toLowerCase()}'>${label}</a>`);

const insertButtons = titleEl => {
    const buttons = createButtons(parseMovie(titleEl)).join('');
    titleEl.querySelector('.ipc-title').insertAdjacentHTML('afterbegin', buttons);
};

const movieToPlaintext = titleEl => {
    const { title, year } = parseMovie(titleEl);
    const fname = `${title} (${year})`;
    const fnameANSI = removeDiacritics(fname)
        .replace(/["*<>?|/\\]/g, '-')
        .replace(/:/g, ' -');

    return fname === fnameANSI ? fname : `${fnameANSI}\t${fname}`;
};

const main = () => {
    const titleElements = [...document.querySelectorAll('.ipc-metadata-list-summary-item')];
    titleElements.forEach(insertButtons);

    // Add utorrent-friendly torrent titles
    const textList = titleElements.map(movieToPlaintext).join('\n');
    container.insertAdjacentHTML('afterend', `<pre>${textList}</pre>`);
};

const container = document.querySelector('.ipc-page-section > .ipc-title');
container.insertAdjacentHTML('afterend', `
    <button id='idll-trigger' class='userscript-btn'>Add DL links</button>
`);
document.querySelector('#idll-trigger').addEventListener('click', main);
