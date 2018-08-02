// ==UserScript==
// @name        NewsRu.Com - Fetch all daily headlines
// @namespace   monk-time
// @author      monk-time
// @include     /^http://classic\.newsru\.com/main/\d+[a-z]+\d{4}/$/
// @icon        https://static.newsru.com/static/classic/v2/img/icons/favicon.ico
// ==/UserScript==

'use strict';

const replace = async section => {
    const headlines = await fetchHeadlines(getSectionUrl(section));
    const newslist = section.querySelector('.newslist');
    console.log(`Replacing ${newslist.children.length} items with ${headlines.length}`);
    newslist.innerHTML = headlines.map(fillTemplate).join('\n');
};

const today = document.URL.match(/\/0?(\d+)/)[1];
const parseHTML = html => new DOMParser().parseFromString(html, 'text/html');
const getSectionUrl = section => section.querySelector('.top-corner-link').href;
const fetchHeadlines = async url => {
    const r = await fetch(url);
    return [...parseHTML(await r.text())
        .querySelectorAll('.index-news-item')]
        .map(extractHeadline)
        .filter(({ date }) => date.startsWith(`${today} `))
        .map(item => ({ ...item, date: item.date.slice(-5) }));
};

const extractHeadline = el => {
    const date = el.querySelector('.index-news-date').textContent.trim();
    const a = el.querySelector('.index-news-title');
    return {
        date,
        url: a.href,
        text: a.textContent.trim(),
    };
};

const fillTemplate = ({ date, url, text }) => `
    <div class="newslistitem">
        <div class="newslistdate">${date}</div>
        <a href="${url}" class="newslisttitle">${text}</a>
    </div>
`;

const sections = [...document.querySelectorAll('.sect-ttl')].slice(0, 3);
sections.forEach(replace);
