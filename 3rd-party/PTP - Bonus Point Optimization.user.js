// ==UserScript==
// @name         Bonus Point Optimization
// @version      1.8
// @description  Chameleon's take on the BP optimization script
// @author       Chameleon
// @include      http*://*passthepopcorn.me/bonus.php*
// @include      http*://*passthepopcorn.me/bprate.php*
// @grant        none
// ==/UserScript==

/* eslint-disable max-len */
/* eslint-disable func-style */
/* eslint-disable prefer-destructuring */

'use strict';

const calculateBPperYearperGB = (torrent, coj, cojyears, mightychef, mightychefdays) => {
    if (!coj) {
        return torrent.bpyear / (torrent.size / (1024 ** 3));
    }

    const a = 0.25;
    const b = 0.6;
    const c = 0.6;
    const constYears = cojyears;
    const effectivePeriod = constYears * 365.2422;
    let goldenMultiplier = 1.0;
    if (torrent.gp) {
        goldenMultiplier = 2.0;
    }

    // bphour isn't used - it's not accurate enough, leads to quite wrong seed time

    const Q = b / (torrent.seeders ** c);
    const t = torrent.seedTimeSeconds / 86400;

    const avgBpPerYearPerGiB = (24 * (a * effectivePeriod + Q * ((t + 1 + effectivePeriod) * Math.log(t + 1 + effectivePeriod) - (t + 1) * Math.log(t + 1) - effectivePeriod)) * goldenMultiplier) / constYears;
    if (!mightychef) {
        return [avgBpPerYearPerGiB, t];
    }

    const s = torrent.size / (1024 * 1024 * 1024);
    const u = torrent.seeders;
    const d = mightychefdays;
    // return 6*s*u^(-3/5)*(5*d*u^(3/5) - 12*d - 12*t*ln(t + 1) + 12*(d + t)*ln(d + t + 1) - 12*ln(t + 1) + 12*ln(d + t + 1))/5;
    mightychef = (goldenMultiplier * 6 * s * (u ** (-3 / 5)) * (5 * d * (u ** (3 / 5)) - 12 * d - 12 * t * Math.log(t + 1) + 12 * (d + t) * Math.log(d + t + 1) - 12 * Math.log(t + 1) + 12 * Math.log(d + t + 1))) / 5;
    return mightychef;
};

const addLinks = () => {
    const onBonusPage = window.location.href.includes('bonus.php');
    const onBPRatePage = window.location.href.includes('bprate.php');
    const onBPOPage = window.location.href.includes('optimization=true');
    const onProperPage = onBonusPage || (onBPRatePage && !onBPOPage);
    const linkbox = document.querySelector('.linkbox');
    if (!onProperPage || !linkbox) return;

    linkbox.insertAdjacentHTML('beforeend', `
        [<a class="linkbox__link" href="/bprate.php?optimization=true">Bonus point optimization</a>]
    `);
};

const firstRun = elContent => {
    elContent.insertAdjacentHTML('beforeend', `
        <div id="bpoMessage"></div>
        <p>
            Welcome to Chameleon's take on the Bonus Point Optimization script
            (anyone else is welcome to modify and share their own versions).
            <br>
            Inspired by <a href="/user.php?id=104855">Fermis</a>'s
            <a href="/forums.php?page=1&action=viewthread&threadid=26519">script</a>.
            <br>
            It gives a value (BP per GB per year) that allows the user to make an informed choice
            as to which torrents to continue seeding to maximize BP rate with limited HDD space.
            <br>
            This script saves it's data locally, allowing you to load fresh data when you choose,
            rather than on every run of the script.
            <br>
            Having the script run on it's own page also allows the data to be styled in a way
            that is (hopefully) most useful.
            <br>
            <br>
        </p>
        <a id="bpoLoad" href="javascript:void(0);">
            Load initial data for the script
        </a>
    `);

    const elMessage = elContent.querySelector('#bpoMessage');
    const elLink = elContent.querySelector('#bpoLoad');
    elLink.addEventListener('click', () => loadData(elContent, elMessage));
};

const loadData = (elContent, elMessage) => {
    const torrentDataStored = window.localStorage.bpopt;
    const torrentData = torrentDataStored ?
        JSON.parse(torrentDataStored) :
        { firstRun: true };

    torrentData.torrents = [];
    window.localStorage.bpopt = JSON.stringify(torrentData);
    elMessage.innerHTML = 'Loading first page from bprate.php';

    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = xhrFunc.bind(undefined, elContent, elMessage, xhr, parseData.bind(undefined, elContent, elMessage, 1));
    xhr.open('GET', `${window.location.origin}/bprate.php?page=1`);
    xhr.send();
};

