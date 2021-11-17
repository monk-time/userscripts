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
/* eslint-disable prefer-destructuring */
/* eslint-disable no-await-in-loop */

'use strict';

const calculateBPperYearperGB = (torrent, coj, cojyears, mightychef, mightychefdays) => {
    if (!coj) return torrent.bpyear / (torrent.size / (1024 ** 3));

    const a = 0.25;
    const b = 0.6;
    const c = 0.6;
    const days = cojyears * 365.2422;
    const goldenMultiplier = torrent.gp ? 2 : 1;

    // bphour isn't used - it's not accurate enough, leads to quite wrong seed time

    const Q = b / (torrent.seeders ** c);
    const t = torrent.seedTimeSeconds / 86400;

    const avgBpPerYearPerGiB = (24 * (a * days + Q * ((t + 1 + days) * Math.log(t + 1 + days) - (t + 1) * Math.log(t + 1) - days)) * goldenMultiplier) / cojyears;
    if (!mightychef) return [avgBpPerYearPerGiB, t];

    const s = torrent.size / (1024 * 1024 * 1024);
    const u = torrent.seeders;
    const d = mightychefdays;
    // return 6*s*u^(-3/5)*(5*d*u^(3/5) - 12*d - 12*t*ln(t + 1) + 12*(d + t)*ln(d + t + 1) - 12*ln(t + 1) + 12*ln(d + t + 1))/5;
    return (goldenMultiplier * 6 * s * (u ** (-3 / 5)) * (5 * d * (u ** (3 / 5)) - 12 * d - 12 * t * Math.log(t + 1) + 12 * (d + t) * Math.log(d + t + 1) - 12 * Math.log(t + 1) + 12 * Math.log(d + t + 1))) / 5;
};

const calculateMightychefYears = (torrent, days) =>
    calculateBPperYearperGB(torrent, true, 1, true, days);

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

    const elMessage = elContent.querySelector('#bpoMessage');
    const elLink = elContent.querySelector('#bpoLoad');
    elLink.addEventListener('click', e => {
        e.preventDefault();
        try {
            loadData(elContent, elMessage);
        } catch (ex) {
            elMessage.innerHTML = ex.message;
        }
    });
};

