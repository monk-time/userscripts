// ==UserScript==
// @name         Bonus Point Optimization
// @version      1.8
// @description  Chameleon's take on the BP optimization script
// @author       Chameleon
// @include      http*://*passthepopcorn.me/bonus.php*
// @include      http*://*passthepopcorn.me/bprate.php*
// @grant        none
// ==/UserScript==

'use strict';

const calculateBPperYearperGB = (torrent, coj, cojyears, mightychef, mightychefdays) => {
    if (!coj) {
        return torrent.bpyear / (torrent.size / (1024 ** 3));
    }

    var a = 0.25;
    var b = 0.6;
    var c = 0.6;
    var constYears = cojyears;
    var effectivePeriod = constYears * 365.2422;
    var goldenMultiplier = 1.0;
    if (torrent.gp) {
        goldenMultiplier = 2.0;
    }

    //var bpPerHour = torrent.bpyear/8765.81;
    var bpPerHour = (torrent.bpyear / 8765.81) / (8765.81 / 5358);
    if (false)//torrent.bphour) - apparently that's why bphour isn't used - it's not accurate enough, leads to quite wrong seed time
        bpPerHour = torrent.bphour;

    var Q = b / (torrent.seeders ** c);
    //var t = Math.exp((bpPerHour/((torrent.size/(1024 ** 3))*goldenMultiplier) - a) / Q) - 1.0; // seed time in days
    var t = torrent.seedTimeSeconds / 86400; // We now have access to the raw seed time in seconds

    var AvgBpPerYearPerGiB = (24.0 * (a * effectivePeriod + Q * ((t + 1.0 + effectivePeriod) * (Math.log(t + 1.0 + effectivePeriod)) - (t + 1.0) * (Math.log(t + 1.0)) - effectivePeriod)) * goldenMultiplier) / constYears;
    if (!mightychef) {
        return [AvgBpPerYearPerGiB, t];
    }

    var s = torrent.size / (1024 * 1024 * 1024);
    var u = torrent.seeders;
    var d = parseFloat(mightychefdays);
    //return 6*s*u^(-3/5)*(5*d*u^(3/5) - 12*d - 12*t*ln(t + 1) + 12*(d + t)*ln(d + t + 1) - 12*ln(t + 1) + 12*ln(d + t + 1))/5;
    var mightychef = goldenMultiplier * 6 * s * (u ** (-3 / 5)) * (5 * d * (u ** (3 / 5)) - 12 * d - 12 * t * Math.log(t + 1) + 12 * (d + t) * Math.log(d + t + 1) - 12 * Math.log(t + 1) + 12 * Math.log(d + t + 1)) / 5;
    return mightychef;
};

const addLinks = () => {
    if (window.location.pathname.indexOf('bonus.php') !== -1 || (window.location.pathname.indexOf('bprate.php') !== -1 && window.location.href.indexOf('optimization=true') === -1)) {
        var linkbox = document.getElementsByClassName('linkbox');
        // the 'linkbox' holds the links at the top of the pages where we want to add our link
        if (linkbox.length === 0) {
            return;
        }

        linkbox = linkbox[0]; // we want the first linkbox

        var a = document.createElement('a');
        a.href = '/bprate.php?optimization=true';
        a.innerHTML = 'Bonus point optimization';
        a.setAttribute('class', 'linkbox__link');

        linkbox.appendChild(document.createTextNode(' ['));
        linkbox.appendChild(a);
        linkbox.appendChild(document.createTextNode(']'));
    }
};

const firstRun = cDiv => {
    var messageDiv = document.createElement('div');
    cDiv.appendChild(messageDiv);

    var p = document.createElement('p');
    p.innerHTML = "Welcome to Chameleon's take on the Bonus Point Optimization script (anyone else is welcome to modify and share their own versions).<br />";
    p.innerHTML += "Inspired by <a href='/user.php?id=104855'>Fermis</a>'s <a href='/forums.php?page=1&action=viewthread&threadid=26519'>script</a>.<br />";
    p.innerHTML += 'It gives a value (BP per GB per year) that allows the user to make an informed choice as to which torrents to continue seeding to maximize BP rate with limited HDD space.<br />';
    p.innerHTML += "This script saves it's data locally, allowing you to load fresh data when you choose, rather than on every run of the script.<br />";
    p.innerHTML += "Having the script run on it's own page also allows the data to be styled in a way that is (hopefully) most useful.<br /><br />";

    cDiv.appendChild(p);

    var a = document.createElement('a');
    cDiv.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Load initial data for the script';
    a.addEventListener('click', loadData.bind(undefined, cDiv, messageDiv), false);
    // bind is a handy way to pass variables through javascript callbacks. The first argument gets bound to 'this' in the called function.
};

