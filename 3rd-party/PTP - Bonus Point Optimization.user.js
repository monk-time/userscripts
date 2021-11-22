// ==UserScript==
// @name         Bonus Point Optimization
// @version      2
// @description  Chameleon's take on the BP optimization script
// @author       Chameleon
// @include      http*://*passthepopcorn.me/bonus.php*
// @include      http*://*passthepopcorn.me/bprate.php*
// @grant        none
// ==/UserScript==

/* eslint-disable no-await-in-loop */

'use strict';

const calculateBPYearGB = ({ bpYear, size }) => bpYear / (size / (1024 ** 3));
const calculateBPYearGBCoj = (torrent, cojYears) =>
    commonFormula(torrent, 365.2422 * cojYears, 1 / cojYears);
const calculateBPDaysGBMightychef = (torrent, mightychefDays) =>
    commonFormula(torrent, mightychefDays, 1);

const commonFormula = ({ gp, seedTimeDays: t, seeders }, d, algQ) => {
    const s = 2.4 * (seeders ** -0.6);
    const p = (d + t + 1) * Math.log(d + t + 1) - (t + 1) * Math.log(t + 1) - d;
    return (gp ? 2 : 1) * 6 * (d + s * p) * algQ;
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
        <a id="bpoLoad" href="#">
            Load initial data for the script
        </a>
    `);

    const elLink = elContent.querySelector('#bpoLoad');
    elLink.addEventListener('click', loadDataListener(elContent));
};

const loadDataListener = elContent => e => {
    e.preventDefault();
    const elMessage = elContent.querySelector('#bpoMessage');
    try {
        loadData(elContent, elMessage);
    } catch (ex) {
        elMessage.innerHTML = ex.message;
    }
};

const loadData = async (elContent, elMessage) => {
    const torrentData = JSON.parse(window.localStorage.bpopt2);
    torrentData.torrents = [];

    let bpRatePagesTotal;
    let bpRatePageNum = 1;
    do {
        const elPage = await fetchBPRatePage(bpRatePageNum, elMessage);
        bpRatePageNum++;
        parseBPRatePage(elPage, torrentData);
        await sleep(1000); // delay to avoid PTP's "popcorn quota"

        if (bpRatePagesTotal) continue;
        const elLastPage = elPage.querySelector('.pagination__link--last');
        bpRatePagesTotal = Number(elLastPage?.href.match(/page=(\d+)/)?.[1] ?? '1');
        if (!bpRatePagesTotal) throw new Error('Unexpected number of pages on bprate.php');
    } while (bpRatePageNum <= bpRatePagesTotal);

    const sortFunc = torrentData.useCoj ? sortFuncs.CojBPYearGB : sortFuncs.BPYearGB;
    torrentData.torrents.sort(sortFunc(-1));
    torrentData.sortBy = 'BPYearGBr';

    let snatchlistPagesTotal;
    let snatchlistPageNum = 1;
    do {
        const elPage = await fetchSnatchlistPage(snatchlistPageNum, elMessage);
        snatchlistPageNum++;
        parseSnatchlistPage(elPage, torrentData);
        await sleep(1000);

        // Stop early after fetching all seeded torrents
        if (elPage.querySelector('.snatchlist-status--not-seeding')) break;

        if (snatchlistPagesTotal) continue;
        const elLastPage = elPage.querySelector('.pagination__link--last');
        snatchlistPagesTotal = Number(elLastPage?.href.match(/page=(\d+)/)?.[1] ?? '1');
        if (!snatchlistPagesTotal) throw new Error('Unexpected number of pages on snatchlist.php');
    } while (snatchlistPageNum <= snatchlistPagesTotal);

    window.localStorage.bpopt2 = JSON.stringify(torrentData);
    showOptimization(elContent, torrentData);
};

const fetchPage = urlPart => async (pageNum, elMessage) => {
    elMessage.innerHTML = `Loading page ${pageNum} from ${urlPart.split('?')[0]}`;
    const url = `${window.location.origin}/${urlPart}page=${pageNum}`;
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) throw new Error('Error loading the page');
    return parseHTML(await r.text());
};

const fetchBPRatePage = fetchPage('bprate.php?');
const fetchSnatchlistPage = fetchPage('snatchlist.php?full=1&order_by=seeding&order_way=desc&');

const parseBPRatePage = (elPage, torrentData) => {
    const elTable = elPage.querySelector('table:nth-of-type(2) tbody');
    if (!elTable) {
        throw new Error(`You have no torrents on your
            <a href="/bprate.php?page=1">bprate</a> page, the script cannot run.`);
    }

    for (const tr of elTable.children) {
        const tds = tr.getElementsByTagName('td');
        const torrent = {
            id: tds[0].firstElementChild.href.split('torrentid=')[1],
            link: tds[0].firstElementChild.href,
            title: tds[0].firstElementChild.innerHTML.trim(),
            gp: tds[1].innerHTML.includes('span'),
            size: parseSize(tds[2].innerHTML.replaceAll(',', '')),
            seeders: parseInt(tds[3].innerHTML.replaceAll(',', ''), 10),
            ratio: parseFloat(tds[6].innerHTML.replaceAll(',', '')),
            bpYear: parseFloat(tds[9].innerHTML.replaceAll(',', '')),
            bpHour: parseFloat(tds[5].innerHTML.replaceAll(',', '')),
            seedTimeSeconds: tds[4].getAttribute('data-seed-seconds'),
            hidden: false,
        };

        torrent.seedTimeDays = torrent.seedTimeSeconds / (60 * 60 * 24);
        torrent.bpYearGB = calculateBPYearGB(torrent);
        torrent.bpYearGBCoj = calculateBPYearGBCoj(torrent, torrentData.cojYears);
        torrent.bpDaysGBMightychef =
            calculateBPDaysGBMightychef(torrent, torrentData.mightychefDays);

        torrentData.torrents.push(torrent);
    }
};

const parseSnatchlistPage = (elPage, torrentData) => {
    const trs = [...elPage.querySelectorAll('#SnatchData table tbody tr')];
    const torrents = trs.map(tr => ({
        id: tr.children[0].firstElementChild.href.split('torrentid=')[1],
        ratio: tr.children[3].innerHTML,
        seeding: tr.children[7].textContent === 'Yes',
        seedTimeLeft: tr.children[8].textContent,
    })).filter(({ seeding }) => seeding);

    for (const tParsed of torrents) {
        const tStored = torrentData.torrents.find(({ id }) => id === tParsed.id);
        if (!tStored) continue;
        tStored.ratio = tParsed.ratio;
        tStored.seedTimeLeft = tParsed.seedTimeLeft;
    }
};

// -----

const calcStats = torrentData => {
    const hidden = { total: 0, size: 0, bpYear: 0 };
    const shown = { total: 0, size: 0, bpYear: 0 };

    for (const t of torrentData.torrents) {
        const target = t.hidden ? hidden : shown;
        target.total++;
        target.size += t.size;
        target.bpYear += torrentData.useMightychef ? t.bpDaysGBMightychef : t.bpYear;
    }

    const total = {
        total: torrentData.torrents.length,
        size: hidden.size + shown.size,
        bpYear: hidden.bpYear + shown.bpYear,
    };

    return { total, hidden, shown };
};

// eslint-disable-next-line complexity
const showOptimization = (elContent, torrentData) => {
    const { total, hidden, shown } = calcStats(torrentData);

    const targetBP = torrentData.mightychefTargetBP;
    const reachedTarget = Math.round(total.bpYear * 100) === targetBP * 100;
    if (torrentData.useMightychef && targetBP !== -1 && !reachedTarget && torrentData.loops < 20) {
        console.log(`in the weird loop; loops=${torrentData.loops}`);
        const elBonus = document.querySelector('#nav_bonus a');
        const currentBP = Number(elBonus.innerHTML.match(/\d/g).join(''));
        const targetBP2 = targetBP > currentBP ? targetBP - currentBP : targetBP;

        torrentData.mightychefDays /= total.bpYear / targetBP2;
        for (const t of torrentData.torrents) {
            t.bpDaysGBMightychef = calculateBPDaysGBMightychef(t, torrentData.mightychefDays);
        }

        torrentData.loops = torrentData.loops ? torrentData.loops + 1 : 1;
        window.localStorage.bpopt2 = JSON.stringify(torrentData);
        showOptimization(elContent, torrentData);
        return;
    }

    const mightychefPeriod = torrentData.mightychefDays === 1 ?
        'Day' : `${printNumber(torrentData.mightychefDays, true)} days`;
    const partPeriod = torrentData.useMightychef ? mightychefPeriod : 'Year';

    elContent.setAttribute('style', 'text-align: center;');
    elContent.innerHTML = `
        <a id="bpoRefresh" href="#">Refresh data</a>
        <br>
        <br>
        <div id="bpoMessage"></div>
        <div id="bpoStats">
            <div id="bpoStatsTotal">
                <span>
                    ${total.total} torrent${total.total !== 1 ? 's' : ''} seeding,
                </span>
                <span>${printSize(total.size)} total.</span>
                <span>${printNumber(total.bpYear)} BP per ${getPeriod(torrentData)}.</span>
            </div>
            <div id="bpoStatsHidden" style="display: ${hidden.total > 0 ? 'block' : 'none'};">
                <span>
                    ${hidden.total} torrent${hidden.total !== 1 ? 's' : ''} hidden,
                </span>
                <span>${printSize(hidden.size)} GiB total.</span>
                <span>${printNumber(hidden.bpYear)} BP per ${getPeriod(torrentData)}.</span>
            </div>
            <div id="bpoStatsShown" style="display: ${hidden.total > 0 ? 'block' : 'none'};">
                <span>
                    ${shown.total} torrent${shown.total !== 1 ? 's' : ''} visible,
                </span>
                <span>${printSize(shown.size)} GiB total.</span>
                <span>${printNumber(shown.bpYear)} BP per ${getPeriod(torrentData)}.</span>
            </div>
        </div>
        <br>
        <div id="bpoLinks">
            <a id="toggleShowHidden" href="#">${torrentData.showHidden ? 'Hide' : 'Show'} hidden</a>
            <br>
            <a id="showAllTorrents" href="#">Unhide all torrents</a>
            <br>
            <a id="toggleHidden" href="#">Invert hidden</a>
            <br>
            <a id="hideGP" href="#">Hide GP torrents</a>
            <br>
            <a id="hideRatioLessThanOne" href="#">Hide torrents with ratio less than one</a>
            <br>
            <a id="hideNeedToSeed" href="#">Hide torrents with seed time remaining</a>
            <br>
            <a id="hideFewSeeders" href="#">Hide torrents with fewer than 5 seeders</a>
            <br>
            <br>
            <a id="dumpData" href="#">Dump torrent json data</a>
            <br>
            <br>
            <a id="toggleOptions" href="#">${torrentData.showOptions ? 'Hide' : 'Show'} options</a>
        </div>
        <div id="bpoOptions" ${torrentData.showOptions ? '' : 'style="display: none;"'}>
            <a id="toggleCoj" href="#">
                ${torrentData.useCoj ? 'Using' : 'Not using'} coj's algorithm
            </a>
            <br>
            <a id="toggleMightychef" href="#">
                ${torrentData.useMightychef ? 'Using' : 'Not using'} mightychef's algorithm
            </a>
            <br>
            <span class="bpoLabel">coj Years averaged over:</span>
            <span class="bpoCont">
                <input type="number" value="${torrentData.cojYears}">
                <a id="applyCojYears" href="#">Apply</a>
            </span>
            <br>
            <span class="bpoLabel">mightychef days:</span>
            <span class="bpoCont">
                <input type="number" value="${torrentData.mightychefDays}">
                <a id="applyMightychefDays" href="#">Apply</a>
            </span>
            <br>
            <span class="bpoLabel">BP/Year/GB divisor (2500 for GB/Year/GB):</span>
            <span class="bpoCont">
                <input type="number" value="${torrentData.divisor}">
                <a id="applyDivisor" href="#">Apply</a>
            </span>
            <br>
            <span class="bpoLabel">mightychef target:</span>
            <span class="bpoCont">
                <input type="number" value="${torrentData.mightychefTargetBP}">
                <a id="applyMightychefTargetBP" href="#">Apply</a>
            </span>
            <br>
            <span class="bpoLabel">Minimum seed time (days):</span>
            <span class="bpoCont">
                <input type="number" value="${torrentData.minimumSeedTime}">
                <a id="applyMinimumSeedTime" href="#">Apply</a>
            </span>
        </div>
        <br>
        <br>
        <div id="table" ${torrentData.showHidden ? 'class="bpoShowHidden"' : ''}>
            <div id="bpoHeader">
                <span class="bpoCell" style="width: 25px;">
                    <a href="#">GP</a>
                </span><span class="bpoCell" style="width: 523px;">
                    <a href="#">Title</a>
                </span><span class="bpoCell" style="width: 65px;">
                    <a href="#">Seed Time</a>
                </span><span class="bpoCell" style="width: 35px;">
                    <a href="#">Ratio</a>
                </span><span class="bpoCell" style="width: 70px;">
                    <a href="#">Size</a>
                </span><span class="bpoCell" style="width: 55px;">
                    <a href="#">Seeders</a>
                </span><span class="bpoCell" style="width: 75px;">
                    <a href="#">BP/${partPeriod}</a>
                </span><span class="bpoCell" style="width: 77px;">
                    <a href="#">${torrentData.divisor === 2500 ? 'GB' : 'BP'}/${partPeriod}/GB</a>
                </span><span class="bpoCell" style="width: 30px;">
                    <a href="#">Hide</a>
                </span>
            </div>
        </div>
    `;
    const elRefresh = elContent.querySelector('#bpoRefresh');
    elRefresh.addEventListener('click', loadDataListener(elContent));

    elContent.querySelectorAll('#bpoLinks a, #bpoOptions > a').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            linkListeners[el.id](torrentData);
            window.localStorage.bpopt2 = JSON.stringify(torrentData);
            showOptimization(elContent, torrentData);
        });
    });

    elContent.querySelectorAll('.bpoCont a').forEach(el => {
        const input = el.previousElementSibling;
        el.addEventListener('click', e => {
            e.preventDefault();
            if (Number.isNaN(input.valueAsNumber)) return;
            inputListeners[el.id](torrentData, input.valueAsNumber);
            window.localStorage.bpopt2 = JSON.stringify(torrentData);
            showOptimization(elContent, torrentData);
        });
    });

    const elTable = elContent.querySelector('#table');

    elContent.querySelectorAll('#bpoHeader a').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            const sortBy = el.innerHTML.replace(/[/, ]/g, '');
            sortTorrents(torrentData, sortBy);
            window.localStorage.bpopt2 = JSON.stringify(torrentData);
            showOptimization(elContent, torrentData);
        });
    });

    for (const t of torrentData.torrents) {
        const mST = torrentData.minimumSeedTime;
        const days = t.seedTimeDays;
        const remaining = Math.round((mST - days) * 100) / 100;
        const needToSeed = (mST > 0 && days < mST) || (mST <= 0 && days > -mST);

        const bpPeriodRawValue = torrentData.useMightychef ?
            t.bpDaysGBMightychef * (t.size / (1024 ** 3)) : t.bpYear;
        const bpPeriodGBRawValue = torrentData.useMightychef ?
            t.bpDaysGBMightychef :
            torrentData.useCoj ? t.bpYearGBCoj : t.bpYearGB;

        elTable.insertAdjacentHTML('beforeend', `
            <div class="bpoRow bpoHover ${t.hidden ? 'bpoHidden' : ''} ${needToSeed ? 'bpoNeedToSeed' : ''}" ${mST > 0 && days < mST ? `title="Seed time remaining: ${remaining}"` : ''}>
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
                    ${printNumber(bpPeriodRawValue)}
                </span><span class="bpoCell" style="width: 75px;">
                    ${printNumber(bpPeriodGBRawValue / torrentData.divisor)}
                </span><span class="bpoCell" style="width: 30px;">
                    <a href="javascript:void(0);">X</a>
                </span>
            </div>
        `);

        elTable.querySelector('.bpoRow:last-child .bpoCell:last-child a')
            .addEventListener('click', () => hideTorrent(t, elContent, torrentData));
    }

    // Add a scriptFinished event, to trigger other scripts
    const event = new Event('scriptFinished');
    window.dispatchEvent(event);
    // And also set an attribute for other scripts running after this one
    document.body.setAttribute('scriptFinished', true);
};

// ----- Sorting -----

const sortTorrents = (torrentData, sortBy) => {
    const sortFunc = getSortFunc(sortBy, torrentData);
    torrentData.sortBy = torrentData.sortBy === sortBy ? `${sortBy}r` : sortBy;
    torrentData.torrents.sort(sortFunc);
};

const getSortFunc = (newSortBy, { sortBy, useCoj, useMightychef }) => {
    const reverse = newSortBy === sortBy ? -1 : 1;
    if (useCoj && newSortBy.match(/^(BP|GB)YearGBr?$/)) {
        return sortFuncs.CojBPYearGB(reverse);
    }

    if (useMightychef && newSortBy.match(/(BP|GB)\d.*GB/)) {
        return sortFuncs.MightychefBPDaysGB(reverse);
    }

    if (useMightychef && newSortBy.match(/BP\d/)) {
        return mightychefBPDaysSort(reverse);
    }

    return sortFuncs[newSortBy](reverse);
};

const makeKeySortFunc = (key, initialDirection = 1) => reverse => (a, b) =>
    initialDirection * reverse * (a[key] - b[key]);

const getRatioKey = ratio => {
    if (ratio.length <= 2) return 999999;
    // the ratio was successfully split, so it isn't --
    const ratioKey = parseFloat(ratio.split('>')[1].replace(/,/g, ''));
    return Number.isNaN(ratioKey) ? 9999991 : ratioKey;
};

const sortFuncs = {
    GP: makeKeySortFunc('gp', -1),
    Size: makeKeySortFunc('size', -1),
    Seeders: makeKeySortFunc('seeders', -1),
    BPYear: makeKeySortFunc('bpYear'),
    BPYearGB: makeKeySortFunc('bpYearGB'),
    GBYearGB: makeKeySortFunc('bpYearGB'),
    MightychefBPDaysGB: makeKeySortFunc('bpDaysGBMightychef'),
    CojBPYearGB: makeKeySortFunc('bpYearGBCoj'),
    Hide: makeKeySortFunc('hidden'),
    SeedTime: makeKeySortFunc('seedTimeDays'),
    Ratio: reverse => (a, b) => reverse * (getRatioKey(b.ratio) - getRatioKey(a.ratio)),
    Title: reverse => (a, b) => reverse * a.title.localeCompare(b.title),
};

const mightychefBPDaysSort = reverse => (a, b) => {
    const getKey = x => x.bpDaysGBMightychef * (x.size / (1024 ** 3));
    return reverse * (getKey(a) - getKey(b));
};

// ----- Event listeners (input) -----

const inputListeners = {
    applyCojYears: (torrentData, value) => {
        torrentData.cojYears = value;
        for (const torrent of torrentData.torrents) {
            torrent.bpYearGBCoj = calculateBPYearGBCoj(torrent, value);
        }
    },
    applyMightychefDays: (torrentData, value) => {
        torrentData.mightychefDays = value;
        for (const torrent of torrentData.torrents) {
            torrent.bpDaysGBMightychef = calculateBPDaysGBMightychef(torrent, value);
        }
    },
    applyDivisor: (torrentData, value) => {
        torrentData.divisor = value;
    },
    applyMightychefTargetBP: (torrentData, value) => {
        torrentData.mightychefTargetBP = value;
        torrentData.loops = 0;
    },
    applyMinimumSeedTime: (torrentData, value) => {
        torrentData.minimumSeedTime = value;
    },
};

const hideTorrent = (torrent, elContent, torrentData) => {
    torrent.hidden = !torrent.hidden;
    window.localStorage.bpopt2 = JSON.stringify(torrentData);
    showOptimization(elContent, torrentData);
};

// ----- Event listeners (links) -----

const linkListeners = {
    toggleShowHidden: torrentData => {
        torrentData.showHidden = !torrentData.showHidden;
    },
    showAllTorrents: torrentData => {
        for (const torrent of torrentData.torrents) {
            torrent.hidden = false;
        }
    },
    toggleHidden: torrentData => {
        for (const torrent of torrentData.torrents) {
            torrent.hidden = !torrent.hidden;
        }
    },
    hideGP: torrentData => {
        for (const torrent of torrentData.torrents) {
            if (torrent.gp) {
                torrent.hidden = true;
            }
        }
    },
    hideRatioLessThanOne: torrentData => {
        for (const torrent of torrentData.torrents) {
            try {
                if (parseFloat(torrent.ratio.split('>')[1]) < 1.0) {
                    torrent.hidden = true;
                }
            } catch (e) {
                console.log(`BPO: torrent.ratio is something funny: ${torrent.ratio}`);
            }
        }
    },
    hideNeedToSeed: torrentData => {
        for (const torrent of torrentData.torrents) {
            const mST = torrentData.minimumSeedTime;
            const days = torrent.seedTimeDays;
            if ((mST > 0 && days < mST) || (mST <= 0 && days > -mST)) {
                torrent.hidden = true;
            }
        }
    },
    hideFewSeeders: torrentData => {
        for (const torrent of torrentData.torrents) {
            if (torrent.seeders <= 5) {
                torrent.hidden = true;
            }
        }
    },
    dumpData: torrentData => {
        document.body.innerHTML = JSON.stringify(torrentData.torrents);
    },
    toggleOptions: torrentData => {
        torrentData.showOptions = !torrentData.showOptions;
    },
    toggleCoj: torrentData => {
        torrentData.useCoj = !torrentData.useCoj;
    },
    toggleMightychef: torrentData => {
        torrentData.useMightychef = !torrentData.useMightychef;
    },
};

// ----- Helpers -----

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const parseHTML = html => new DOMParser().parseFromString(html, 'text/html');

const getPeriod = torrentData => {
    if (!torrentData.useMightychef) return 'year';
    if (torrentData.mightychefDays === 1) return 'day';

    const hours = (torrentData.mightychefDays % 1) * 24;
    const minutes = (hours % 1) * 60;
    const seconds = Math.round((minutes % 1) * 60);
    return hours === 0 && minutes === 0 && seconds === 0 ?
        `${torrentData.mightychefDays} days` :
        `${Math.floor(torrentData.mightychefDays)} days, ${Math.floor(hours)} hours, ${Math.floor(minutes)} minutes, and ${seconds} seconds`;
};

const printNumber = (number, asInteger) => number.toLocaleString('en-US', {
    minimumFractionDigits: asInteger ? 0 : 2,
    maximumFractionDigits: asInteger ? 0 : 2,
});

const units = [' B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']; // the space is needed to match bytes
const parseSize = size => parseFloat(size) * (1024 ** parseUnit(size));
const parseUnit = s => {
    const i = units.findIndex(unit => s.includes(unit));
    return i !== -1 ? i : 0;
};

const printSize = size => {
    const i = size > 0 ? Math.floor(Math.log(size) / Math.log(1024)) : 0;
    return `${printNumber(size / (1024 ** i))} ${units[i].trim()}`;
};

// eslint-disable-next-line no-unused-vars
const addCSVtoLink = (a, torrentData) => {
    if (!a.parentNode) return;
    a.innerHTML = `Generating ${torrentData.torrents.length} rows`;

    const fields = [
        'id', 'link', 'title', 'gp', 'size', 'seeders', 'ratio', 'bpYear', 'bpHour',
        'seedtimeseconds', 'bpYearGB', 'bpYearGBCoj', 'bpDaysGBMightychef', 'seedTimeDays',
        'hidden', 'seedTimeLeft',
    ];
    let text = `${fields.map(f => `"${f}"`).join(',')}\n`;
    text += torrentData.torrents
        .map(t => fields.map(f => `"${(t[f] ?? '').replaceAll('"', '')}"`).join(','))
        .join('\n');

    a.href = `data:text/csv,${text}`;
    a.innerHTML = 'Save CSV';
};

