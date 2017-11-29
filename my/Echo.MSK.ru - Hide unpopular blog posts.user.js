// ==UserScript==
// @name        Echo.MSK.ru - Hide unpopular blog posts
// @namespace   monk-time
// @author      monk-time
// @include     https://echo.msk.ru/blog/
// @include     https://echo.msk.ru/blog/*.html
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @icon        https://echo.msk.ru/favicon.ico
// ==/UserScript==

'use strict';

const minCommentsHighlight = 200;
const minComments = 50;
const minViews = 5000;

$('head').append(`
    <style>
        .preview .txt a:visited {
            color: #aaaaaa !important;
        }
        .prevcontent.popular-userjs {
            background-color: lightgoldenrodyellow;
        }
    </style>
`);

const hidePosts = () => {
    const $blocks = $('.mainpreview .preview.iblock');
    $blocks.filter((_, el) => {
        const $el = $(el);
        const views = +$el.find('.view > .count').text().trim();
        const comments = +$el.find('.comm > .count').text().trim();
        if (comments >= minCommentsHighlight) {
            $el.find('.prevcontent').addClass('popular-userjs');
        }

        return views < minViews && comments < minComments;
    }).remove();

    $(window).resize(); // trigger event to update page layout

    const countAll = $blocks.length;
    const countShown = $('.mainpreview .preview.iblock').length;
    $('h3').text(`Блоги (${countShown}/${countAll})`);
};

const addGoToNextDayButton = () => {
    const url = $('.time_title > .back').attr('href');
    const d = new Date(url.match(/[0-9-]+/));
    d.setDate(d.getDate() + 2);
    const newUrl = url.replace(/[0-9-]+/, d.toISOString().slice(0, 10));
    $('.time_title > .back')
        .clone()
        .insertAfter('.time_title > .back')
        .css('left', '3.2em')
        .attr('href', newUrl)
        .find('.wsico')
        .text(4);
};

hidePosts();
addGoToNextDayButton();
