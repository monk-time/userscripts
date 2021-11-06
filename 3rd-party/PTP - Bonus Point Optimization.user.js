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
/* eslint-disable no-script-url */
/* eslint-disable func-style */

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

    // var bpPerHour = torrent.bpyear/8765.81;
    let bpPerHour = (torrent.bpyear / 8765.81) / (8765.81 / 5358);
    if (false) { // (torrent.bphour)
        // apparently that's why bphour isn't used -
        // it's not accurate enough, leads to quite wrong seed time
        bpPerHour = torrent.bphour;
    }

    const Q = b / (torrent.seeders ** c);
    // var t = Math.exp((bpPerHour/((torrent.size/(1024 ** 3))*goldenMultiplier) - a) / Q) - 1.0; // seed time in days
    const t = torrent.seedTimeSeconds / 86400; // We now have access to the raw seed time in seconds

    const AvgBpPerYearPerGiB = (24.0 * (a * effectivePeriod + Q * ((t + 1.0 + effectivePeriod) * Math.log(t + 1.0 + effectivePeriod) - (t + 1.0) * Math.log(t + 1.0) - effectivePeriod)) * goldenMultiplier) / constYears;
    if (!mightychef) {
        return [AvgBpPerYearPerGiB, t];
    }

    const s = torrent.size / (1024 * 1024 * 1024);
    const u = torrent.seeders;
    const d = parseFloat(mightychefdays);
    // return 6*s*u^(-3/5)*(5*d*u^(3/5) - 12*d - 12*t*ln(t + 1) + 12*(d + t)*ln(d + t + 1) - 12*ln(t + 1) + 12*ln(d + t + 1))/5;
    mightychef = goldenMultiplier * 6 * s * (u ** (-3 / 5)) * (5 * d * (u ** (3 / 5)) - 12 * d - 12 * t * Math.log(t + 1) + 12 * (d + t) * Math.log(d + t + 1) - 12 * Math.log(t + 1) + 12 * Math.log(d + t + 1)) / 5;
    return mightychef;
};

const addLinks = () => {
    if (window.location.pathname.indexOf('bonus.php') !== -1 || (window.location.pathname.indexOf('bprate.php') !== -1 && window.location.href.indexOf('optimization=true') === -1)) {
        let linkbox = document.getElementsByClassName('linkbox');
        // the 'linkbox' holds the links at the top of the pages where we want to add our link
        if (linkbox.length === 0) {
            return;
        }

        linkbox = linkbox[0]; // we want the first linkbox

        const a = document.createElement('a');
        a.href = '/bprate.php?optimization=true';
        a.innerHTML = 'Bonus point optimization';
        a.setAttribute('class', 'linkbox__link');

        linkbox.appendChild(document.createTextNode(' ['));
        linkbox.appendChild(a);
        linkbox.appendChild(document.createTextNode(']'));
    }
};

const firstRun = cDiv => {
    const messageDiv = document.createElement('div');
    cDiv.appendChild(messageDiv);

    const p = document.createElement('p');
    p.innerHTML = "Welcome to Chameleon's take on the Bonus Point Optimization script (anyone else is welcome to modify and share their own versions).<br />";
    p.innerHTML += "Inspired by <a href='/user.php?id=104855'>Fermis</a>'s <a href='/forums.php?page=1&action=viewthread&threadid=26519'>script</a>.<br />";
    p.innerHTML += 'It gives a value (BP per GB per year) that allows the user to make an informed choice as to which torrents to continue seeding to maximize BP rate with limited HDD space.<br />';
    p.innerHTML += "This script saves it's data locally, allowing you to load fresh data when you choose, rather than on every run of the script.<br />";
    p.innerHTML += "Having the script run on it's own page also allows the data to be styled in a way that is (hopefully) most useful.<br /><br />";

    cDiv.appendChild(p);

    const a = document.createElement('a');
    cDiv.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Load initial data for the script';
    a.addEventListener('click', loadData.bind(undefined, cDiv, messageDiv), false);
    // bind is a handy way to pass variables through javascript callbacks. The first argument gets bound to 'this' in the called function.
};

const loadData = (cDiv, messageDiv) => {
    let torrentData = window.localStorage.bpopt;
    if (!torrentData) {
        torrentData = { firstRun: true };
    } else {
        torrentData = JSON.parse(torrentData);
    }

    torrentData.torrents = [];
    window.localStorage.bpopt = JSON.stringify(torrentData);
    messageDiv.innerHTML = 'Loading first page from bprate.php';

    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = xhrFunc.bind(undefined, cDiv, messageDiv, xhr, parseData.bind(undefined, cDiv, messageDiv, 1));
    xhr.open('GET', `${window.location.origin}/bprate.php?page=1`);
    xhr.send();
};

// a helper function that unwraps the returned xhr value and passes it to the function that takes the data
const xhrFunc = (cDiv, messageDiv, xhr, func) => {
    if (xhr.readyState === 4) {
        if (xhr.status === 200) {
            func(xhr.responseText);
        } else {
            messageDiv.innerHTML = 'Error loading the page';
        }
    }
};

