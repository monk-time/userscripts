// ==UserScript==
// @name        ICM - Ignore user comments
// @namespace   monk-time
// @author      monk-time
// @include     https://www.icheckmovies.com/movies/*/comments/
// @icon        https://www.icheckmovies.com/favicon.ico
// ==/UserScript==

'use strict';

document.querySelectorAll('.comment h3 > a[href*=mightysparks]')[0]
    .closest('.comment')
    .remove();
