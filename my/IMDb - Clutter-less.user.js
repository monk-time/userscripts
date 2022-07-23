// ==UserScript==
// @name          IMDb - Clutter-less
// @description   Remove junk from IMDb pages
// @namespace     https://openuserjs.org/users/monk-time
// @author        monk-time
// @copyright     2017, monk-time (https://github.com/monk-time)
// @license       MIT; https://opensource.org/licenses/MIT
// @homepageURL   https://openuserjs.org/scripts/monk-time/IMDb_-_Clutter-less
// @updateURL     https://openuserjs.org/meta/monk-time/IMDb_-_Clutter-less.meta.js
// @include       http://*.imdb.com/*
// @include       https://*.imdb.com/*
// @icon          https://ia.media-imdb.com/images/G/01/imdb/images/favicon-2165806970.ico
// @run-at        document-idle
// @version       1.1
// ==/UserScript==

'use strict';

// ----- Settings -----

const mainSections = [
    'More like this',
    'Videos',
    'Photos',
    'Contribute to this page',
];

// ----- Main -----

const hideMainSections = () => {
    const elMain = document.querySelector('main');
    if (!elMain) return;
    const elSections = [...elMain.querySelectorAll('section.ipc-page-section.ipc-page-section--base')];
    const getSectionHeaderText = el => el.querySelector('.ipc-title__text')?.childNodes[0].textContent;
    const sectionsByHeader = Object.fromEntries(
        elSections
            .filter(el => getSectionHeaderText(el))
            .map(el => [getSectionHeaderText(el), el]),
    );

    for (const section of mainSections) {
        sectionsByHeader[section]?.remove();
    }
};

const hideFooterSections = () => {
    document.querySelector('[class^=RecentlyViewedItems__RecentlyViewedContainer]')?.remove();
    document.querySelector('footer')?.remove();
};

const reMovie = /imdb\.com\/title\/tt\d+/;
const reName = /imdb\.com\/name\/nm\d+/;
const isOnPage = re => re.test(document.location.href);
const isOnMoviePage = isOnPage(reMovie);
const isOnNamePage = isOnPage(reName);

const hideSidebarSections = () => {
    if (!isOnMoviePage && !isOnNamePage) return;

    const elSidebarHeader = [...document.querySelectorAll('main section > hgroup')]
        .find(el => el.textContent.trim() === 'More to explore');
    if (!elSidebarHeader) {
        console.error('No sidebar header found');
        return;
    }

    const elSidebar = elSidebarHeader.nextElementSibling;
    const hideIfNotUserLists = el => {
        // Hide all sections that are not user lists
        // Sections are selected explicity, selecting all non-matching breaks delayed loading
        if (el.dataset.testid === 'SidebarPolls' ||
            el.querySelector('.imdb-editorial-single')
        ) {
            el.style.display = 'none';
        }
    };

    [...elSidebar.children].forEach(hideIfNotUserLists);
    // IMDb doesn't load all sections on page load but adds them later
    const mut = new MutationObserver(mutList => mutList.forEach(({ addedNodes }) => {
        if (!addedNodes.length) return;
        addedNodes.forEach(hideIfNotUserLists);
    }));
    mut.observe(elSidebar, { childList: true });
};

hideMainSections();
hideFooterSections();
hideSidebarSections();

console.log('IMDb has been cleaned up!');
