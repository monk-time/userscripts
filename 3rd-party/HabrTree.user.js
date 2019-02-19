// ==UserScript==
// @name           HabrTree
// @namespace      dotneter
// @author         dotneter, monk-time
// @include        https://habrahabr.ru/post/*
// @include        https://habrahabr.ru/company/*/blog/*
// @include        https://geektimes.ru/post/*
// @include        https://geektimes.ru/company/*/blog/*
// @include        https://habr.com/*/post/*
// @include        https://habr.com/company/*/blog/*
// @require        https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @icon           https://habrahabr.ru/favicon.ico
// ==/UserScript==

'use strict';

const autoSort = true;
const green = '#339900';
const red = '#CC0000';
const neutral = '#555555';

const sel = {
    score: 'span.voting-wjt__counter:first',
    comment: '.content-list__item_comment', // including replies
    comment_msg: '.comment__message:first',
    comment_replies: '.content-list_nested-comments:first:parent', // non-empty
    comment_itself: '.comment:first',
};

const getIntFromText = text => {
    if (!text) return 0;
    const [number] = /[+-]?\d+/.exec(text.replace('–', '-'));
    return parseInt(number, 10);
};

const getIntRating = el => getIntFromText($(el).find(sel.score).html());
const getRatingColor = rating => (rating < 0 ? red : rating === 0 ? neutral : green);

// ------

if (autoSort) {
    const $comments = $('#comments-list');
    $comments.children(sel.comment)
        .detach()
        .sort((a, b) => {
            const [rA, rB] = [a, b].map(getIntRating);
            return rB - rA;
        })
        .appendTo($comments);
}

// ------

const getRatings = () => $(sel.comment).get().map(getIntRating);
const count = arr => arr.reduce((cnt, el) => ({ ...cnt, [el]: (cnt[el] || 0) + 1 }), {});

const showRatings = () => {
    const counter = count(getRatings());
    const ratingsSorted = Object.keys(counter)
        .map(k => parseInt(k, 10))
        .sort((a, b) => b - a);
    if (!ratingsSorted.length) {
        return;
    }

    const $ratingsDiv = $('<div>');
    ratingsSorted.forEach(r => {
        const $anchor = $('<a>', { class: 'rating-link', href: '#', text: r })
            .css('color', getRatingColor(r));
        $anchor.click(() => {
            highlightRating(r);
            return false;
        });
        const text = counter[r] > 1 ? `(${counter[r]}) ` : ' ';
        $ratingsDiv.append($anchor, text);
    });

    $('#comments').prepend($ratingsDiv);
};

showRatings();

// ------

const highlightRating = min => {
    $('a.open-comment').remove();
    $(sel.comment).each(function () {
        const $comment = $(this);
        const $message = $comment.find(sel.comment_msg);
        const rating = getIntRating(this);
        if (rating >= min) {
            $message.show();
            $message.parents(`${sel.comment}.comment-closed`).each(function () {
                showMessage($(this));
            });
        } else {
            $comment.addClass('comment-closed');
            $message.hide();
            $comment.find(sel.comment_replies).hide();
            addOpenLink($comment);
        }
    });
};

const showMessage = $comment => {
    $comment.removeClass('comment-closed');
    $comment.find('a.open-comment:first').remove();
    $comment.find(sel.comment_msg).show();
    $comment.find(sel.comment_replies).show();
};

const addOpenLink = $comment => {
    const $target = $comment.find(sel.comment_itself);
    const $opener = $('<a>', { class: 'reply open-comment', href: '#', text: 'раскрыть' });
    $opener.click(() => {
        showMessage($comment);
        return false;
    });
    $target.append($opener);
};
