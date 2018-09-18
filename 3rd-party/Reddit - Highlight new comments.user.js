// ==UserScript==
// @name           Reddit - Highlight new comments
// @description    Highlight new comments in a thread since your last visit
// @namespace      monk-time
// @author         JonnyRobbie, monk-time
// @include        /^https?:\/\/([a-z]+\.)?reddit\.com\/r\/[a-zA-Z0-9_-]+\/comments\/[0-9a-z]+\/[^/]+\//
// @icon           https://www.reddit.com/favicon.ico
// @version        1.8.1
// ==/UserScript==

'use strict';

/* ------- SETTINGS ------- */

const expirationDays = 14;
const colors = {
    main: '#e5facc',
    // Special colors for comments made in the last N minutes.
    // Order doesn't matter (will be sorted asc. later), the strictest rule takes priority.
    // Leave the array empty to disable this feature.
    recent: [[5, '#faf0cc'], [20, '#fafacc'], [60, '#effacc']],
};

/* ------- TIME UTILS ------- */

const minsToMs = n => n * 60 * 1000;
const msToMins = n => n / 1000 / 60;
const daysToMins = n => n * 24 * 60;
const padToTwo = n => `${n >= 0 && n < 10 ? '0' : ''}${n}`;

// [hours, mins] ago from now -> timestamp (ms)
const humanDeltaToTime = ([hours, mins]) => Date.now() - minsToMs(hours * 60 + mins);

// timestamp (ms) -> [hours, mins] ago from now
const timeToHumanDelta = timestamp => {
    const deltaMs = Date.now() - timestamp;
    const deltaMins = Math.floor(msToMins(deltaMs));
    return [Math.floor(deltaMins / 60), deltaMins % 60];
};

// [5, 12] -> '05:12'
const humanDeltaToStr = ([hours, mins]) => [hours, mins].map(padToTwo).join(':');

// '05:12' -> [5, 12]
const strToHumanDelta = hhmm => {
    const match = hhmm.match(/^(\d+):([0-5]\d)$/);
    if (!match) throw new Error('Invalid time string.');
    return match.slice(1).map(Number);
};

/* ------- MAIN ------- */

colors.recent.sort(([aLimit], [bLimit]) => aLimit - bLimit);
const getCSSClassName = limit => (limit > 0 ? `highlight-${limit}` : 'highlight');
const stylesByRecency = [[0, colors.main], ...colors.recent].map(([limit, color]) => `
    .entry.${getCSSClassName(limit)} .usertext-body {
        background-color: ${color};
    }
`).join('');

document.head.insertAdjacentHTML('beforeend', `<style>${stylesByRecency}</style>`);

const main = () => {
    purgeOldStorage(expirationDays);

    const threadID = getThreadID();
    let lastVisit = localStorage.getItem(threadID);
    if (lastVisit !== null) {
        lastVisit = Number(lastVisit);
        addGoldBox(humanDeltaToStr(timeToHumanDelta(lastVisit)));
        highlightComments(lastVisit);
    }

    // Don't reset timer in single comment's threads
    if (/\/comments\/[0-9a-z]+\/[^/]+\/[0-9a-z]+\/(\?[^/]+)?$/.test(document.URL)) return;
    console.log('Setting localStorage to now.');
    localStorage.setItem(threadID, Date.now());
};

const purgeOldStorage = deltaDays => {
    const timeNow = Date.now();
    const deltaMs = daysToMins(minsToMs(deltaDays));
    const isOutdated = ([key, timeStr]) =>
        key.startsWith('redd_id_') && Number(timeStr) + deltaMs < timeNow;
    const outdated = Object.entries(localStorage).filter(isOutdated);

    outdated.forEach(([key]) => localStorage.removeItem(key));
    if (outdated.length) {
        console.log(`Removed ${outdated.length} localStorage older than ${deltaDays} days.`);
    }
};

const getThreadID = () => {
    const elID = document.querySelector('[rel="shorturl"]');
    if (!elID || !elID.href) throw new Error('Not a comment thread, aborting userscript.');
    return `redd_id_${elID.href.match(/redd.it\/([0-9a-z]+)/)[1]}`;
};

const addGoldBox = timeStr => {
    let target = document.querySelector('.commentarea > form.usertext');
    if (!target) { // e.g. in a closed thread
        target = document.querySelector('.commentarea > .menuarea');
    }

    target.insertAdjacentHTML('afterend', `
        <div class="rounded gold-accent comment-visits-box">
            <div class="title">
                <span>Highlight comments since previous visit [hh:mm] ago:</span>
                <input type="text" style="margin: auto 5px; width: 64px;">
                <input type="button" value="OK">
                <input type="button" value="Clear">
            </div>
        </div>
    `);

    const [, textInput, btnOK, btnClear] = target.nextElementSibling.children[0].children;
    textInput.value = timeStr;
    btnOK.addEventListener('click', () => setLastVisitManually(textInput.value));
    btnClear.addEventListener('click', () => highlightComments(Date.now()));
};

const setLastVisitManually = hhmm => {
    let newLastVisit;
    try {
        newLastVisit = humanDeltaToTime(strToHumanDelta(hhmm));
    } catch (e) {
        alert('You have not entered a valid time.');
        console.error(e.message);
        return;
    }

    highlightComments(newLastVisit);
};

const highlightComments = lastVisit => {
    console.log(`Highlighting comments newer than: ${new Date(lastVisit).toString()}.`);
    const comments = document.querySelectorAll('.comment > .entry');
    comments.forEach(comment => {
        const elTime = comment.querySelector('time');
        if (!elTime || !elTime.title) return;
        const timestamp = Date.parse(elTime.title);
        if (timestamp <= lastVisit) return;
        const [hours, mins] = timeToHumanDelta(timestamp);
        const deltaMins = hours * 60 + mins;
        comment.classList.add(getCSSClassName(getLimit(deltaMins)));
    });
};

// Get the upper limit (in minutes) of the first matching rule
// for a comment based on its recency.
const getLimit = diffMins => {
    // colors.recent is assumed to be sorted in ascending order
    const firstMatch = colors.recent.find(([maxMins]) => maxMins >= diffMins);
    return firstMatch ? firstMatch[0] : 0;
};

main();