// ----- MAIN -----

const css = `
    .bpoHover:hover       { background: rgba(255, 255, 255, 0.2); }
    #bpoStats             { width: 490px; margin: auto; }
    #bpoStats span        { text-align: right; display: inline-block; }
    #bpoStats span:not(:last-child)  { width: 130px; }
    #bpoStats span:last-child        { margin-left: 10px; }
    #bpoStatsHidden span:first-child { position: relative; right: 7px; }
    #bpoStatsShown  span:first-child { position: relative; right: 9px; }
    #bpoOptions span      { width: 300px; display: inline-block; }
    #bpoOptions .bpoLabel { text-align: right; margin-right: 5px; }
    #bpoOptions .bpoCont  { text-align: left; }
    #bpoOptions input     { width: 60px; text-align: center; }
    .bpoCell              { display: inline-block; text-align: center; overflow: hidden; }
    #bpoHeader .bpoCell   { background: rgba(0, 0, 0, 0.2); }
    .bpoNeedToSeed        { background: rgba(255, 0, 0, 0.2); }
    #table.bpoShowHidden       .bpoHidden { opacity: 0.5; }
    #table:not(.bpoShowHidden) .bpoHidden { display: none; }
`;

const main = () => {
    // Add links to the new page on both the bonus.php and bprate.php pages
    addLinks();

    const torrentDataStored = window.localStorage.bpopt2;
    const torrentData = torrentDataStored ?
        {
            ...JSON.parse(torrentDataStored),
            firstRun: false,
            loops: 1,
        } :
        {
            firstRun: true,
            loops: 1,
            cojYears: 3,
            mightychefDays: 365,
            divisor: 1,
            mightychefTargetBP: -1,
            minimumSeedTime: 2,
        };

    window.localStorage.bpopt2 = JSON.stringify(torrentData);

    if (!window.location.href.includes('optimization=true')) return;

    document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
    // Alamak asked us not to use our own page, as 404 errors are logged.
    // Wipe the bprate page and recreate the template of the 404 page if our variable is set
    document.title = 'Bonus point optimization :: PassThePopcorn';
    document.querySelector('#content').innerHTML = `
        <div class="thin">
            <h2 class="page__title">
                <a href="/bprate.php">BP rates</a> > Bonus point optimization
            </h2>
            <div class="panel bpoContent"></div>
        </div>
    `;

    const elContent = document.querySelector('.bpoContent');
    if (torrentData.firstRun) {
        firstRun(elContent);
    } else {
        showOptimization(elContent, torrentData);
    }
};

main();