const loadData = async (elContent, elMessage) => {
    const torrentData = JSON.parse(window.localStorage.bpopt);
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

    window.localStorage.bpopt = JSON.stringify(torrentData);
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
            bpyear: parseFloat(tds[9].innerHTML.replaceAll(',', '')),
            bphour: parseFloat(tds[5].innerHTML.replaceAll(',', '')),
            seedTimeSeconds: tds[4].getAttribute('data-seed-seconds'),
        };

        torrent.bpyeargb = calculateBPperYearperGB(torrent);
        const cojbpyeargb = calculateBPperYearperGB(torrent, true, torrentData.cojyears);
        torrent.mightychefyeargb = calculateMightychefYears(torrent, torrentData.mightychefdays);
        torrent.cojbpyeargb = cojbpyeargb[0];
        torrent.seedTimeDays = cojbpyeargb[1];
        torrent.hidden = false;

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
        target.bpYear += torrentData.useMightychef ? t.mightychefyeargb : t.bpyear;
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
    if (!torrentData.torrents?.length > 0) {
        window.localStorage.removeItem('bpopt');
        firstRun(elContent);
        return;
    }

    const { total, hidden, shown } = calcStats(torrentData);

    let target = torrentData.mightychefTarget;
    if (torrentData.useMightychef && target !== -1 && Math.round(total.bpYear * 100) !== target * 100 && torrentData.loops < 20) {
        const elBonus = document.querySelector('#nav_bonus a');
        const currentBP = Number(elBonus.innerHTML.match(/\d/g).join(''));
        if (currentBP < target) {
            target -= currentBP;
        }

        torrentData.mightychefdays /= total.bpYear / target;
        for (const t of torrentData.torrents) {
            t.mightychefyeargb = calculateMightychefYears(t, torrentData.mightychefdays);
        }

        torrentData.loops = torrentData.loops ? torrentData.loops + 1 : 1;
        window.localStorage.bpopt = JSON.stringify(torrentData);
        showOptimization(elContent, torrentData);
        return;
    }

    const mightychefPeriod = torrentData.mightychefdays === 1 ?
        'Day' : `${torrentData.mightychefdays} days`;
    const partPeriod = torrentData.useMightychef ? mightychefPeriod : 'Year';
    const partBP = torrentData.divisor === 2500 ? 'GB' : 'BP';
    const bpyear = `BP/${partPeriod}`;
    const bpyeargb = `${partBP}/${partPeriod}/GB`;

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
                <span>${printNumber(total.bpYear)} BP per ${getPeriod()}.</span>
            </div>
            <div id="bpoStatsHidden" style="display: ${hidden.total > 0 ? 'block' : 'none'};">
                <span>
                    ${hidden.total} torrent${hidden.total !== 1 ? 's' : ''} hidden,
                </span>
                <span>${printSize(hidden.size)} GiB total.</span>
                <span>${printNumber(hidden.bpYear)} BP per ${getPeriod()}.</span>
            </div>
            <div id="bpoStatsShown" style="display: ${hidden.total > 0 ? 'block' : 'none'};">
                <span>
                    ${shown.total} torrent${shown.total !== 1 ? 's' : ''} visible,
                </span>
                <span>${printSize(shown.size)} GiB total.</span>
                <span>${printNumber(shown.bpYear)} BP per ${getPeriod()}.</span>
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
                <input type="number" value="${torrentData.cojyears}">
                <a id="applyCojYears" href="#">Apply</a>
            </span>
            <br>
            <span class="bpoLabel">mightychef days:</span>
            <span class="bpoCont">
                <input type="number" value="${torrentData.mightychefdays}">
                <a id="applyMightychefYears" href="#">Apply</a>
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
                <input type="number" value="${torrentData.mightychefTarget}">
                <a id="applyMightychefTarget" href="#">Apply</a>
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
                    <a href="#">${bpyear}</a>
                </span><span class="bpoCell" style="width: 75px;">
                    <a href="#">${bpyeargb}</a>
                </span><span class="bpoCell" style="width: 30px;">
                    <a href="#">Hide</a>
                </span>
            </div>
        </div>
    `;
    const elRefresh = elContent.querySelector('#bpoRefresh');
    const elMessage = elContent.querySelector('#bpoMessage');
    elRefresh.addEventListener('click', e => {
        e.preventDefault();
        try {
            loadData(elContent, elMessage);
        } catch (ex) {
            elMessage.innerHTML = ex.message;
        }
    });

    elContent.querySelectorAll('#bpoLinks a, #bpoOptions > a').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            linkListeners[el.id](torrentData);
            window.localStorage.bpopt = JSON.stringify(torrentData);
            showOptimization(elContent, torrentData);
        });
    });

    elContent.querySelectorAll('.bpoCont a').forEach(el => {
        const input = el.previousElementSibling;
        el.addEventListener('click', e => {
            e.preventDefault();
            if (Number.isNaN(input.valueAsNumber)) return;
            inputListeners[el.id](torrentData, input.valueAsNumber);
            window.localStorage.bpopt = JSON.stringify(torrentData);
            showOptimization(elContent, torrentData);
        });
    });

    const elTable = elContent.querySelector('#table');

    elContent.querySelectorAll('#bpoHeader a').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            const sortBy = el.innerHTML.replace(/[/, ]/g, '');
            sortTorrents(torrentData, sortBy);
            window.localStorage.bpopt = JSON.stringify(torrentData);
            showOptimization(elContent, torrentData);
        });
    });

    for (const t of torrentData.torrents) {
        const mST = torrentData.minimumSeedTime;
        const days = t.seedTimeDays;
        const remaining = Math.round((mST - days) * 100) / 100;
        const needToSeed = (mST > 0 && days < mST) || (mST <= 0 && days > -mST);

        const bpyeargbRawValue = torrentData.useMightychef ?
            t.mightychefyeargb / (t.size / (1024 ** 3)) :
            torrentData.useCoj ? t.cojbpyeargb : t.bpyeargb;

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
                    ${printNumber(torrentData.useMightychef ? t.mightychefyeargb : t.bpyear)}
                </span><span class="bpoCell" style="width: 75px;">
                    ${printNumber(bpyeargbRawValue / torrentData.divisor)}
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
    // And also set an attribute on the document, if the script runs after this one it can check the attribute
    document.body.setAttribute('scriptFinished', true);
};

// ----- Sorting -----

const sortTorrents = (torrentData, sortBy) => {
    const sortFunc = getSortFunc(sortBy, torrentData.sortBy, torrentData.useCoj, torrentData.useMightychef, torrentData.mightychefdays);
    torrentData.sortBy = torrentData.sortBy === sortBy ? `${sortBy}r` : sortBy;
    torrentData.torrents.sort(sortFunc);
};

const getSortFunc = (sortBy, existingSortBy, useCoj, useMightychef, mightychefdays) => {
    const reverse = sortBy === existingSortBy ? -1 : 1;
    if (useCoj && sortBy.match(/^(BP|GB)YearGBr?$/)) {
        return sortFuncs.CojBPYearGB(reverse);
    }

    if (useMightychef && sortBy.match(/(BP|GB)\d.*GB/)) {
        return mightychefbpyearSort(reverse, mightychefdays);
    }

    if (useMightychef && sortBy.match(/BP\d/)) {
        return sortFuncs.BPDay(reverse);
    }

    return sortFuncs[sortBy](reverse);
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
    BPYear: makeKeySortFunc('bpyear'),
    BPDay: makeKeySortFunc('mightychefyeargb'),
    BPYearGB: makeKeySortFunc('bpyeargb'),
    GBYearGB: makeKeySortFunc('bpyeargb'),
    CojBPYearGB: makeKeySortFunc('cojbpyeargb'),
    Hide: makeKeySortFunc('hidden'),
    SeedTime: makeKeySortFunc('seedTimeDays'),
    Ratio: reverse => (a, b) => reverse * (getRatioKey(b.ratio) - getRatioKey(a.ratio)),
    Title: reverse => (a, b) => reverse * a.title.localeCompare(b.title),
};

const mightychefbpyearSort = (reverse, days) => (a, b) => {
    const getKey = x => calculateMightychefYears(x, days) / (x.size / (1024 ** 3));
    return reverse * (getKey(a) - getKey(b));
};

// ----- Event listeners (input) -----

const inputListeners = {
    applyCojYears: (torrentData, value) => {
        torrentData.cojyears = value;
        for (const torrent of torrentData.torrents) {
            torrent.cojbpyeargb = calculateBPperYearperGB(torrent, true, value)[0];
        }
    },
    applyMightychefYears: (torrentData, value) => {
        torrentData.mightychefdays = value;
        for (const torrent of torrentData.torrents) {
            torrent.mightychefyeargb = calculateMightychefYears(torrent, value);
        }
    },
    applyDivisor: (torrentData, value) => {
        torrentData.divisor = value;
    },
    applyMightychefTarget: (torrentData, value) => {
        torrentData.mightychefTarget = value;
        torrentData.loops = 0;
    },
    applyMinimumSeedTime: (torrentData, value) => {
        torrentData.minimumSeedTime = value;
    },
};

const hideTorrent = (torrent, elContent, torrentData) => {
    torrent.hidden = !torrent.hidden;
    window.localStorage.bpopt = JSON.stringify(torrentData);
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

const getPeriod = () => {
    if (!torrentData.useMightychef) return 'year';
    if (torrentData.mightychefdays === 1) return 'day';

    const hours = (torrentData.mightychefdays % 1) * 24;
    const minutes = (hours % 1) * 60;
    const seconds = Math.round((minutes % 1) * 60);
    return hours === 0 && minutes === 0 && seconds === 0 ?
        `${torrentData.mightychefdays} days` :
        `${Math.floor(torrentData.mightychefdays)} days, ${Math.floor(hours)} hours, ${Math.floor(minutes)} minutes, and ${seconds} seconds`;
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
        'id', 'link', 'title', 'gp', 'size', 'seeders', 'ratio', 'bpyear', 'bphour',
        'seedtimeseconds', 'bpyeargb', 'cojbpyeargb', 'mightychefyeargb', 'seedTimeDays',
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

// Add links to the new page on both the bonus.php and bprate.php pages
addLinks();

const torrentDataStored = window.localStorage.bpopt;
const torrentData = torrentDataStored ?
    {
        ...JSON.parse(torrentDataStored),
        firstRun: false,
        loops: 1,
    } :
    {
        firstRun: true,
        loops: 1,
        cojyears: 3,
        mightychefdays: 365,
        divisor: 1,
        mightychefTarget: -1,
        minimumSeedTime: 2,
    };

window.localStorage.bpopt = JSON.stringify(torrentData);

if (window.location.href.includes('optimization=true')) {
    document.head.insertAdjacentHTML('beforeend', `
        <style>
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

    const elContent = document.querySelector('.bpoContent');
    if (torrentData.firstRun) {
        // If our local storage value isn't set, or is empty (script reset), introduce the script
        firstRun(elContent);
    } else {
        // Otherwise show the page with cached data
        showOptimization(elContent, torrentData);
    }
}