const parseSize = size => {
    const s = parseFloat(size);
    let p = 0;

    if (size.indexOf('KiB') !== -1) {
        p = 1;
    } else if (size.indexOf('MiB') !== -1) {
        p = 2;
    } else if (size.indexOf('GiB') !== -1) {
        p = 3;
    } else if (size.indexOf('TiB') !== -1) {
        p = 4;
    }

    return s * (1024 ** p);
};

const parseData = (cDiv, messageDiv, page, data) => {
    const page1 = document.createElement('div');
    page1.innerHTML = data;

    const torrentData = JSON.parse(window.localStorage.bpopt);
    if (!torrentData.torrents) {
        torrentData.torrents = [];
    }

    if (page1.getElementsByTagName('tbody').length < 2) {
        messageDiv.innerHTML = 'Error: You have no torrents in your <a href="/bprate.php?page=1">bprate</a> page, the script can not run.';
        return;
    }

    const torrentTrs = page1.getElementsByTagName('tbody')[1].getElementsByTagName('tr');
    for (let i = 0; i < torrentTrs.length; i++) {
        const torrent = {};
        const tr = torrentTrs[i];
        const tds = tr.getElementsByTagName('td');

        torrent.id = tds[0].firstElementChild.href.split('torrentid=')[1];
        torrent.link = tds[0].firstElementChild.href;
        torrent.title = tds[0].firstElementChild.innerHTML.trim();
        torrent.gp = tds[1].innerHTML.indexOf('span') !== -1; // the GP column has a span in it if it's a GP and doesn't if not
        torrent.size = parseSize(tds[2].innerHTML.replace(/,/g, ''));
        torrent.seeders = parseInt(tds[3].innerHTML.replace(/,/g, ''), 10);
        torrent.ratio = parseFloat(tds[6].innerHTML.replace(/,/g, ''));
        torrent.bpyear = parseFloat(tds[9].innerHTML.replace(/,/g, ''));
        torrent.bphour = parseFloat(tds[5].innerHTML.replace(/,/g, ''));
        torrent.seedTimeSeconds = tds[4].getAttribute('data-seed-seconds');
        torrent.bpyeargb = calculateBPperYearperGB(torrent);
        torrent.cojbpyeargb = calculateBPperYearperGB(torrent, true, torrentData.cojyears ? torrentData.cojyears : 3);
        torrent.mightychefyeargb = calculateBPperYearperGB(torrent, true, 1, true, torrentData.mightychefdays ? torrentData.mightychefdays : 365);
        torrent.seedTimeDays = torrent.cojbpyeargb[1];
        torrent.cojbpyeargb = torrent.cojbpyeargb[0];
        torrent.hidden = false;

        torrentData.torrents.push(torrent);
    }

    const lastPage = page1.getElementsByClassName('pagination__link--last');
    if (lastPage.length === 0) {
        if (torrentData.useCoj) {
            torrentData.torrents.sort(cojbpyeargbSort.bind(true));
        } else {
            torrentData.torrents.sort(bpyeargbSort.bind(true));
        }

        torrentData.sortBy = 'BPYearGBr';
        if (page === 1) {
            messageDiv.innerHTML = 'Only one page of torrents found on bprate.php.';
        } else {
            messageDiv.innerHTML = `Finished loading ${page} pages from bprate.php.`;
        }

        window.setTimeout(loadSeedingPage.bind(undefined, cDiv, messageDiv, torrentData, 1), 1000);
    } else {
        window.setTimeout(loadPage.bind(undefined, cDiv, messageDiv, page + 1), 1000); // Timeout between page loads to avoid PTP's "popcorn quota"
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
};

const loadSeedingPage = (cDiv, messageDiv, torrentData, page) => {
    messageDiv.innerHTML = `Loading page ${page} from snatchlist.php`;

    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = xhrFunc.bind(undefined, cDiv, messageDiv, xhr, parseSeedingData.bind(undefined, cDiv, messageDiv, torrentData, page));
    xhr.open('GET', `${window.location.origin}/snatchlist.php?full=1&order_by=seeding&order_way=desc&page=${page}`);
    xhr.send();
};

const parseSeedingData = (cDiv, messageDiv, torrentData, page, data) => {
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
        for (let j = 0; j < torrentData.torrents.length; j++) {
            const t = torrentData.torrents[j];
            if (id === t.id) {
                torrentData.torrents[j].ratio = ratio;
                torrentData.torrents[j].seedTimeLeft = seedTimeLeft;
                break;
            }
        }
    }

    if (page1.getElementsByClassName('pagination__link--last').length === 0 || finished) {
        messageDiv.innerHTML = `Finished loading ${page} pages from snatchlist.php.<br />Writing page.`;
        window.setTimeout(showOptimization.bind(undefined, cDiv, torrentData), 1000);
    } else {
        window.setTimeout(loadSeedingPage.bind(undefined, cDiv, messageDiv, torrentData, page + 1), 1000);
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
};

// eslint-disable-next-line complexity
const showOptimization = (cDiv, torrentData) => {
    if (torrentData.torrents && torrentData.torrents.length > 0) {
        // used to have debugging info, but kept it in rather than reversing the conditional
    } else {
        window.localStorage.removeItem('bpopt');
        firstRun(cDiv);
        return;
    }

    cDiv.innerHTML = '';
    cDiv.setAttribute('style', 'text-align: center;');
    const message = document.createElement('div');

    let a = document.createElement('a');
    cDiv.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Refresh data';
    a.addEventListener('click', loadData.bind(undefined, cDiv, message), false);
    cDiv.appendChild(document.createElement('br'));
    cDiv.appendChild(document.createElement('br'));

    cDiv.appendChild(message);

    const headerDiv = document.createElement('div');
    headerDiv.setAttribute('style', 'margin: auto; width: 490px;');
    cDiv.appendChild(headerDiv);
    const sTotal = document.createElement('span');
    headerDiv.appendChild(sTotal);
    sTotal.innerHTML = 'x torrents seeding, x GiB total. x BP per ';
    if (torrentData.useMightychef) {
        sTotal.innerHTML += `${torrentData.mightychefdays ? torrentData.mightychefdays : '365'} days.`;
    } else {
        sTotal.innerHTML += 'year.';
    }

    const hidden = document.createElement('div');
    headerDiv.appendChild(hidden);
    hidden.setAttribute('style', 'display: none;');
    hidden.innerHTML = 'x torrents hidden, x GiB total. x BP per ';
    if (torrentData.useMightychef) {
        hidden.innerHTML += `${torrentData.mightychefdays ? torrentData.mightychefdays : '365'} days.`;
    } else {
        hidden.innerHTML += 'year.';
    }

    const shown = document.createElement('div');
    headerDiv.appendChild(shown);
    shown.setAttribute('style', 'display: none;');
    shown.innerHTML = 'x torrents visible, x GiB total. x BP per ';
    if (torrentData.useMightychef) {
        shown.innerHTML += `${torrentData.mightychefdays ? torrentData.mightychefdays : '365'} days.`;
    } else {
        shown.innerHTML += 'year.';
    }

    cDiv.appendChild(document.createElement('br'));
    const links = document.createElement('div');
    links.setAttribute('style', 'text-align: center;');
    cDiv.appendChild(links);

    a = document.createElement('a');
    links.appendChild(a);
    a.href = 'javascript:void(0);';
    if (torrentData.showHidden) {
        a.innerHTML = 'Hide';
    } else {
        a.innerHTML = 'Show';
    }

    a.innerHTML += ' Hidden';
    a.addEventListener('click', showHidden.bind(undefined, cDiv, torrentData), false);
    links.appendChild(document.createElement('br'));

    a = document.createElement('a');
    links.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Unhide All Torrents';
    a.addEventListener('click', showAllTorrents.bind(undefined, cDiv, torrentData), false);
    links.appendChild(document.createElement('br'));
    a = document.createElement('a');
    links.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Invert hidden';
    a.addEventListener('click', invertHidden.bind(undefined, cDiv, torrentData), false);
    links.appendChild(document.createElement('br'));
    a = document.createElement('a');
    links.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Hide GP Torrents';
    a.addEventListener('click', hideGP.bind(undefined, cDiv, torrentData), false);
    links.appendChild(document.createElement('br'));
    a = document.createElement('a');
    links.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Hide Torrents with ratio less than one';
    a.addEventListener('click', hideRatioLessThanOne.bind(undefined, cDiv, torrentData), false);
    links.appendChild(document.createElement('br'));
    a = document.createElement('a');
    links.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Hide Torrents with seed time remaining';
    a.addEventListener('click', hideNeedToSeed.bind(undefined, cDiv, torrentData), false);
    links.appendChild(document.createElement('br'));
    a = document.createElement('a');
    links.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Hide Torrents with fewer than 5 seeders';
    a.addEventListener('click', hideFewSeeders.bind(undefined, cDiv, torrentData), false);
    links.appendChild(document.createElement('br'));
    links.appendChild(document.createElement('br'));
    a = document.createElement('a');
    links.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Dump torrent json data';
    a.addEventListener('click', dumpData.bind(undefined, torrentData.torrents));

    links.appendChild(document.createElement('br'));
    links.appendChild(document.createElement('br'));

    a = document.createElement('a');
    links.appendChild(a);
    a.href = 'javascript:void(0);';
    if (torrentData.showOptions) {
        a.innerHTML = 'Hide ';
    } else {
        a.innerHTML = 'Show ';
    }

    a.innerHTML += 'Options';
    a.addEventListener('click', showOptions.bind(undefined, cDiv, torrentData), false);

    let div = document.createElement('div');
    cDiv.appendChild(div);
    if (!torrentData.showOptions) {
        div.setAttribute('style', 'display: none;');
    }

    a = document.createElement('a');
    div.appendChild(a);
    a.href = 'javascript:void(0);';
    if (torrentData.useCoj) {
        a.innerHTML = 'Using coj\'s algorithm';
    } else {
        a.innerHTML = 'Not using coj\'s algorithm';
    }

    a.addEventListener('click', useCoj.bind(undefined, cDiv, torrentData), false);
    div.appendChild(document.createElement('br'));

    a = document.createElement('a');
    div.appendChild(a);
    a.href = 'javascript:void(0);';
    if (torrentData.useMightychef) {
        a.innerHTML = 'Using mightychef\'s algorithm';
    } else {
        a.innerHTML = 'Not using mightychef\'s algorithm';
    }

    a.addEventListener('click', useMightychef.bind(undefined, cDiv, torrentData), false);
    div.appendChild(document.createElement('br'));

    let label = document.createElement('span');
    label.setAttribute('style', 'width: 300px; text-align:right; display:inline-block; margin-right:5px;');
    div.appendChild(label);
    label.innerHTML = 'coj Years averaged over: ';
    let cont = document.createElement('span');
    cont.setAttribute('style', 'width: 300px; display:inline-block; text-align:left;');
    div.appendChild(cont);
    let input = document.createElement('input');
    input.setAttribute('style', 'width: 60px; text-align: center;');
    cont.appendChild(input);
    input.type = 'number';
    input.value = torrentData.cojyears ? torrentData.cojyears : 3;
    cont.appendChild(document.createTextNode(' '));
    a = document.createElement('a');
    cont.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Apply';
    a.addEventListener('click', applyCojYears.bind(undefined, cDiv, torrentData, input), false);
    div.appendChild(document.createElement('br'));

    label = document.createElement('span');
    label.setAttribute('style', 'width: 300px; text-align:right; display:inline-block; margin-right:5px;');
    div.appendChild(label);
    label.innerHTML = 'mightychef days: ';
    cont = document.createElement('span');
    cont.setAttribute('style', 'width: 300px; display:inline-block; text-align:left;');
    div.appendChild(cont);
    const mightychefdaysInput = document.createElement('input');
    mightychefdaysInput.setAttribute('style', 'width: 60px; text-align: center;');
    cont.appendChild(mightychefdaysInput);
    mightychefdaysInput.type = 'number';
    mightychefdaysInput.value = torrentData.mightychefdays ? torrentData.mightychefdays : 365;
    cont.appendChild(document.createTextNode(' '));
    a = document.createElement('a');
    cont.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Apply';
    a.addEventListener('click', applyMightychefYears.bind(undefined, cDiv, torrentData, mightychefdaysInput), false);
    div.appendChild(document.createElement('br'));

    label = document.createElement('span');
    label.setAttribute('style', 'width: 300px; text-align:right; display:inline-block; margin-right:5px;');
    div.appendChild(label);
    label.innerHTML = 'BP/Year/GB divisor (2500 for GB/Year/GB): ';
    cont = document.createElement('span');
    cont.setAttribute('style', 'width: 300px; display:inline-block; text-align:left;');
    div.appendChild(cont);
    input = document.createElement('input');
    input.setAttribute('style', 'width: 60px; text-align: center;');
    cont.appendChild(input);
    input.type = 'number';
    input.value = torrentData.divisor ? torrentData.divisor : 1;
    cont.appendChild(document.createTextNode(' '));
    a = document.createElement('a');
    cont.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Apply';
    a.addEventListener('click', applyDivisor.bind(undefined, cDiv, torrentData, input), false);
    div.appendChild(document.createElement('br'));

    label = document.createElement('span');
    label.setAttribute('style', 'width: 300px; text-align:right; display:inline-block; margin-right:5px;');
    div.appendChild(label);
    label.innerHTML = 'mightychef Target: ';
    cont = document.createElement('span');
    cont.setAttribute('style', 'width: 300px; display:inline-block; text-align:left;');
    div.appendChild(cont);
    input = document.createElement('input');
    input.setAttribute('style', 'width: 60px; text-align: center;');
    cont.appendChild(input);
    input.type = 'number';
    input.value = torrentData.mightychefTarget ? torrentData.mightychefTarget : -1;
    cont.appendChild(document.createTextNode(' '));
    a = document.createElement('a');
    cont.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Apply';
    a.addEventListener('click', applyMightychefTarget.bind(undefined, cDiv, torrentData, input), false);
    div.appendChild(document.createElement('br'));

    label = document.createElement('span');
    label.setAttribute('style', 'width: 300px; text-align:right; display:inline-block; margin-right:5px;');
    div.appendChild(label);
    label.innerHTML = 'Minimum seed time (days): ';
    cont = document.createElement('span');
    cont.setAttribute('style', 'width: 300px; display:inline-block; text-align:left;');
    div.appendChild(cont);
    input = document.createElement('input');
    input.setAttribute('style', 'width: 60px; text-align: center;');
    cont.appendChild(input);
    input.type = 'number';
    input.value = torrentData.minimumSeedTime ? torrentData.minimumSeedTime : 2;
    cont.appendChild(document.createTextNode(' '));
    a = document.createElement('a');
    cont.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Apply';
    a.addEventListener('click', applyMinimumSeedTime.bind(undefined, cDiv, torrentData, input), false);

    cDiv.appendChild(document.createElement('br'));
    cDiv.appendChild(document.createElement('br'));

    const list = document.createElement('div');
    cDiv.appendChild(list);
    list.setAttribute('id', 'table');

    let totalTorrents = 0;
    let totalSize = 0;
    let totalBPYear = 0;
    const mightychefTotalBPYear = 0;
    let hiddenTotal = 0;
    let hiddenSize = 0;
    let hiddenBPYear = 0;
    let shownTotal = 0;
    let shownSize = 0;
    let shownBPYear = 0;

    const spanStyles = 'display: inline-block; text-align: center; overflow: hidden;';

    let bpyear = 'BP/Year';
    let bpyeargb = 'BP/Year/GB';
    let bp = 'BP';
    if (torrentData.divisor === 2500) {
        bpyeargb = 'GB/Year/GB';
        bp = 'GB';
    }

    if (torrentData.useMightychef) {
        bpyear = `BP/${torrentData.mightychefdays === 1 ? 'Day' : `${torrentData.mightychefdays} days`}`;
        bpyeargb = `${bp}/${torrentData.mightychefdays === 1 ? 'Day' : `${torrentData.mightychefdays} days`}/GB`;
    }

    const headers = [
        { title: 'GP', width: '25px' },
        { title: 'Title', width: '523px' },
        { title: 'Seed Time', width: '65px' },
        { title: 'Ratio', width: '35px' },
        { title: 'Size', width: '70px' },
        { title: 'Seeders', width: '55px' },
        { title: bpyear, width: '75px' },
        { title: bpyeargb, width: '75px' },
        { title: 'Hide', width: '30px' },
    ];
    for (let i = 0; i < headers.length; i++) {
        const span = document.createElement('span');
        list.appendChild(span);
        a = document.createElement('a');
        span.appendChild(a);
        a.href = 'javascript:void(0);';
        a.innerHTML = headers[i].title;
        a.addEventListener('click', sortTorrents.bind(a, cDiv, torrentData), false);
        span.setAttribute('style', `${spanStyles} width: ${headers[i].width}; background: rgba(0, 0, 0, 0.2);`);
    }

    for (let i = 0; i < torrentData.torrents.length; i++) {
        const t = torrentData.torrents[i];
        if (torrentData.useMightychef) {
            t.mightychefyeargb = calculateMightychefYears(t, torrentData.mightychefdays ? torrentData.mightychefdays : 365);
        }

        div = document.createElement('div');
        div.setAttribute('class', 'row hover');
        let divStyle = '';
        if (t.hidden) {
            if (!torrentData.showHidden) {
                divStyle += 'display: none;';
            } else {
                divStyle += 'opacity: 0.5;';
            }

            hiddenTotal++;
            hiddenSize += t.size;
            if (torrentData.useMightychef) {
                hiddenBPYear += t.mightychefyeargb;
            } else {
                hiddenBPYear += t.bpyear;
            }
        } else {
            shownTotal++;
            shownSize += t.size;
            if (torrentData.useMightychef) {
                shownBPYear += t.mightychefyeargb;
            } else {
                shownBPYear += t.bpyear;
            }
        }

        const mST = isNaN(torrentData.minimumSeedTime) ? 2 : parseFloat(torrentData.minimumSeedTime);
        if (mST > 0) {
            if (t.seedTimeDays < mST) {
                divStyle += 'background: rgba(255, 0, 0, 0.2);';
                div.title = `Seed time remaining: ${Math.round((torrentData.minimumSeedTime - t.seedTimeDays) * 100) / 100}`;
            }
        } else if (t.seedTimeDays > -mST) {
            divStyle += 'background: rgba(255, 0, 0, 0.2);';
        }

        div.setAttribute('style', divStyle);
        totalTorrents++;
        totalSize += t.size;
        if (torrentData.useMightychef) {
            totalBPYear += t.mightychefyeargb;
        } else {
            totalBPYear += t.bpyear;
        }

        list.appendChild(div);
        let span = document.createElement('span');
        let hOffset = 0;
        span.setAttribute('style', `${spanStyles} width: ${headers[hOffset].width};`);
        hOffset++;
        div.appendChild(span);
        if (t.gp) {
            span.innerHTML = '✿';
        }

        span = document.createElement('span');
        span.setAttribute('style', `${spanStyles} width: ${headers[hOffset].width}; overflow: hidden; white-space: nowrap; text-align: left;`);
        hOffset++;
        div.appendChild(span);
        a = document.createElement('a');
        span.appendChild(a);
        a.innerHTML = t.title;
        a.title = t.title;
        a.href = t.link;

        // spanStyles = 'float: right; '+spanStyles;

        span = document.createElement('span');
        span.setAttribute('style', `${spanStyles} width: ${headers[hOffset].width};`);
        hOffset++;
        div.appendChild(span);
        span.innerHTML = printNumber(t.seedTimeDays);

        span = document.createElement('span');
        span.setAttribute('style', `${spanStyles} width: ${headers[hOffset].width};`);
        hOffset++;
        div.appendChild(span);
        span.innerHTML = t.ratio;

        span = document.createElement('span');
        span.setAttribute('style', `${spanStyles} width: ${headers[hOffset].width};`);
        hOffset++;
        div.appendChild(span);
        span.innerHTML = printSize(t.size);

        span = document.createElement('span');
        span.setAttribute('style', `${spanStyles} width: ${headers[hOffset].width};`);
        hOffset++;
        div.appendChild(span);
        span.innerHTML = printNumber(t.seeders, true);

        span = document.createElement('span');
        span.setAttribute('style', `${spanStyles} width: ${headers[hOffset].width};`);
        hOffset++;
        div.appendChild(span);
        if (torrentData.useMightychef) {
            // if(isNaN(t.mightychefyeargb))
            t.mightychefyeargb = calculateMightychefYears(t, torrentData.mightychefdays ? torrentData.mightychefdays : 365);
            span.innerHTML = printNumber(t.mightychefyeargb);
        } else {
            span.innerHTML = printNumber(t.bpyear);
        }

        span = document.createElement('span');
        span.setAttribute('style', `${spanStyles} width: ${headers[hOffset].width};`);
        hOffset++;
        div.appendChild(span);
        const divisor = torrentData.divisor ? torrentData.divisor : 1;
        if (torrentData.useMightychef) {
            span.innerHTML = printNumber((calculateMightychefYears(t, torrentData.mightychefdays ? torrentData.mightychefdays : 365) / divisor) / parseFloat(t.size / (1024 ** 3)));
        } else if (torrentData.useCoj) {
            span.innerHTML = printNumber(t.cojbpyeargb / divisor);
        } else {
            span.innerHTML = printNumber(t.bpyeargb / divisor);
        }

        span = document.createElement('span');
        span.setAttribute('style', `${spanStyles} width: ${headers[hOffset].width};`);
        hOffset++;
        div.appendChild(span);
        a = document.createElement('a');
        span.appendChild(a);
        a.href = 'javascript:void(0);';
        a.innerHTML = 'X';
        a.addEventListener('click', hideTorrent.bind(undefined, i, cDiv, torrentData), false);
    }

    const spanStyle1 = 'width: 130px; text-align: right; display: inline-block;';
    const spanStyle2 = 'width: 130px; text-align: right; display: inline-block;';
    const spanStyle3 = 'margin-left: 10px; text-align: right; display: inline-block;';

    const mightychefdays = torrentData.mightychefdays ? parseFloat(torrentData.mightychefdays) : 365;
    let target = torrentData.mightychefTarget ? torrentData.mightychefTarget : -1;

    if (torrentData.useMightychef && target !== -1 && Math.round(totalBPYear * 100) !== (target * 100) && torrentData.loops < 20) {
        const currentBP = parseInt(document.getElementById('nav_bonus').getElementsByTagName('a')[0].innerHTML.split('(')[1].split(')')[0].replace(/,/g, ''), 10);
        if (currentBP < target) {
            target -= currentBP;
        }

        torrentData.mightychefdays = parseFloat(mightychefdays) / (totalBPYear / parseInt(target, 10));
        torrentData.loops = torrentData.loops ? torrentData.loops + 1 : 1;
        window.localStorage.bpopt = JSON.stringify(torrentData);
        showOptimization(cDiv, torrentData);
        return;
    }

    sTotal.innerHTML = '';
    let span = document.createElement('span');
    sTotal.appendChild(span);
    span.setAttribute('style', spanStyle1);
    span.innerHTML = `${totalTorrents} torrent${totalTorrents !== 1 ? 's' : ''} seeding, `;
    span = document.createElement('span');
    sTotal.appendChild(span);
    span.setAttribute('style', spanStyle2);
    span.innerHTML = `${printSize(totalSize)} total. `;
    span = document.createElement('span');
    sTotal.appendChild(span);
    span.setAttribute('style', spanStyle3);
    span.innerHTML = `${printNumber(totalBPYear)} BP  `;
    if (torrentData.useMightychef) {
        if (mightychefdays !== 1) {
            const dayRemainder = mightychefdays % 1;
            const hours = dayRemainder * 24;
            const hoursRemainder = hours % 1;
            const minutes = hoursRemainder * 60;
            const minutesRemainder = minutes % 1;
            const seconds = Math.round(minutesRemainder * 60);
            if (hours === 0 && minutes === 0 && seconds === 0) {
                span.innerHTML += `in ${mightychefdays} days.`;
            } else {
                span.innerHTML += `in ${mightychefdays - dayRemainder} days, ${hours - hoursRemainder} hours, ${minutes - minutesRemainder} minutes, and ${seconds} seconds.`;
            }
        } else {
            span.innerHTML += 'in 1 day.';
        }
    } else {
        span.innerHTML += 'per year.';
    }

    hidden.innerHTML = '';
    span = document.createElement('span');
    hidden.appendChild(span);
    span.setAttribute('style', `${spanStyle2} position: relative; right: 7px;`);
    span.innerHTML = `${hiddenTotal} torrent${hiddenTotal !== 1 ? 's' : ''} hidden, `;
    span = document.createElement('span');
    hidden.appendChild(span);
    span.setAttribute('style', spanStyle2);
    span.innerHTML = `${printSize(hiddenSize)} GiB total. `;
    span = document.createElement('span');
    hidden.appendChild(span);
    span.setAttribute('style', spanStyle3);
    span.innerHTML = `${printNumber(hiddenBPYear)} BP per  `;
    if (torrentData.useMightychef) {
        if (mightychefdays !== 1) {
            span.innerHTML += `${torrentData.mightychefdays ? torrentData.mightychefdays : '365'} days.`;
        } else {
            span.innerHTML += 'day.';
        }
    } else {
        span.innerHTML += 'year.';
    }

    shown.innerHTML = '';
    span = document.createElement('span');
    shown.appendChild(span);
    span.setAttribute('style', `${spanStyle2} position: relative; right: 9px;`);
    span.innerHTML = `${shownTotal} torrent${shownTotal !== 1 ? 's' : ''} visible, `;
    span = document.createElement('span');
    shown.appendChild(span);
    span.setAttribute('style', spanStyle2);
    span.innerHTML = `${printSize(shownSize)} GiB total. `;
    span = document.createElement('span');
    shown.appendChild(span);
    span.setAttribute('style', spanStyle3);
    span.innerHTML = `${printNumber(shownBPYear)} BP per `;
    if (torrentData.useMightychef) {
        if (mightychefdays !== 1) {
            span.innerHTML += `${torrentData.mightychefdays ? torrentData.mightychefdays : '365'} days.`;
        } else {
            span.innerHTML += 'day.';
        }
    } else {
        span.innerHTML += 'year.';
    }

    if (hiddenTotal > 0) {
        hidden.setAttribute('style', 'display: block;');
        shown.setAttribute('style', 'display: block;');
    }

    // add a scriptFinished event, to trigger other scripts
    const event = new Event('scriptFinished');
    window.dispatchEvent(event);
    // and also set an attribute on the document, if the script runs after this one it can check the attribute
    document.body.setAttribute('scriptFinished', true);
};

const dumpData = torrents => {
    document.body.innerHTML = JSON.stringify(torrents);
};

const addCSVtoLink = (a, torrentData) => {
    // var fields=["id", "link", "title", "gp", "size", "seeders", "ratio", "bpyear", "bphour", "seedtimeseconds", "bpyeargb", "cojbpyeargb", "mightychefyeargb", "seedTimeDays", "hidden", "seedTimeLeft"];
    const fields = ['id', 'link', 'title', 'gp', 'size', 'seeders', 'ratio', 'bpyear', 'bphour', 'seedtimeseconds', 'bpyeargb', 'cojbpyeargb', 'mightychefyeargb', 'seedTimeDays', 'hidden', 'seedTimeLeft'];

    let text = '';
    for (let i = 0; i < fields.length; i++) {
        text += `"${fields[i]}"`;
        if (i !== fields.length - 1) {
            text += ',';
        } else {
            text += '\n';
        }
    }

    window.setTimeout(actualAddCSV.bind(undefined, a, torrentData, 0, text, fields), 0);
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
        window.setTimeout(actualAddCSV.bind(undefined, a, torrentData, index, text, fields), 0);
    }
};