const xhrFunc = (elContent, elMessage, xhr, func) => {
    if (xhr.readyState === 4) {
        if (xhr.status === 200) {
            func(xhr.responseText);
        } else {
            elMessage.innerHTML = 'Error loading the page';
        }
    }
};

const parseUnit = s => ['KiB', 'MiB', 'GiB', 'TiB'].findIndex(unit => s.includes(unit)) + 1 || 0;
const parseSize = size => parseFloat(size) * (1024 ** parseUnit(size));

const parseData = (elContent, elMessage, page, data) => {
    const page1 = document.createElement('div');
    page1.innerHTML = data;

    if (page1.getElementsByTagName('tbody').length < 2) {
        elMessage.innerHTML = `Error: You have no torrents in your
            <a href="/bprate.php?page=1">bprate</a> page, the script can not run.`;
        return;
    }

    const torrentData = JSON.parse(window.localStorage.bpopt);
    torrentData.torrents ??= [];

    const torrentTrs = page1.getElementsByTagName('tbody')[1].getElementsByTagName('tr');
    for (const tr of torrentTrs) {
        const tds = tr.getElementsByTagName('td');
        const torrent = {
            id: tds[0].firstElementChild.href.split('torrentid=')[1],
            link: tds[0].firstElementChild.href,
            title: tds[0].firstElementChild.innerHTML.trim(),
            gp: tds[1].innerHTML.includes('span'),
            size: parseSize(tds[2].innerHTML.replaceAll(',', '')),
            seeders: parseInt(tds[3].innerHTML.replaceAll(',', ''), 10),
            ratio: parseFloat(tds[6].innerHTML.replaceAll(',', '')),
            bpyear: parseFloat(tds[9].innerHTML.replaceAll(',', '')),
            bphour: parseFloat(tds[5].innerHTML.replaceAll(',', '')),
            seedTimeSeconds: tds[4].getAttribute('data-seed-seconds'),
        };

        torrent.bpyeargb = calculateBPperYearperGB(torrent);
        torrent.cojbpyeargb = calculateBPperYearperGB(torrent, true, torrentData.cojyears ?? 3);
        torrent.mightychefyeargb = calculateBPperYearperGB(torrent, true, 1, true, torrentData.mightychefdays);
        torrent.seedTimeDays = torrent.cojbpyeargb[1];
        torrent.cojbpyeargb = torrent.cojbpyeargb[0];
        torrent.hidden = false;

        torrentData.torrents.push(torrent);
    }

    const lastPage = page1.querySelector('.pagination__link--last');
    if (!lastPage) {
        const sortFunc = torrentData.useCoj ? cojbpyeargbSort : bpyeargbSort;
        torrentData.torrents.sort(sortFunc.bind(true));

        torrentData.sortBy = 'BPYearGBr';
        elMessage.innerHTML = page === 1 ?
            'Only one page of torrents found on bprate.php.' :
            `Finished loading ${page} pages from bprate.php.`;

        window.setTimeout(() => loadSeedingPage(elContent, elMessage, torrentData, 1), 1000);
    } else {
        // Timeout between page loads to avoid PTP's "popcorn quota"
        window.setTimeout(() => loadPage(elContent, elMessage, page + 1), 1000);
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
};

const loadPage = (elContent, elMessage, page) => {
    elMessage.innerHTML = `Loading page ${page} from bprate.php`;

    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = xhrFunc.bind(undefined, elContent, elMessage, xhr, parseData.bind(undefined, elContent, elMessage, page));
    xhr.open('GET', `${window.location.origin}/bprate.php?page=${page}`);
    xhr.send();
};

const loadSeedingPage = (elContent, elMessage, torrentData, page) => {
    elMessage.innerHTML = `Loading page ${page} from snatchlist.php`;

    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = xhrFunc.bind(undefined, elContent, elMessage, xhr, parseSeedingData.bind(undefined, elContent, elMessage, torrentData, page));
    xhr.open('GET', `${window.location.origin}/snatchlist.php?full=1&order_by=seeding&order_way=desc&page=${page}`);
    xhr.send();
};

const parseSeedingData = (elContent, elMessage, torrentData, page, data) => {
    const page1 = document.createElement('div');
    page1.innerHTML = data;

    const trs = page1.getElementsByTagName('table')[0].getElementsByTagName('tr');
    let finished = false;

    for (let i = 1; i < trs.length; i++) {
        const tds = trs[i].getElementsByTagName('td');
        if (tds[7].textContent !== 'Yes') {
            finished = true;
            break;
        }

        const id = tds[0].firstElementChild.href.split('torrentid=')[1];
        const ratio = tds[3].innerHTML;
        const seedTimeLeft = tds[8].textContent;
        for (const torrent of torrentData.torrents) {
            if (id === torrent.id) {
                torrent.ratio = ratio;
                torrent.seedTimeLeft = seedTimeLeft;
                break;
            }
        }
    }

    if (page1.getElementsByClassName('pagination__link--last').length === 0 || finished) {
        elMessage.innerHTML = `Finished loading ${page} pages from snatchlist.php.<br />Writing page.`;
        window.setTimeout(() => showOptimization(elContent, torrentData), 1000);
    } else {
        window.setTimeout(() => loadSeedingPage(elContent, elMessage, torrentData, page + 1), 1000);
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
};

// eslint-disable-next-line complexity
const showOptimization = (elContent, torrentData) => {
    if (!torrentData.torrents?.length > 0) {
        window.localStorage.removeItem('bpopt');
        firstRun(elContent);
        return;
    }

    const period = torrentData.useMightychef ?
        `${torrentData.mightychefdays} days` :
        'year';

    const mightychefPeriod = torrentData.mightychefdays === 1 ?
        'Day' : `${torrentData.mightychefdays} days`;
    const partPeriod = torrentData.useMightychef ? mightychefPeriod : 'Year';
    const partBP = torrentData.divisor === 2500 ? 'GB' : 'BP';
    const bpyear = `BP/${partPeriod}`;
    const bpyeargb = `${partBP}/${partPeriod}/GB`;

    elContent.setAttribute('style', 'text-align: center;');
    elContent.innerHTML = `
        <a id="bpoRefresh" href="javascript:void(0);">Refresh data</a>
        <br>
        <br>
        <div id="bpoMessage"></div>
        <div style="margin: auto; width: 490px;">
            <span id="bpoTotal">
                x torrents seeding, x GiB total. x BP per ${period}.
            </span>
            <div id="bpoHidden" style="display: none;">
                x torrents hidden, x GiB total. x BP per ${period}.
            </div>
            <div id="bpoShown" style="display: none;">
                x torrents visible, x GiB total. x BP per ${period}.
            </div>
        </div>
        <br>
        <div id="bpoLinks">
            <a href="javascript:void(0);">${torrentData.showHidden ? 'Hide' : 'Show'} hidden</a>
            <br>
            <a href="javascript:void(0);">Unhide all torrents</a>
            <br>
            <a href="javascript:void(0);">Invert hidden</a>
            <br>
            <a href="javascript:void(0);">Hide GP torrents</a>
            <br>
            <a href="javascript:void(0);">Hide torrents with ratio less than one</a>
            <br>
            <a href="javascript:void(0);">Hide torrents with seed time remaining</a>
            <br>
            <a href="javascript:void(0);">Hide torrents with fewer than 5 seeders</a>
            <br>
            <br>
            <a href="javascript:void(0);">Dump torrent json data</a>
            <br>
            <br>
            <a href="javascript:void(0);">${torrentData.showOptions ? 'Hide' : 'Show'} options</a>
        </div>
        <div id="bpoOptions" ${torrentData.showOptions ? '' : 'style="display: none;"'}>
            <a href="javascript:void(0);">
                ${torrentData.useCoj ? 'Using' : 'Not using'} coj's algorithm
            </a>
            <br>
            <a href="javascript:void(0);">
                ${torrentData.useMightychef ? 'Using' : 'Not using'} mightychef's algorithm
            </a>
            <br>
            <span class="bpoLabel">coj Years averaged over:</span>
            <span class="bpoCont">
                <input type="number" value="${torrentData.cojyears ?? 3}">
                <a href="javascript:void(0);">Apply</a>
            </span>
            <br>
            <span class="bpoLabel">mightychef days:</span>
            <span class="bpoCont">
                <input type="number" value="${torrentData.mightychefdays ?? 365}">
                <a href="javascript:void(0);">Apply</a>
            </span>
            <br>
            <span class="bpoLabel">BP/Year/GB divisor (2500 for GB/Year/GB):</span>
            <span class="bpoCont">
                <input type="number" value="${torrentData.divisor ?? 1}">
                <a href="javascript:void(0);">Apply</a>
            </span>
            <br>
            <span class="bpoLabel">mightychef target:</span>
            <span class="bpoCont">
                <input type="number" value="${torrentData.mightychefTarget ?? -1}">
                <a href="javascript:void(0);">Apply</a>
            </span>
            <br>
            <span class="bpoLabel">Minimum seed time (days):</span>
            <span class="bpoCont">
                <input type="number" value="${torrentData.minimumSeedTime ?? 2}">
                <a href="javascript:void(0);">Apply</a>
            </span>
        </div>
        <br>
        <br>
        <div id="table">
            <div id="bpoHeader">
                <span class="bpoCell" style="width: 25px;">
                    <a href="javascript:void(0);">GP</a>
                </span><span class="bpoCell" style="width: 523px;">
                    <a href="javascript:void(0);">Title</a>
                </span><span class="bpoCell" style="width: 65px;">
                    <a href="javascript:void(0);">Seed Time</a>
                </span><span class="bpoCell" style="width: 35px;">
                    <a href="javascript:void(0);">Ratio</a>
                </span><span class="bpoCell" style="width: 70px;">
                    <a href="javascript:void(0);">Size</a>
                </span><span class="bpoCell" style="width: 55px;">
                    <a href="javascript:void(0);">Seeders</a>
                </span><span class="bpoCell" style="width: 75px;">
                    <a href="javascript:void(0);">${bpyear}</a>
                </span><span class="bpoCell" style="width: 75px;">
                    <a href="javascript:void(0);">${bpyeargb}</a>
                </span><span class="bpoCell" style="width: 30px;">
                    <a href="javascript:void(0);">Hide</a>
                </span>
            </div>
        </div>
    `;
    const elRefresh = elContent.querySelector('#bpoRefresh');
    const elMessage = elContent.querySelector('#bpoMessage');
    elRefresh.addEventListener('click', () => loadData(elContent, elMessage));

    const elTotal = elContent.querySelector('#bpoTotal');
    const elHidden = elContent.querySelector('#bpoHidden');
    const elShown = elContent.querySelector('#bpoShown');

    const linkListeners = [
        showHidden,
        showAllTorrents,
        invertHidden,
        hideGP,
        hideRatioLessThanOne,
        hideNeedToSeed,
        hideFewSeeders,
        dumpData,
        showOptions,
    ];

    elContent.querySelectorAll('#bpoLinks a').forEach((el, i) => {
        el.addEventListener('click', () => linkListeners[i](elContent, torrentData));
    });

    elContent.querySelector('#bpoOptions a:nth-of-type(1)')
        .addEventListener('click', e => useCoj(elContent, torrentData, e.target));
    elContent.querySelector('#bpoOptions a:nth-of-type(2)')
        .addEventListener('click', e => useMightychef(elContent, torrentData, e.target));

    const inputListeners = [
        applyCojYears,
        applyMightychefYears,
        applyDivisor,
        applyMightychefTarget,
        applyMinimumSeedTime,
    ];

    elContent.querySelectorAll('.bpoCont a').forEach((el, i) => {
        const input = el.previousElementSibling;
        el.addEventListener('click', () => inputListeners[i](elContent, torrentData, input.valueAsNumber));
    });

    const elTable = elContent.querySelector('#table');

    elContent.querySelectorAll('#bpoHeader a').forEach(el => {
        el.addEventListener('click', sortTorrents.bind(el, elContent, torrentData));
    });

    const hidden = { total: 0, size: 0, bpYear: 0 };
    const shown = { total: 0, size: 0, bpYear: 0 };

    for (const t of torrentData.torrents) {
        if (torrentData.useMightychef) {
            t.mightychefyeargb = calculateMightychefYears(t, torrentData.mightychefdays);
        }

        const target = t.hidden ? hidden : shown;
        target.total++;
        target.size += t.size;
        target.bpYear += torrentData.useMightychef ? t.mightychefyeargb : t.bpyear;
    }

    const total = {
        total: torrentData.torrents.length,
        size: hidden.size + shown.size,
        bpYear: hidden.bpYear + shown.bpYear,
    };

    for (const t of torrentData.torrents) {
        const mST = Number.isNaN(torrentData.minimumSeedTime) ? 2 : torrentData.minimumSeedTime;
        const days = t.seedTimeDays;
        const remaining = Math.round((mST - days) * 100) / 100;
        let divStyle = t.hidden ?
            torrentData.showHidden ? 'opacity: 0.5;' : 'display: none;' : '';
        if ((mST > 0 && days < mST) || (mST <= 0 && days > -mST)) {
            divStyle += 'background: rgba(255, 0, 0, 0.2);';
        }

        const bpyeargbRawValue = torrentData.useMightychef ?
            t.mightychefyeargb / (t.size / (1024 ** 3)) :
            torrentData.useCoj ? t.cojbpyeargb : t.bpyeargb;

        elTable.insertAdjacentHTML('beforeend', `
            <div class="row hover" style="${divStyle}" ${mST > 0 && days < mST ? `title="Seed time remaining: ${remaining}"` : ''}>
                <span class="bpoCell" style="width: 25px;">
                    ${t.gp ? '✿' : ''}
                </span><span class="bpoCell" style="width: 523px; white-space: nowrap; text-align: left;">
                    <a href="${t.link}" title="${t.title}">${t.title}</a>
                </span><span class="bpoCell" style="width: 65px;">
                    ${printNumber(t.seedTimeDays)}
                </span><span class="bpoCell" style="width: 35px;">
                    ${t.ratio}
                </span><span class="bpoCell" style="width: 70px;">
                    ${printSize(t.size)}
                </span><span class="bpoCell" style="width: 55px;">
                    ${printNumber(t.seeders, true)}
                </span><span class="bpoCell" style="width: 75px;">
                    ${printNumber(torrentData.useMightychef ? t.mightychefyeargb : t.bpyear)}
                </span><span class="bpoCell" style="width: 75px;">
                    ${printNumber(bpyeargbRawValue / torrentData.divisor)}
                </span><span class="bpoCell" style="width: 30px;">
                    <a href="javascript:void(0);">X</a>
                </span>
            </div>
        `);

        elTable.querySelector('.row:last-child .bpoCell:last-child a')
            .addEventListener('click', () => hideTorrent(t, elContent, torrentData));
    }

    const mightychefdays = torrentData.mightychefdays;
    let target = torrentData.mightychefTarget ?? -1;

    if (torrentData.useMightychef && target !== -1 && Math.round(total.bpYear * 100) !== (target * 100) && torrentData.loops < 20) {
        const currentBP = parseInt(document.getElementById('nav_bonus').getElementsByTagName('a')[0].innerHTML.split('(')[1].split(')')[0].replace(/,/g, ''), 10);
        if (currentBP < target) {
            target -= currentBP;
        }

        torrentData.mightychefdays = mightychefdays / (total.bpYear / parseInt(target, 10));
        torrentData.loops = torrentData.loops ? torrentData.loops + 1 : 1;
        window.localStorage.bpopt = JSON.stringify(torrentData);
        showOptimization(elContent, torrentData);
        return;
    }

    const getPeriod = () => {
        if (!torrentData.useMightychef) return 'year';
        if (mightychefdays === 1) return 'day';

        const hours = (mightychefdays % 1) * 24;
        const minutes = (hours % 1) * 60;
        const seconds = Math.round((minutes % 1) * 60);
        return hours === 0 && minutes === 0 && seconds === 0 ?
            `${mightychefdays} days` :
            `${Math.floor(mightychefdays)} days, ${Math.floor(hours)} hours, ${Math.floor(minutes)} minutes, and ${seconds} seconds`;
    };

    const spanStyle1 = 'text-align: right; display: inline-block; width: 130px;';
    const spanStyle3 = 'text-align: right; display: inline-block; margin-left: 10px;';

    elTotal.innerHTML = `
        <span style="${spanStyle1}">
            ${total.total} torrent${total.total !== 1 ? 's' : ''} seeding,
        </span>
        <span style="${spanStyle1}">${printSize(total.size)} total.</span>
        <span style="${spanStyle3}">${printNumber(total.bpYear)} BP per ${getPeriod()}.</span>
    `;

    elHidden.innerHTML = `
        <span style="${spanStyle1} position: relative; right: 7px;">
            ${hidden.total} torrent${hidden.total !== 1 ? 's' : ''} hidden,
        </span>
        <span style="${spanStyle1}">${printSize(hidden.size)} GiB total.</span>
        <span style="${spanStyle3}">${printNumber(hidden.bpYear)} BP per ${getPeriod()}.</span>
    `;

    elShown.innerHTML = `
        <span style="${spanStyle1} position: relative; right: 9px;">
            ${shown.total} torrent${shown.total !== 1 ? 's' : ''} visible,
        </span>
        <span style="${spanStyle1}">${printSize(shown.size)} GiB total.</span>
        <span style="${spanStyle3}">${printNumber(shown.bpYear)} BP per ${getPeriod()}.</span>
    `;

    if (hidden.total > 0) {
        elHidden.setAttribute('style', 'display: block;');
        elShown.setAttribute('style', 'display: block;');
    }

    // Add a scriptFinished event, to trigger other scripts
    const event = new Event('scriptFinished');
    window.dispatchEvent(event);
    // And also set an attribute on the document, if the script runs after this one it can check the attribute
    document.body.setAttribute('scriptFinished', true);
};

// eslint-disable-next-line no-unused-vars
const addCSVtoLink = (a, torrentData) => {
    const fields = [
        'id', 'link', 'title', 'gp', 'size', 'seeders', 'ratio', 'bpyear', 'bphour',
        'seedtimeseconds', 'bpyeargb', 'cojbpyeargb', 'mightychefyeargb', 'seedTimeDays',
        'hidden', 'seedTimeLeft'];

    let text = '';
    for (let i = 0; i < fields.length; i++) {
        text += `"${fields[i]}"`;
        if (i !== fields.length - 1) {
            text += ',';
        } else {
            text += '\n';
        }
    }

    window.setTimeout(() => actualAddCSV(a, torrentData, 0, text, fields), 0);
};

const actualAddCSV = (a, torrentData, index, text, fields) => {
    if (!a.parentNode) {
        return;
    }

    a.innerHTML = `Generating row ${index + 1} of ${torrentData.torrents.length}`;
    for (let i = 0; i < torrentData.torrents.length; i++) {
        const t = torrentData.torrents[i];
        for (let j = 0; j < fields.length; j++) {
            const f = fields[j];
            let field = t[f];
            if (typeof field === 'undefined') {
                field = '';
            }

            field = `${field}`;
            text += `"${field.replace('"', '')}"`;
            if (j !== fields.length - 1) {
                text += ',';
            } else {
                text += '\n';
            }
        }
    }

    index++;
    if (index >= torrentData.torrents.length) {
        a.href = `data:text/csv,${text}`;
        a.innerHTML = 'Save CSV';
    } else {
        window.setTimeout(() => actualAddCSV(a, torrentData, index, text, fields), 0);
    }
};

function sortTorrents(elContent, torrentData) {
    let sortBy = this.innerHTML.replace(/[/, ]/g, '');
    const sortFunc = getSortFunc(sortBy, torrentData.sortBy, torrentData.useCoj, torrentData.useMightychef, torrentData.mightychefdays || 0);
    if (torrentData.sortBy === sortBy) {
        sortBy += 'r';
    }

    torrentData.sortBy = sortBy;
    torrentData.torrents.sort(sortFunc);
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(elContent, torrentData);
}

const getSortFunc = (sortBy, existingSortBy, coj, mightychef, mightychefdays) => {
    const reverse = sortBy === existingSortBy;
    if ((sortBy === 'BPYearGB' || sortBy === 'GBYearGB' || sortBy === 'BPYearGBr' || sortBy === 'GBYearGBr') && coj) {
        return cojbpyeargbSort.bind(reverse);
    }

    if (mightychef && sortBy.match(/BP\d/)) {
        if (sortBy.match(/BP\d.*GB/)) {
            return mightychefbpyearSort.bind(reverse, mightychefdays);
        }

        return mightychefbySort.bind(reverse);
    }

    if (mightychef && sortBy.match(/GB\d.*GB/)) {
        return mightychefbpyearSort.bind(reverse, mightychefdays);
    }

    const funcs = { GP: gpSort, Title: titleSort, Size: sizeSort, Seeders: seedersSort, BPYear: bpyearSort, BPDay: mightychefbySort, BPYearGB: bpyeargbSort, GBYearGB: bpyeargbSort, Hide: hideSort, Ratio: ratioSort, SeedTime: seedTimeSort };
    return funcs[sortBy].bind(reverse);
};

function mightychefbpyearSort(days, a, b) {
    const aVal = calculateMightychefYears(a, days) / parseFloat(a.size / (1024 ** 3));
    const bVal = calculateMightychefYears(b, days) / parseFloat(b.size / (1024 ** 3));

    let val = 0;
    if (aVal > bVal) val = 1;
    if (aVal < bVal) val = -1;
    if (this) return -val;
    return val;
}

function mightychefbySort(a, b) {
    let val = 0;
    if (a.mightychefyeargb > b.mightychefyeargb) val = 1;
    if (a.mightychefyeargb < b.mightychefyeargb) val = -1;
    if (this) return -val;
    return val;
}

function gpSort(a, b) {
    let val = 0;
    if (a.gp && !b.gp) val = -1;
    if (!a.gp && b.gp) val = 1;
    if (this) return -val;
    return val;
}

function titleSort(a, b) {
    let val = 0;
    if (a.title > b.title) val = 1;
    if (a.title < b.title) val = -1;
    if (this) return -val;
    return val;
}

function sizeSort(a, b) {
    let val = 0;
    if (a.size < b.size) val = 1;
    if (a.size > b.size) val = -1;
    if (this) return -val;
    return val;
}

function seedersSort(a, b) {
    let val = 0;
    if (a.seeders < b.seeders) val = 1;
    if (a.seeders > b.seeders) val = -1;
    if (this) return -val;
    return val;
}

function bpyearSort(a, b) {
    let val = 0;
    if (a.bpyear > b.bpyear) val = 1;
    if (a.bpyear < b.bpyear) val = -1;
    if (this) return -val;
    return val;
}

function bpyeargbSort(a, b) {
    let val = 0;
    if (a.bpyeargb > b.bpyeargb) val = 1;
    if (a.bpyeargb < b.bpyeargb) val = -1;
    if (this) return -val;
    return val;
}

function cojbpyeargbSort(a, b) {
    let val = 0;
    if (a.cojbpyeargb > b.cojbpyeargb) val = 1;
    if (a.cojbpyeargb < b.cojbpyeargb) val = -1;
    if (this) return -val;
    return val;
}

function hideSort(a, b) {
    let val = 0;
    if (a.hidden && !b.hidden) val = 1;
    if (!a.hidden && b.hidden) val = -1;
    if (this) return -val;
    return val;
}

function ratioSort(a, b) {
    let val = 0;
    let ratioA = 999999;
    let ratioB = 999999;
    if (a.ratio.length > 2) { // the ratio was successfully split, so it isn't --
        ratioA = parseFloat(a.ratio.split('>')[1].replace(/,/g, ''));
        if (Number.isNaN(ratioA)) { // ratioA is infinite
            ratioA = 9999991;
        }
    }

    if (b.ratio.length > 2) { // the ratio was successfully split, so it isn't --
        ratioB = parseFloat(b.ratio.split('>')[1].replace(/,/g, ''));
        if (Number.isNaN(ratioB)) { // ratioB is infinite
            ratioB = 9999991;
        }
    }

    if (ratioA < ratioB) val = 1;
    if (ratioA > ratioB) val = -1;
    if (this) return -val;
    return val;
}

function seedTimeSort(a, b) {
    let val = 0;
    if (a.seedTimeDays > b.seedTimeDays) val = 1;
    if (a.seedTimeDays < b.seedTimeDays) val = -1;
    if (this) return -val;
    return val;
}

const hideTorrent = (torrent, elContent, torrentData) => {
    torrent.hidden = !torrent.hidden;
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(elContent, torrentData);
};

// eslint-disable-next-line no-unused-vars
const showTorrent = (i, elContent, torrentData) => {
    torrentData.torrents[i].hidden = false;
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(elContent, torrentData);
};

const useMightychef = (elContent, torrentData, a) => {
    torrentData.useMightychef = !torrentData.useMightychef;
    a.innerHTML = `${torrentData.useMightychef ? 'Using' : 'Not using'} mightychef's algorithm`;

    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(elContent, torrentData);
};

const useCoj = (elContent, torrentData, a) => {
    torrentData.useCoj = !torrentData.useCoj;
    a.innerHTML = `${torrentData.useCoj ? 'Using' : 'Not using'} coj's algorithm`;

    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(elContent, torrentData);
};

const calculateMightychefYears = (torrent, days) =>
    calculateBPperYearperGB(torrent, true, 1, true, days);

const applyCojYears = (elContent, torrentData, value) => {
    torrentData.cojyears = value;
    for (const torrent of torrentData.torrents) {
        torrent.cojbpyeargb = calculateBPperYearperGB(torrent, true, value)[0];
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(elContent, torrentData);
};

const applyMightychefYears = (elContent, torrentData, value) => {
    torrentData.mightychefdays = value || 365;
    for (const torrent of torrentData.torrents) {
        torrent.mightychefyeargb = calculateBPperYearperGB(torrent, true, 1, true, value);
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(elContent, torrentData);
};

const applyDivisor = (elContent, torrentData, value) => {
    torrentData.divisor = value || 1;
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(elContent, torrentData);
};

const applyMightychefTarget = (elContent, torrentData, value) => {
    torrentData.mightychefTarget = value;
    torrentData.loops = 0;
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(elContent, torrentData);
};

const applyMinimumSeedTime = (elContent, torrentData, value) => {
    torrentData.minimumSeedTime = value;
    window.localStorage.bpopt = JSON.stringify(torrentData);
    if (torrentData.hideNeedToSee) {
        torrentData = rehide(torrentData);
    }

    showOptimization(elContent, torrentData);
};

const showHidden = (elContent, torrentData) => {
    torrentData.showHidden = !torrentData.showHidden;
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(elContent, torrentData);
};

const showAllTorrents = (elContent, torrentData) => {
    for (const torrent of torrentData.torrents) {
        torrent.hidden = false;
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(elContent, torrentData);
};

const invertHidden = (elContent, torrentData) => {
    for (const torrent of torrentData.torrents) {
        torrent.hidden = !torrent.hidden;
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(elContent, torrentData);
};

const hideGP = (elContent, torrentData) => {
    for (const torrent of torrentData.torrents) {
        if (torrent.gp) {
            torrent.hidden = true;
        }
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(elContent, torrentData);
};

const hideRatioLessThanOne = (elContent, torrentData) => {
    for (const torrent of torrentData.torrents) {
        try {
            if (parseFloat(torrent.ratio.split('>')[1]) < 1.0) {
                torrent.hidden = true;
            }
        } catch (e) {
            console.log(`BPO: torrent.ratio is something funny: ${torrent.ratio}`);
        }
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(elContent, torrentData);
};

const hideNeedToSeed = (elContent, torrentData) => {
    for (const torrent of torrentData.torrents) {
        const mST = torrentData.minimumSeedTime;
        const days = torrent.seedTimeDays;
        if ((mST > 0 && days < mST) || (mST <= 0 && days > -mST)) {
            torrent.hidden = true;
        }
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(elContent, torrentData);
};

const hideFewSeeders = (elContent, torrentData) => {
    for (const torrent of torrentData.torrents) {
        if (torrent.seeders <= 5) {
            torrent.hidden = true;
        }
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(elContent, torrentData);
};

const dumpData = (elContent, torrentData) => {
    document.body.innerHTML = JSON.stringify(torrentData.torrents);
};

const showOptions = (elContent, torrentData) => {
    torrentData.showOptions = !torrentData.showOptions;
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(elContent, torrentData);
};

const printNumber = (number, unfixed) => {
    const numberStr = unfixed ? number.toString() : number.toFixed(2);
    return numberStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const printSize = size => {
    let size1 = size / 1024;
    if (size1 < 0.5) {
        return `${printNumber(size)} bytes`;
    }

    size = size1 / 1024;
    if (size < 0.5) {
        return `${printNumber(size1)} KiB`;
    }

    size1 = size / 1024;
    if (size1 < 0.5) {
        return `${printNumber(size)} MiB`;
    }

    size = size1 / 1024;
    if (size < 0.5) {
        return `${printNumber(size1)} GiB`;
    }

    size1 = size / 1024;
    if (size1 < 0.5) {
        return `${printNumber(size)} TiB`;
    }

    size = size1 / 1024;
    if (size < 0.5) {
        return `${printNumber(size1)} PiB`;
    }
};

// ----- MAIN -----

// Add links to the new page on both the bonus.php and bprate.php pages
addLinks();

const torrentDataStored = window.localStorage.bpopt;
const torrentData = torrentDataStored ?
    {
        ...JSON.parse(torrentDataStored),
        loops: 1,
        firstRun: false,
    } :
    {
        firstRun: true,
    };

window.localStorage.bpopt = JSON.stringify(torrentData);

if (window.location.href.includes('optimization=true')) {
    document.head.insertAdjacentHTML('beforeend', `
        <style>
            .hover:hover          { background: rgba(255, 255, 255, 0.2); }
            #bpoOptions span      { width: 300px; display: inline-block; }
            #bpoOptions .bpoLabel { text-align: right; margin-right: 5px; }
            #bpoOptions .bpoCont  { text-align: left; }
            #bpoOptions input     { width: 60px; text-align: center; }
            .bpoCell              { display: inline-block; text-align: center; overflow: hidden; }
            #bpoHeader .bpoCell   { background: rgba(0, 0, 0, 0.2); }
        </style>
    `);
    // Alamak asked us not to use our own page, as 404 errors are logged.
    // Wipe the bprate page and recreate the template of the 404 page if our variable is set
    document.title = 'Bonus point optimization :: PassThePopcorn';
    document.getElementById('content').innerHTML = `
        <div class="thin">
            <h2 class="page__title">
                <a href="/bprate.php">BP rates</a> > Bonus point optimization
            </h2>
            <div class="panel bpoContent"></div>
        </div>
    `;

    const data = JSON.parse(window.localStorage.bpopt);
    const elContent = document.querySelector('.bpoContent');
    if (data.firstRun) {
        // If our local storage value isn't set, or is empty (script reset), introduce the script
        firstRun(elContent);
    } else {
        // Otherwise show the page with cached data
        showOptimization(elContent, data, '');
    }
}
