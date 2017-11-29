// ==UserScript==
// @name           OpenSubtitles - Direct download
// @description    Turn the big download button into a direct URL
// @namespace      monk-time
// @author         monk-time
// @include        http://www.opensubtitles.org/*/subtitles/*
// @include        https://www.opensubtitles.org/*/subtitles/*
// @icon           https://static.opensubtitles.org/favicon.ico
// ==/UserScript==

'use strict';

const modifyButton = () => {
    const directUrl = document.querySelector('#moviehash > a.none').href;
    const button = document.querySelector('#bt-dwl-bt');
    button.href = directUrl;
    button.text += ' (clean)';
    button.removeAttribute('onclick');
    // Cloning the element to get rid of all event listeners
    const clone = button.cloneNode(true);
    button.parentNode.replaceChild(clone, button);
};

// Wait until all site scripts are loaded
const checkLoaded = (iteration = 0) => {
    if (iteration >= 20) return;
    if (!document.body.innerHTML.includes('product_download_url')) {
        setTimeout(checkLoaded, 500, iteration + 1);
    } else {
        modifyButton();
    }
};

checkLoaded();
