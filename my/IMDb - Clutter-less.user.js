// ==UserScript==
// @name          IMDb - Clutter-less
// @description   Remove junk from IMDb pages, such as a footer, recommendations, or images and ads in the sidebar.
// @namespace     https://openuserjs.org/users/monk-time
// @author        monk-time
// @copyright     2017, monk-time (https://github.com/monk-time)
// @license       MIT; https://opensource.org/licenses/MIT
// @homepageURL   https://openuserjs.org/scripts/monk-time/IMDb_-_Clutter-less
// @updateURL     https://openuserjs.org/meta/monk-time/IMDb_-_Clutter-less.meta.js
// @include       http://*.imdb.com/*
// @include       https://*.imdb.com/*
// @require       https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @icon          http://www.imdb.com/favicon.ico
// @version       1.0.3
// ==/UserScript==

'use strict';

const globalElements = {
    shareButton: '.titleOverviewShareButton',
    watchlistButton: '.wlb-title-main-details', // Redundant button below a title description
    recommendations: '#titleRecs',
    videosPhotos: '#titleVideoStrip, #titleImageStrip',
    castPhotos: '.cast_list .primary_photo',
    contribute: '.contribute',
    footer: '#footer',
};
const sidebarBlocksGood = [
    'Related News', 'User Lists', 'User Polls', 'Quick Links',
    'Projects In Development', 'How Much Have You Seen?', 'Top-Rated Episodes',
];
const sidebarBlocksWithImgs = ['User Lists', 'User Polls'];

const $main = $('body #root');
const reMovie = /imdb\.com\/title\/tt\d+/;
const reName = /imdb\.com\/name\/nm\d+/;
const [isOnMoviePage, isOnNamePage] = [reMovie, reName]
    .map(re => re.test(document.location.href));

const actions = {
    hideGlobalElements() {
        for (const elem of Object.keys(globalElements)) {
            $main.find(globalElements[elem]).remove();
        }

        // an ad outside of $main
        $('#flashContent').remove();
        // IMDbPro button with a separator
        $main.find('.quicklink:contains("IMDbPro")').next().addBack().remove();
        // ad-like sections
        $main
            .find('.widget_header h3:contains("Comic-Con"), .pri_image')
            .parents('.article')
            .remove();
    },

    compactSidebar() {
        if (!isOnMoviePage && !isOnNamePage) {
            return;
        }

        const $blocks = $main
            .find('#sidebar, #maindetails_sidebar_bottom') // new-style, old-style
            .children();
        const getHeader = el => $(el).find('h3').text().trim();
        const isHeaderInGroup = (el, group) => group.includes(getHeader(el));
        const isGood = el => isHeaderInGroup(el, sidebarBlocksGood);
        const hasImgs = el => isHeaderInGroup(el, sidebarBlocksWithImgs);

        // remove all extra blocks
        $blocks
            .filter((_, el) => !isGood(el))
            .remove();
        // remove useless list images
        $blocks
            .filter((_, el) => hasImgs(el))
            .find('a > img[alt="list image"], a > img[alt="poll image"]')
            .parent()
            .hide() // can't chain after remove() (end() is unwieldy here)
            .parent('div') // only 'User Lists'
            .siblings()
            .css('margin-left', '4px');
    },
};

for (const key of Object.keys(actions)) {
    actions[key]();
}

console.log('IMDb has been cleaned up!');
