// ==UserScript==
// @name        ICM - Append next page
// @namespace   monk-time
// @author      monk-time
// @license     MIT; https://opensource.org/licenses/MIT
// @include     https://www.icheckmovies.com/lists/*
// @include     https://www.icheckmovies.com/search/movies/*
// @include     https://www.icheckmovies.com/movies/
// @include     https://www.icheckmovies.com/movies/unchecked/*
// @include     https://www.icheckmovies.com/movies/checked/*
// @include     https://www.icheckmovies.com/movies/favorited/*
// @include     https://www.icheckmovies.com/movies/disliked/*
// @include     https://www.icheckmovies.com/movies/watchlist/*
// @include     https://www.icheckmovies.com/movies/?tags=*
// @icon        https://www.icheckmovies.com/favicon.ico
// ==/UserScript==

'use strict';

// ---- Text spinner ----

class Spinner {
    constructor(targetElement) {
        this.target = targetElement;
        this.unicodeFrames = '┤┘┴└├┌┬┐';
        this.delay = 150;
        this.curFrame = 0;
        this.spins = false;
    }

    start() {
        this.intervalID = window.setInterval(() => this.next(), this.delay);
        this.spins = true;
        this.target.textContent = '';
        // empty field prevents extra clicks from appendAll loop
        // if its interval is shorter than spinner's
    }

    next() {
        // update target text
        this.target.textContent = this.unicodeFrames[this.curFrame];
        // move to next frame
        this.curFrame = (this.curFrame + 1) % this.unicodeFrames.length;
    }

    stop() {
        window.clearInterval(this.intervalID);
        this.spins = false;
        this.target.textContent = '';
    }
}

// ---- Fetch utils ----

const parseHTML = html => new DOMParser().parseFromString(html, 'text/html');
const extractFrom = async (url, extractor) => {
    const r = await fetch(url, { credentials: 'include' });
    const html = await r.text();
    return extractor(html);
};

const extractor = html => [...parseHTML(html).querySelectorAll(selItems)];

// ---- Selectors ----

// The script should work on lists of movies/lists
const selContainer = '.itemList';
const selItems = `${selContainer} > li`;
const selMaxPageNum = '#paging .pages li:last-of-type';
const selNextButton = '#paging > .next > a';

// ---- Main ----

const nextButton = document.querySelector(selNextButton);
const buttonLabels = {
    append: 'Append next',
    done: 'Done',
};

const container = document.querySelector(selContainer);
const maxPage = Number(document.querySelector(selMaxPageNum)?.textContent);

if (!nextButton || !container) {
    throw new Error('Not a list with pages');
}

if (!maxPage) {
    throw new Error('Invalid max page number');
}

const spinner = new Spinner(nextButton);

const appendNext = async () => {
    if (spinner.spins) { // prevents additional requests until the page has loaded
        console.log('Spinner is still spining, please wait');
        return false;
    }

    const url = nextButton.href;
    const nextPageNum = Number(url.match(/\d+/)[0]);

    spinner.start();

    const items = await extractFrom(url, extractor);
    console.log(`Loaded page #${nextPageNum}`);
    spinner.stop();
    container.append(...items);

    if (nextPageNum === maxPage) {
        nextButton.textContent = buttonLabels.done; // this notifies appendAll loop
        nextButton.remove();
    } else {
        nextButton.textContent = buttonLabels.append;
    }

    const nextUrl = url.replace(/([?&])page=\d+/, `$1page=${nextPageNum + 1}`);
    nextButton.href = nextUrl;

    return false;
};

const attachHandler = () => {
    nextButton.textContent = buttonLabels.append;
    nextButton.addEventListener('click', e => {
        e.preventDefault();
        appendNext();
    });
};

attachHandler();

/* exported appendAll */

const appendAll = () => {
    const appendLoop = () => {
        const btnText = nextButton.textContent;
        if (btnText === buttonLabels.append) {
            nextButton.click();
        } else if (btnText === buttonLabels.done) {
            window.clearInterval(intervalID);
        }
    };

    const intervalID = window.setInterval(appendLoop, 1000);
    return intervalID;
};

// Expose appendAll to the browser console; tested only in FF+GM
// const appendAllObj = { run: appendAll };
// unsafeWindow.appendAll = cloneInto(appendAllObj, unsafeWindow, { cloneFunctions: true });
exportFunction(appendAll, window, { defineAs: 'appendAll' });