const loadData = (cDiv, messageDiv) => {
    var torrentData = window.localStorage.bpopt;
    if (!torrentData)
        torrentData = { firstRun: true };
    else
        torrentData = JSON.parse(torrentData);
    torrentData.torrents = [];
    window.localStorage.bpopt = JSON.stringify(torrentData);
    messageDiv.innerHTML = 'Loading first page from bprate.php';

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = xhrFunc.bind(undefined, cDiv, messageDiv, xhr, parseData.bind(undefined, cDiv, messageDiv, 1));
    xhr.open('GET', `${window.location.origin}/bprate.php?page=1`);
    xhr.send();
};

// a helper function that unwraps the returned xhr value and passes it to the function that takes the data
const xhrFunc = (cDiv, messageDiv, xhr, func) => {
    if (xhr.readyState === 4) {
        if (xhr.status === 200)
            func(xhr.responseText);
        else
            messageDiv.innerHTML = 'Error loading the page';
    }
};

const parseSize = size => {
    var s = parseFloat(size);
    var p = 0;

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
    var page1 = document.createElement('div');
    page1.innerHTML = data;

    var torrentData = JSON.parse(window.localStorage.bpopt);
    if (!torrentData.torrents)
        torrentData.torrents = [];

    if (page1.getElementsByTagName('tbody').length < 2) {
        messageDiv.innerHTML = 'Error: You have no torrents in your <a href="/bprate.php?page=1">bprate</a> page, the script can not run.';
        return;
    }
    var torrent_trs = page1.getElementsByTagName('tbody')[1].getElementsByTagName('tr');
    for (var i = 0; i < torrent_trs.length; i++) {
        var torrent = {};
        var tr = torrent_trs[i];
        var tds = tr.getElementsByTagName('td');

        torrent.id = tds[0].firstElementChild.href.split('torrentid=')[1];
        torrent.link = tds[0].firstElementChild.href;
        torrent.title = tds[0].firstElementChild.innerHTML.trim();
        torrent.gp = tds[1].innerHTML.indexOf('span') !== -1; // the GP column has a span in it if it's a GP and doesn't if not
        torrent.size = parseSize(tds[2].innerHTML.replace(/,/g, ''));
        torrent.seeders = parseInt(tds[3].innerHTML.replace(/,/g, ''));
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

    var lastPage = page1.getElementsByClassName('pagination__link--last');
    if (lastPage.length === 0) {
        if (torrentData.useCoj)
            torrentData.torrents.sort(cojbpyeargbSort.bind(true));
        else
            torrentData.torrents.sort(bpyeargbSort.bind(true));
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

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = xhrFunc.bind(undefined, cDiv, messageDiv, xhr, parseSeedingData.bind(undefined, cDiv, messageDiv, torrentData, page));
    xhr.open('GET', `${window.location.origin}/snatchlist.php?full=1&order_by=seeding&order_way=desc&page=${page}`);
    xhr.send();
};

const parseSeedingData = (cDiv, messageDiv, torrentData, page, data) => {
    var page1 = document.createElement('div');
    page1.innerHTML = data;

    var trs = page1.getElementsByTagName('table')[0].getElementsByTagName('tr');
    var finished = false;

    for (var i = 1; i < trs.length; i++) {
        var tds = trs[i].getElementsByTagName('td');
        if (tds[7].textContent !== 'Yes') {
            finished = true;
            break;
        }
        var id = tds[0].firstElementChild.href.split('torrentid=')[1];
        var ratio = tds[3].innerHTML;
        var seedTimeLeft = tds[8].textContent;
        for (var j = 0; j < torrentData.torrents.length; j++) {
            var t = torrentData.torrents[j];
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
    var message = document.createElement('div');

    var a = document.createElement('a');
    cDiv.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Refresh data';
    a.addEventListener('click', loadData.bind(undefined, cDiv, message), false);
    cDiv.appendChild(document.createElement('br'));
    cDiv.appendChild(document.createElement('br'));

    cDiv.appendChild(message);

    var headerDiv = document.createElement('div');
    headerDiv.setAttribute('style', 'margin: auto; width: 490px;');
    cDiv.appendChild(headerDiv);
    var sTotal = document.createElement('span');
    headerDiv.appendChild(sTotal);
    sTotal.innerHTML = 'x torrents seeding, x GiB total. x BP per ';
    if (torrentData.useMightychef) {
        sTotal.innerHTML += `${torrentData.mightychefdays ? torrentData.mightychefdays : '365'} days.`;
    } else {
        sTotal.innerHTML += 'year.';
    }

    var hidden = document.createElement('div');
    headerDiv.appendChild(hidden);
    hidden.setAttribute('style', 'display: none;');
    hidden.innerHTML = 'x torrents hidden, x GiB total. x BP per ';
    if (torrentData.useMightychef) {
        hidden.innerHTML += `${torrentData.mightychefdays ? torrentData.mightychefdays : '365'} days.`;
    } else {
        hidden.innerHTML += 'year.';
    }

    var shown = document.createElement('div');
    headerDiv.appendChild(shown);
    shown.setAttribute('style', 'display: none;');
    shown.innerHTML = 'x torrents visible, x GiB total. x BP per ';
    if (torrentData.useMightychef) {
        shown.innerHTML += `${torrentData.mightychefdays ? torrentData.mightychefdays : '365'} days.`;
    } else {
        shown.innerHTML += 'year.';
    }

    cDiv.appendChild(document.createElement('br'));
    var links = document.createElement('div');
    links.setAttribute('style', 'text-align: center;');
    cDiv.appendChild(links);
    var a = document.createElement('a');
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
    var a = document.createElement('a');
    links.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Unhide All Torrents';
    a.addEventListener('click', showAllTorrents.bind(undefined, cDiv, torrentData), false);
    links.appendChild(document.createElement('br'));
    var a = document.createElement('a');
    links.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Invert hidden';
    a.addEventListener('click', invertHidden.bind(undefined, cDiv, torrentData), false);
    links.appendChild(document.createElement('br'));
    var a = document.createElement('a');
    links.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Hide GP Torrents';
    a.addEventListener('click', hideGP.bind(undefined, cDiv, torrentData), false);
    links.appendChild(document.createElement('br'));
    var a = document.createElement('a');
    links.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Hide Torrents with ratio less than one';
    a.addEventListener('click', hideRatioLessThanOne.bind(undefined, cDiv, torrentData), false);
    links.appendChild(document.createElement('br'));
    var a = document.createElement('a');
    links.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Hide Torrents with seed time remaining';
    a.addEventListener('click', hideNeedToSeed.bind(undefined, cDiv, torrentData), false);
    links.appendChild(document.createElement('br'));
    var a = document.createElement('a');
    links.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Hide Torrents with fewer than 5 seeders';
    a.addEventListener('click', hideFewSeeders.bind(undefined, cDiv, torrentData), false);
    links.appendChild(document.createElement('br'));
    links.appendChild(document.createElement('br'));
    var a = document.createElement('a');
    links.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Dump torrent json data';
    a.addEventListener('click', dumpData.bind(undefined, torrentData.torrents));

    links.appendChild(document.createElement('br'));
    links.appendChild(document.createElement('br'));

    var a = document.createElement('a');
    links.appendChild(a);
    a.href = 'javascript:void(0);';
    if (torrentData.showOptions) {
        a.innerHTML = 'Hide ';
    } else {
        a.innerHTML = 'Show ';
    }

    a.innerHTML += 'Options';
    a.addEventListener('click', showOptions.bind(undefined, cDiv, torrentData), false);

    var div = document.createElement('div');
    cDiv.appendChild(div);
    if (!torrentData.showOptions)
        div.setAttribute('style', 'display: none;');

    var a = document.createElement('a');
    div.appendChild(a);
    a.href = 'javascript:void(0);';
    if (torrentData.useCoj) {
        a.innerHTML = 'Using coj\'s algorithm';
    } else {
        a.innerHTML = 'Not using coj\'s algorithm';
    }

    a.addEventListener('click', useCoj.bind(undefined, cDiv, torrentData), false);
    div.appendChild(document.createElement('br'));

    var a = document.createElement('a');
    div.appendChild(a);
    a.href = 'javascript:void(0);';
    if (torrentData.useMightychef) {
        a.innerHTML = 'Using mightychef\'s algorithm';
    } else {
        a.innerHTML = 'Not using mightychef\'s algorithm';
    }

    a.addEventListener('click', useMightychef.bind(undefined, cDiv, torrentData), false);
    div.appendChild(document.createElement('br'));


    var label = document.createElement('span');
    label.setAttribute('style', 'width: 300px; text-align:right; display:inline-block; margin-right:5px;');
    div.appendChild(label);
    label.innerHTML = 'coj Years averaged over: ';
    var cont = document.createElement('span');
    cont.setAttribute('style', 'width: 300px; display:inline-block; text-align:left;');
    div.appendChild(cont);
    var input = document.createElement('input');
    input.setAttribute('style', 'width: 60px; text-align: center;');
    cont.appendChild(input);
    input.type = 'number';
    input.value = torrentData.cojyears ? torrentData.cojyears : 3;
    cont.appendChild(document.createTextNode(' '));
    var a = document.createElement('a');
    cont.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Apply';
    a.addEventListener('click', applyCojYears.bind(undefined, cDiv, torrentData, input), false);
    div.appendChild(document.createElement('br'));

    var label = document.createElement('span');
    label.setAttribute('style', 'width: 300px; text-align:right; display:inline-block; margin-right:5px;');
    div.appendChild(label);
    label.innerHTML = 'mightychef days: ';
    var cont = document.createElement('span');
    cont.setAttribute('style', 'width: 300px; display:inline-block; text-align:left;');
    div.appendChild(cont);
    var mightychefdaysInput = document.createElement('input');
    mightychefdaysInput.setAttribute('style', 'width: 60px; text-align: center;');
    cont.appendChild(mightychefdaysInput);
    mightychefdaysInput.type = 'number';
    mightychefdaysInput.value = torrentData.mightychefdays ? torrentData.mightychefdays : 365;
    cont.appendChild(document.createTextNode(' '));
    var a = document.createElement('a');
    cont.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Apply';
    a.addEventListener('click', applyMightychefYears.bind(undefined, cDiv, torrentData, mightychefdaysInput), false);
    div.appendChild(document.createElement('br'));

    var label = document.createElement('span');
    label.setAttribute('style', 'width: 300px; text-align:right; display:inline-block; margin-right:5px;');
    div.appendChild(label);
    label.innerHTML = 'BP/Year/GB divisor (2500 for GB/Year/GB): ';
    var cont = document.createElement('span');
    cont.setAttribute('style', 'width: 300px; display:inline-block; text-align:left;');
    div.appendChild(cont);
    var input = document.createElement('input');
    input.setAttribute('style', 'width: 60px; text-align: center;');
    cont.appendChild(input);
    input.type = 'number';
    input.value = torrentData.divisor ? torrentData.divisor : 1;
    cont.appendChild(document.createTextNode(' '));
    var a = document.createElement('a');
    cont.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Apply';
    a.addEventListener('click', applyDivisor.bind(undefined, cDiv, torrentData, input), false);
    div.appendChild(document.createElement('br'));

    var label = document.createElement('span');
    label.setAttribute('style', 'width: 300px; text-align:right; display:inline-block; margin-right:5px;');
    div.appendChild(label);
    label.innerHTML = 'mightychef Target: ';
    var cont = document.createElement('span');
    cont.setAttribute('style', 'width: 300px; display:inline-block; text-align:left;');
    div.appendChild(cont);
    var input = document.createElement('input');
    input.setAttribute('style', 'width: 60px; text-align: center;');
    cont.appendChild(input);
    input.type = 'number';
    input.value = torrentData.mightychefTarget ? torrentData.mightychefTarget : -1;
    cont.appendChild(document.createTextNode(' '));
    var a = document.createElement('a');
    cont.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Apply';
    a.addEventListener('click', applyMightychefTarget.bind(undefined, cDiv, torrentData, input), false);
    div.appendChild(document.createElement('br'));

    var label = document.createElement('span');
    label.setAttribute('style', 'width: 300px; text-align:right; display:inline-block; margin-right:5px;');
    div.appendChild(label);
    label.innerHTML = 'Minimum seed time (days): ';
    var cont = document.createElement('span');
    cont.setAttribute('style', 'width: 300px; display:inline-block; text-align:left;');
    div.appendChild(cont);
    var input = document.createElement('input');
    input.setAttribute('style', 'width: 60px; text-align: center;');
    cont.appendChild(input);
    input.type = 'number';
    input.value = torrentData.minimumSeedTime ? torrentData.minimumSeedTime : 2;
    cont.appendChild(document.createTextNode(' '));
    var a = document.createElement('a');
    cont.appendChild(a);
    a.href = 'javascript:void(0);';
    a.innerHTML = 'Apply';
    a.addEventListener('click', applyMinimumSeedTime.bind(undefined, cDiv, torrentData, input), false);

    cDiv.appendChild(document.createElement('br'));
    cDiv.appendChild(document.createElement('br'));

    var list = document.createElement('div');
    cDiv.appendChild(list);
    list.setAttribute('id', 'table');

    var totalTorrents = 0;
    var totalSize = 0;
    var totalBPYear = 0;
    var mightychefTotalBPYear = 0;
    var hiddenTotal = 0;
    var hiddenSize = 0;
    var hiddenBPYear = 0;
    var shownTotal = 0;
    var shownSize = 0;
    var shownBPYear = 0;

    var spanStyles = 'display: inline-block; text-align: center; overflow: hidden;';

    var bpyear = 'BP/Year';
    var bpyeargb = 'BP/Year/GB';
    var bp = 'BP';
    if (torrentData.divisor === 2500) {
        bpyeargb = 'GB/Year/GB';
        bp = 'GB';
    }
    if (torrentData.useMightychef) {
        bpyear = `BP/${(torrentData.mightychefdays === 1) ? 'Day' : torrentData.mightychefdays + ' days'}`;
        bpyeargb = `${bp}/${(torrentData.mightychefdays === 1) ? 'Day' : torrentData.mightychefdays + ' days'}/GB`;
    }

    var headers = [{ title: 'GP', width: '25px' }, { title: 'Title', width: '523px' }, { title: 'Seed Time', width: '65px' }, { title: 'Ratio', width: '35px' },
    { title: 'Size', width: '70px' }, { title: 'Seeders', width: '55px' }, { title: bpyear, width: '75px' },
    { title: bpyeargb, width: '75px' }, { title: 'Hide', width: '30px' }];
    for (var i = 0; i < headers.length; i++) {
        var span = document.createElement('span');
        list.appendChild(span);
        var a = document.createElement('a');
        span.appendChild(a);
        a.href = 'javascript:void(0);';
        a.innerHTML = headers[i].title;
        a.addEventListener('click', sortTorrents.bind(a, cDiv, torrentData), false);
        span.setAttribute('style', `${spanStyles} width: ${headers[i].width}; background: rgba(0, 0, 0, 0.2);`);
    }
    for (var i = 0; i < torrentData.torrents.length; i++) {
        var t = torrentData.torrents[i];
        if (torrentData.useMightychef) {
            t.mightychefyeargb = calculateMightychefYears(t, torrentData.mightychefdays ? torrentData.mightychefdays : 365);
        }
        var div = document.createElement('div');
        div.setAttribute('class', 'row hover');
        var divStyle = '';
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
        var mST = isNaN(torrentData.minimumSeedTime) ? 2 : parseFloat(torrentData.minimumSeedTime);
        if (mST > 0) {
            if (t.seedTimeDays < mST) {
                divStyle += 'background: rgba(255, 0, 0, 0.2);';
                div.title = `Seed time remaining: ${Math.round((torrentData.minimumSeedTime - t.seedTimeDays) * 100) / 100}`;
            }
        } else {
            if (t.seedTimeDays > -mST) {
                divStyle += 'background: rgba(255, 0, 0, 0.2);';
            }
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
        var span = document.createElement('span');
        var hOffset = 0;
        span.setAttribute('style', `${spanStyles} width: ${headers[hOffset].width};`);
        hOffset++;
        div.appendChild(span);
        if (t.gp) {
            span.innerHTML = '✿';
        }
        var span = document.createElement('span');
        span.setAttribute('style', `${spanStyles} width: ${headers[hOffset].width}; overflow: hidden; white-space: nowrap; text-align: left;`);
        hOffset++;
        div.appendChild(span);
        var a = document.createElement('a');
        span.appendChild(a);
        a.innerHTML = t.title;
        a.title = t.title;
        a.href = t.link;

        //spanStyles = 'float: right; '+spanStyles;

        var span = document.createElement('span');
        span.setAttribute('style', `${spanStyles} width: ${headers[hOffset].width};`);
        hOffset++;
        div.appendChild(span);
        span.innerHTML = printNumber(t.seedTimeDays);

        var span = document.createElement('span');
        span.setAttribute('style', `${spanStyles} width: ${headers[hOffset].width};`);
        hOffset++;
        div.appendChild(span);
        span.innerHTML = t.ratio;

        var span = document.createElement('span');
        span.setAttribute('style', `${spanStyles} width: ${headers[hOffset].width};`);
        hOffset++;
        div.appendChild(span);
        span.innerHTML = printSize(t.size);

        var span = document.createElement('span');
        span.setAttribute('style', `${spanStyles} width: ${headers[hOffset].width};`);
        hOffset++;
        div.appendChild(span);
        span.innerHTML = printNumber(t.seeders, true);

        var span = document.createElement('span');
        span.setAttribute('style', `${spanStyles} width: ${headers[hOffset].width};`);
        hOffset++;
        div.appendChild(span);
        if (torrentData.useMightychef) {
            //if(isNaN(t.mightychefyeargb))
            t.mightychefyeargb = calculateMightychefYears(t, torrentData.mightychefdays ? torrentData.mightychefdays : 365);
            span.innerHTML = printNumber(t.mightychefyeargb);
        } else
            span.innerHTML = printNumber(t.bpyear);

        var span = document.createElement('span');
        span.setAttribute('style', `${spanStyles} width: ${headers[hOffset].width};`);
        hOffset++;
        div.appendChild(span);
        var divisor = torrentData.divisor ? torrentData.divisor : 1;
        if (torrentData.useMightychef) {
            span.innerHTML = printNumber((calculateMightychefYears(t, torrentData.mightychefdays ? torrentData.mightychefdays : 365) / divisor) / parseFloat(t.size / (1024 ** 3)));
        } else if (torrentData.useCoj)
            span.innerHTML = printNumber(t.cojbpyeargb / divisor);
        else
            span.innerHTML = printNumber(t.bpyeargb / divisor);

        var span = document.createElement('span');
        span.setAttribute('style', `${spanStyles} width: ${headers[hOffset].width};`);
        hOffset++;
        div.appendChild(span);
        var a = document.createElement('a');
        span.appendChild(a);
        a.href = 'javascript:void(0);';
        a.innerHTML = 'X';
        a.addEventListener('click', hideTorrent.bind(undefined, i, cDiv, torrentData), false);
    }

    var spanStyle1 = 'width: 130px; text-align: right; display: inline-block;';
    var spanStyle2 = 'width: 130px; text-align: right; display: inline-block;';
    var spanStyle3 = 'margin-left: 10px; text-align: right; display: inline-block;';

    var mightychefdays = torrentData.mightychefdays ? parseFloat(torrentData.mightychefdays) : 365;
    var target = torrentData.mightychefTarget ? torrentData.mightychefTarget : -1;

    if (torrentData.useMightychef && target !== -1 && Math.round(totalBPYear * 100) !== (target * 100) && torrentData.loops < 20) {
        var currentBP = parseInt(document.getElementById('nav_bonus').getElementsByTagName('a')[0].innerHTML.split('(')[1].split(')')[0].replace(/,/g, ''));
        if (currentBP < target)
            target = target - currentBP;
        torrentData.mightychefdays = parseFloat(mightychefdays) / (totalBPYear / parseInt(target));
        torrentData.loops = torrentData.loops ? torrentData.loops + 1 : 1;
        window.localStorage.bpopt = JSON.stringify(torrentData);
        showOptimization(cDiv, torrentData);
        return;
    }

    sTotal.innerHTML = '';
    var span = document.createElement('span');
    sTotal.appendChild(span);
    span.setAttribute('style', spanStyle1);
    span.innerHTML = `${totalTorrents} torrent${totalTorrents !== 1 ? 's' : ''} seeding, `;
    var span = document.createElement('span');
    sTotal.appendChild(span);
    span.setAttribute('style', spanStyle2);
    span.innerHTML = `${printSize(totalSize)} total. `;
    var span = document.createElement('span');
    sTotal.appendChild(span);
    span.setAttribute('style', spanStyle3);
    span.innerHTML = `${printNumber(totalBPYear)} BP  `;
    if (torrentData.useMightychef) {
        if (mightychefdays !== 1) {
            var dayRemainder = mightychefdays % 1;
            var hours = dayRemainder * 24;
            var hoursRemainder = hours % 1;
            var minutes = hoursRemainder * 60;
            var minutesRemainder = minutes % 1;
            var seconds = Math.round(minutesRemainder * 60);
            if (hours === 0 && minutes === 0 && seconds === 0)
                span.innerHTML += `in ${mightychefdays} days.`;
            else {
                span.innerHTML += `in ${mightychefdays - dayRemainder} days, ${hours - hoursRemainder} hours, ${minutes - minutesRemainder} minutes, and ${seconds} seconds.`;
            }
        } else {
            span.innerHTML += 'in 1 day.';
        }
    } else {
        span.innerHTML += 'per year.';
    }

    hidden.innerHTML = '';
    var span = document.createElement('span');
    hidden.appendChild(span);
    span.setAttribute('style', `${spanStyle2} position: relative; right: 7px;`);
    span.innerHTML = `${hiddenTotal} torrent${hiddenTotal != 1 ? 's' : ''} hidden, `;
    var span = document.createElement('span');
    hidden.appendChild(span);
    span.setAttribute('style', spanStyle2);
    span.innerHTML = `${printSize(hiddenSize)} GiB total. `;
    var span = document.createElement('span');
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
    var span = document.createElement('span');
    shown.appendChild(span);
    span.setAttribute('style', `${spanStyle2} position: relative; right: 9px;`);
    span.innerHTML = `${shownTotal} torrent${shownTotal != 1 ? 's' : ''} visible, `;
    var span = document.createElement('span');
    shown.appendChild(span);
    span.setAttribute('style', spanStyle2);
    span.innerHTML = `${printSize(shownSize)} GiB total. `;
    var span = document.createElement('span');
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
    var event = new Event('scriptFinished');
    window.dispatchEvent(event);
    // and also set an attribute on the document, if the script runs after this one it can check the attribute
    document.body.setAttribute('scriptFinished', true);
};

const dumpData = torrents => {
    document.body.innerHTML = JSON.stringify(torrents);
};

const addCSVtoLink = (a, torrentData) => {
    //var fields=["id", "link", "title", "gp", "size", "seeders", "ratio", "bpyear", "bphour", "seedtimeseconds", "bpyeargb", "cojbpyeargb", "mightychefyeargb", "seedTimeDays", "hidden", "seedTimeLeft"];
    var fields = ['id', 'link', 'title', 'gp', 'size', 'seeders', 'ratio', 'bpyear', 'bphour', 'seedtimeseconds', 'bpyeargb', 'cojbpyeargb', 'mightychefyeargb', 'seedTimeDays', 'hidden', 'seedTimeLeft'];

    var text = '';
    for (var i = 0; i < fields.length; i++) {
        text += `"${fields[i]}"`;
        if (i != fields.length - 1)
            text += ',';
        else
            text += '\n';
    }
    window.setTimeout(actualAddCSV.bind(undefined, a, torrentData, 0, text, fields), 0);
};

const actualAddCSV = (a, torrentData, index, text, fields) => {
    if (!a.parentNode)
        return;
    a.innerHTML = `Generating row ${index + 1} of ${torrentData.torrents.length}`;
    for (var i = 0; i < torrentData.torrents.length; i++) {
        var t = torrentData.torrents[i];
        for (var j = 0; j < fields.length; j++) {
            var f = fields[j];
            var field = t[f];
            if (typeof (field) === 'undefined') {
                field = '';
            }

            field = `${field}`;
            text += `"${field.replace('"', '')}"`;
            if (j != fields.length - 1) {
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
    var sortBy = this.innerHTML.replace(/[\/, ]/g, '');
    var sortFunc = getSortFunc(sortBy, torrentData.sortBy, torrentData.useCoj, torrentData.useMightychef, torrentData.mightychefdays ? torrentData.mightychefdays : 0);
    if (torrentData.sortBy == sortBy)
        sortBy += 'r';
    torrentData.sortBy = sortBy;
    torrentData.torrents.sort(sortFunc);
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
}

const getSortFunc = (sortBy, existingSortBy, coj, mightychef, mightychefdays) => {
    var reverse = sortBy == existingSortBy;
    if ((sortBy == 'BPYearGB' || sortBy == 'GBYearGB' || sortBy == 'BPYearGBr' || sortBy == 'GBYearGBr') && coj)
        return cojbpyeargbSort.bind(reverse);
    if (mightychef && sortBy.match(/BP\d/)) {
        if (sortBy.match(/BP\d.*GB/))
            return mightychefbpyearSort.bind(reverse, mightychefdays);
        return mightychefbySort.bind(reverse);
    }
    if (mightychef && sortBy.match(/GB\d.*GB/))
        return mightychefbpyearSort.bind(reverse, mightychefdays);
    var funcs = { GP: gpSort, Title: titleSort, Size: sizeSort, Seeders: seedersSort, BPYear: bpyearSort, BPDay: mightychefbySort, BPYearGB: bpyeargbSort, GBYearGB: bpyeargbSort, Hide: hideSort, Ratio: ratioSort, SeedTime: seedTimeSort };
    return funcs[sortBy].bind(reverse);
};

function mightychefbpyearSort(days, a, b) {
    var aVal = calculateMightychefYears(a, days) / parseFloat(a.size / (1024 ** 3));
    var bVal = calculateMightychefYears(b, days) / parseFloat(b.size / (1024 ** 3));

    var val = 0;
    if (aVal > bVal)
        val = 1;
    if (aVal < bVal)
        val = -1;
    if (this)
        return -val;
    return val;
}

function mightychefbySort(a, b) {
    var val = 0;
    if (a.mightychefyeargb > b.mightychefyeargb)
        val = 1;
    if (a.mightychefyeargb < b.mightychefyeargb)
        val = -1;
    if (this)
        return -val;
    return val;
}

function gpSort(a, b) {
    var val = 0;
    if (a.gp && !b.gp)
        val = -1;
    if (!a.gp && b.gp)
        val = 1;
    if (this)
        return -val;
    return val;
}
function titleSort(a, b) {
    var val = 0;
    if (a.title > b.title)
        val = 1;
    if (a.title < b.title)
        val = -1;
    if (this)
        return -val;
    return val;
}
function sizeSort(a, b) {
    var val = 0;
    if (a.size < b.size)
        val = 1;
    if (a.size > b.size)
        val = -1;
    if (this)
        return -val;
    return val;
}
function seedersSort(a, b) {
    var val = 0;
    if (a.seeders < b.seeders)
        val = 1;
    if (a.seeders > b.seeders)
        val = -1;
    if (this)
        return -val;
    return val;
}
function bpyearSort(a, b) {
    var val = 0;
    if (a.bpyear > b.bpyear)
        val = 1;
    if (a.bpyear < b.bpyear)
        val = -1;
    if (this)
        return -val;
    return val;
}
function bpyeargbSort(a, b) {
    var val = 0;
    if (a.bpyeargb > b.bpyeargb)
        val = 1;
    if (a.bpyeargb < b.bpyeargb)
        val = -1;
    if (this)
        return -val;
    return val;
}
function cojbpyeargbSort(a, b) {
    var val = 0;
    if (a.cojbpyeargb > b.cojbpyeargb)
        val = 1;
    if (a.cojbpyeargb < b.cojbpyeargb)
        val = -1;
    if (this)
        return -val;
    return val;
}
function hideSort(a, b) {
    var val = 0;
    if (a.hidden && !b.hidden)
        val = 1;
    if (!a.hidden && b.hidden)
        val = -1;
    if (this)
        return -val;
    return val;
}
function ratioSort(a, b) {
    var val = 0;
    var ratioA = 999999;
    var ratioB = 999999;
    if (a.ratio.length > 2) // the ratio was successfully split, so it isn't --
    {
        ratioA = parseFloat(a.ratio.split('>')[1].replace(/,/g, ''));
        if (isNaN(ratioA)) // ratioA is infinite
            ratioA = 9999991;
    }
    if (b.ratio.length > 2) // the ratio was successfully split, so it isn't --
    {
        ratioB = parseFloat(b.ratio.split('>')[1].replace(/,/g, ''));
        if (isNaN(ratioB)) // ratioB is infinite
            ratioB = 9999991;
    }
    if (ratioA < ratioB)
        val = 1;
    if (ratioA > ratioB)
        val = -1;
    if (this)
        return -val;
    return val;
}
function seedTimeSort(a, b) {
    var val = 0;
    if (a.seedTimeDays > b.seedTimeDays)
        val = 1;
    if (a.seedTimeDays < b.seedTimeDays)
        val = -1;
    if (this)
        return -val;
    return val;
}

const hideTorrent = (i, cDiv, torrentData) => {
    var t = torrentData.torrents[i];
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
    for (var i = 0; i < torrentData.torrents.length; i++) {
        var torrent = torrentData.torrents[i];
        torrentData.torrents[i].cojbpyeargb = calculateBPperYearperGB(torrent, true, input.value)[0];
    }
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const applyMightychefYears = (cDiv, torrentData, input) => {
    torrentData.mightychefdays = input.value;
    for (var i = 0; i < torrentData.torrents.length; i++) {
        var torrent = torrentData.torrents[i];
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

const calculateMightychefYears = (torrent, days) => {
    return calculateBPperYearperGB(torrent, true, 1, true, days);
};

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
    for (var i = 0; i < torrentData.torrents.length; i++) {
        torrentData.torrents[i].hidden = !torrentData.torrents[i].hidden;
    }
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const showAllTorrents = (cDiv, torrentData) => {
    for (var i = 0; i < torrentData.torrents.length; i++) {
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
    for (var i = 0; i < torrentData.torrents.length; i++) {
        var t = torrentData.torrents[i];
        if (t.gp)
            torrentData.torrents[i].hidden = true;
    }
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const hideNeedToSeed = (cDiv, torrentData) => {
    for (var i = 0; i < torrentData.torrents.length; i++) {
        var t = torrentData.torrents[i];
        //if(t.seedTimeLeft != 'Complete')
        if (torrentData.minimumSeedTime > 0) {
            if (t.seedTimeDays < torrentData.minimumSeedTime)
                torrentData.torrents[i].hidden = true;
        } else {
            if (t.seedTimeDays > -torrentData.minimumSeedTime)
                torrentData.torrents[i].hidden = true;
        }
    }
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const hideRatioLessThanOne = (cDiv, torrentData) => {
    for (var i = 0; i < torrentData.torrents.length; i++) {
        var t = torrentData.torrents[i];
        try {
            if (parseFloat(t.ratio.split('>')[1]) < 1.0)
                torrentData.torrents[i].hidden = true;
        }
        catch (e) {
            console.log(`Bonus Point Optimization script: t.ratio is something funny: ${t.ratio}`);
        }
    }
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const hideFewSeeders = (cDiv, torrentData) => {
    for (var i = 0; i < torrentData.torrents.length; i++) {
        var t = torrentData.torrents[i];
        if (t.seeders <= 5)
            torrentData.torrents[i].hidden = true;
    }
    window.localStorage.bpopt = JSON.stringify(torrentData);
    showOptimization(cDiv, torrentData);
};

const printNumber = (number, unfixed) => {
    if (!unfixed)
        return number.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    else
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const printSize = size => {
    var size1 = size / 1024;
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

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = xhrFunc.bind(undefined, cDiv, messageDiv, xhr, parseData.bind(undefined, cDiv, messageDiv, page));
    xhr.open('GET', `${window.location.origin}/bprate.php?page=${page}`);
    xhr.send();
};

// ----- MAIN -----

// We will create a new page, bpoptimization.php, that returns a 404 error on PTP, so we can make it do what we want from scratch.
// Add links to the new page on both the bonus.php and bprate.php pages, and do it in a function so we can quick return out:
addLinks();

var torrentData = window.localStorage.bpopt;
if (!torrentData)
    torrentData = { firstRun: true };
else {
    torrentData = JSON.parse(torrentData);
    torrentData.loops = 1;
    torrentData.firstRun = false;
}
window.localStorage.bpopt = JSON.stringify(torrentData);

if (window.location.href.indexOf('optimization=true') !== -1) {
    var s = document.createElement('style');
    document.head.appendChild(s);
    s.innerHTML = '.hover:hover { background: rgba(255, 255, 255, 0.2); }';
    // Alamak asked us not to use our own page, as 404 errors are logged. Wipe the bprate page and recreate the template of the 404 page if our variable is set
    var c = document.getElementById('content');
    c.innerHTML = '';
    var div = document.createElement('div');
    div.setAttribute('class', 'thin');
    c.appendChild(div);
    var d = document.createElement('h2');
    d.setAttribute('class', 'page__title');
    div.appendChild(d);
    var a = document.createElement('a');
    a.innerHTML = 'BP rates';
    a.href = '/bprate.php';
    d.appendChild(a);
    d.appendChild(document.createTextNode(' > Bonus point optimization'));
    var contentDiv = document.createElement('div');
    div.appendChild(contentDiv);
    contentDiv.setAttribute('class', 'panel');
    // We're on our created page, do some cleanup:
    document.title = 'Bonus point optimization :: PassThePopcorn'; // set the window title

    var data = JSON.parse(window.localStorage.bpopt);

    if (data.firstRun) {
        firstRun(contentDiv); // if our local storage value isn't set, or is empty (script reset), introduce the script
    } else {
        showOptimization(contentDiv, data, ''); // otherwise show the page with cached data
    }
}