function sortTorrents(cDiv, torrentData) {
    let sortBy = this.innerHTML.replace(/[/, ]/g, '');
    const sortFunc = getSortFunc(sortBy, torrentData.sortBy, torrentData.useCoj, torrentData.useMightychef, torrentData.mightychefdays ? torrentData.mightychefdays : 0);
    if (torrentData.sortBy === sortBy) {
        sortBy += 'r';
    }

    torrentData.sortBy = sortBy;
    torrentData.torrents.sort(sortFunc);
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
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
        if (isNaN(ratioA)) { // ratioA is infinite
            ratioA = 9999991;
        }
    }

    if (b.ratio.length > 2) { // the ratio was successfully split, so it isn't --
        ratioB = parseFloat(b.ratio.split('>')[1].replace(/,/g, ''));
        if (isNaN(ratioB)) { // ratioB is infinite
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

const hideTorrent = (i, cDiv, torrentData) => {
    const t = torrentData.torrents[i];
    t.hidden = !t.hidden;
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const showTorrent = (i, cDiv, torrentData) => {
    torrentData.torrents[i].hidden = false;
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const useMightychef = (cDiv, torrentData, a) => {
    if (torrentData.useMightychef) {
        a.innerHTML = "Not using mightychef's algorithm";
        torrentData.useMightychef = false;
    } else {
        torrentData.useMightychef = true;
        a.innerHTML = "Using mightychef's algorithm";
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const useCoj = (cDiv, torrentData, a) => {
    if (torrentData.useCoj) {
        a.innerHTML = "Not using coj's algorithm";
        torrentData.useCoj = false;
    } else {
        torrentData.useCoj = true;
        a.innerHTML = "Using coj's algorithm";
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const applyCojYears = (cDiv, torrentData, input) => {
    torrentData.cojyears = input.value;
    for (let i = 0; i < torrentData.torrents.length; i++) {
        const torrent = torrentData.torrents[i];
        torrentData.torrents[i].cojbpyeargb = calculateBPperYearperGB(torrent, true, input.value)[0];
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const applyMightychefYears = (cDiv, torrentData, input) => {
    torrentData.mightychefdays = input.value;
    for (let i = 0; i < torrentData.torrents.length; i++) {
        const torrent = torrentData.torrents[i];
        torrentData.torrents[i].mightychefyeargb = calculateBPperYearperGB(torrent, true, 1, true, input.value);
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const applyMinimumSeedTime = (cDiv, torrentData, input) => {
    torrentData.minimumSeedTime = input.value;
    window.localStorage.bpopt = JSON.stringify(torrentData);
    if (torrentData.hideNeedToSee) {
        torrentData = rehide(torrentData);
    }

    showOptimization(cDiv, torrentData);
};

const calculateMightychefYears = (torrent, days) =>
    calculateBPperYearperGB(torrent, true, 1, true, days);

const applyDivisor = (cDiv, torrentData, input) => {
    torrentData.divisor = parseFloat(input.value);
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const applyMightychefTarget = (cDiv, torrentData, input) => {
    torrentData.mightychefTarget = parseFloat(input.value);
    torrentData.loops = 0;
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const invertHidden = (cDiv, torrentData) => {
    for (let i = 0; i < torrentData.torrents.length; i++) {
        torrentData.torrents[i].hidden = !torrentData.torrents[i].hidden;
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const showAllTorrents = (cDiv, torrentData) => {
    for (let i = 0; i < torrentData.torrents.length; i++) {
        torrentData.torrents[i].hidden = false;
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const showHidden = (cDiv, torrentData) => {
    torrentData.showHidden = !torrentData.showHidden;
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const showOptions = (cDiv, torrentData) => {
    torrentData.showOptions = !torrentData.showOptions;
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const hideGP = (cDiv, torrentData) => {
    for (let i = 0; i < torrentData.torrents.length; i++) {
        const t = torrentData.torrents[i];
        if (t.gp) {
            torrentData.torrents[i].hidden = true;
        }
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const hideNeedToSeed = (cDiv, torrentData) => {
    for (let i = 0; i < torrentData.torrents.length; i++) {
        const t = torrentData.torrents[i];
        // if(t.seedTimeLeft != 'Complete')
        if (torrentData.minimumSeedTime > 0) {
            if (t.seedTimeDays < torrentData.minimumSeedTime) {
                torrentData.torrents[i].hidden = true;
            }
        } else {
            if (t.seedTimeDays > -torrentData.minimumSeedTime) {
                torrentData.torrents[i].hidden = true;
            }
        }
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const hideRatioLessThanOne = (cDiv, torrentData) => {
    for (let i = 0; i < torrentData.torrents.length; i++) {
        const t = torrentData.torrents[i];
        try {
            if (parseFloat(t.ratio.split('>')[1]) < 1.0) {
                torrentData.torrents[i].hidden = true;
            }
        } catch (e) {
            console.log(`Bonus Point Optimization script: t.ratio is something funny: ${t.ratio}`);
        }
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const hideFewSeeders = (cDiv, torrentData) => {
    for (let i = 0; i < torrentData.torrents.length; i++) {
        const t = torrentData.torrents[i];
        if (t.seeders <= 5) {
            torrentData.torrents[i].hidden = true;
        }
    }

    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const printNumber = (number, unfixed) => {
    if (!unfixed) {
        return number.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    } else {
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
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

const loadPage = (cDiv, messageDiv, page) => {
    messageDiv.innerHTML = `Loading page ${page} from bprate.php`;

    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = xhrFunc.bind(undefined, cDiv, messageDiv, xhr, parseData.bind(undefined, cDiv, messageDiv, page));
    xhr.open('GET', `${window.location.origin}/bprate.php?page=${page}`);
    xhr.send();
};

// ----- MAIN -----

// We will create a new page, bpoptimization.php, that returns a 404 error on PTP, so we can make it do what we want from scratch.
// Add links to the new page on both the bonus.php and bprate.php pages, and do it in a function so we can quick return out:
addLinks();

let torrentData = window.localStorage.bpopt;
if (!torrentData) {
    torrentData = { firstRun: true };
} else {
    torrentData = JSON.parse(torrentData);
    torrentData.loops = 1;
    torrentData.firstRun = false;
}

window.localStorage.bpopt = JSON.stringify(torrentData);

if (window.location.href.indexOf('optimization=true') !== -1) {
    const s = document.createElement('style');
    document.head.appendChild(s);
    s.innerHTML = '.hover:hover { background: rgba(255, 255, 255, 0.2); }';
    // Alamak asked us not to use our own page, as 404 errors are logged. Wipe the bprate page and recreate the template of the 404 page if our variable is set
    const c = document.getElementById('content');
    c.innerHTML = '';
    const div = document.createElement('div');
    div.setAttribute('class', 'thin');
    c.appendChild(div);
    const d = document.createElement('h2');
    d.setAttribute('class', 'page__title');
    div.appendChild(d);
    const a = document.createElement('a');
    a.innerHTML = 'BP rates';
    a.href = '/bprate.php';
    d.appendChild(a);
    d.appendChild(document.createTextNode(' > Bonus point optimization'));
    const contentDiv = document.createElement('div');
    div.appendChild(contentDiv);
    contentDiv.setAttribute('class', 'panel');
    // We're on our created page, do some cleanup:
    document.title = 'Bonus point optimization :: PassThePopcorn'; // set the window title

    const data = JSON.parse(window.localStorage.bpopt);

    if (data.firstRun) {
        firstRun(contentDiv); // if our local storage value isn't set, or is empty (script reset), introduce the script
    } else {
        showOptimization(contentDiv, data, ''); // otherwise show the page with cached data
    }
}
