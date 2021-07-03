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
    const elMain = document.querySelector('[class^=TitleMainBelowTheFoldGroup__TitleMainPrimaryGroup]');
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
const [isOnMoviePage, isOnNamePage] = [reMovie, reName]
    .map(re => re.test(document.location.href));

const hideSectionsInSidebar = () => {
    if (!isOnMoviePage && !isOnNamePage) return;

    const elMain = document.querySelector('[class^=TitleMainBelowTheFoldGroup__SidebarContainer]');
    if (!elMain) return;
    elMain.querySelectorAll('hgroup[data-testid="right-rail-more-to-explore"], [class^=SidebarSlot]')
        .forEach(el => {
            el.style.display = 'none';
        });
};

hideMainSections();
hideFooterSections();
hideSectionsInSidebar();

console.log('IMDb has been cleaned up!');
