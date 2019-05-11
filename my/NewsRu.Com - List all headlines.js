// ==UserScript==
// @name        NewsRu.Com - List all headlines
// @namespace   monk-time
// @author      monk-time
// @include     http://classic.newsru.com/arch/*
// @icon        https://static.newsru.com/static/classic/v2/img/icons/favicon.ico
// ==/UserScript==

'use strict';

// ----- DATE MANIPULATION -----

const getCurrentDateAsStr = () => {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
};

const getDaysArray = (dateFrom, dateTo) => {
    const arr = [];
    const date = dateFrom;
    while (date <= dateTo) {
        arr.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }

    return arr;
};

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const convertDateToUrlPart = date => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    return `${day}${month}${date.getFullYear()}`;
};

const convertDateToHeader = date =>
    date.toLocaleString('ru', { weekday: 'long', day: 'numeric', month: 'long' });

// ----- FETCHING -----

const loadAllHeadlines = async (dateFrom, dateTo) => {
    if (dateFrom > dateTo) {
        console.error('The first date must be before the second date.');
        return '';
    }

    console.log(`Loading from "${dateFrom.toDateString()}" to "${dateTo.toDateString()}"`);
    const dates = getDaysArray(dateFrom, dateTo);
    const headlines = await Promise.all(dates.map(loadHeadlines));
    return templates.full(dates, headlines);
};

const sectionLabels = ['russia', 'world', 'finance'];
const sectionLabelsRu = ['В России', 'В мире', 'Экономика'];
const loadHeadlines = async date => {
    const dateStr = convertDateToUrlPart(date);
    const sectionUrls = sectionLabels.map(s => `http://classic.newsru.com/${s}/${dateStr}/`);
    const results = await Promise.all(sectionUrls.map(loadSection));
    console.log(`Loaded ${dateStr}`);
    return sectionLabels.reduce((obj, s, i) => ({ ...obj, [s]: results[i] }), {});
};

const parseHTML = html => new DOMParser().parseFromString(html, 'text/html');
const loadSection = async url => {
    const day = url.match(/\/0?(\d+)/)[1];
    const r = await fetch(url);
    return [...parseHTML(await r.text())
        .querySelectorAll('.index-news-item')]
        .map(extractHeadline)
        .filter(({ date }) => date.startsWith(`${day} `))
        .map(item => ({ ...item, time: item.date.slice(-5) }))
        .reverse();
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

// ----- TEMPLATES -----

document.head.insertAdjacentHTML('beforeend', `<style>
    #lah-main, #lah-main > input {
        font-size: 14px !important;
        font-family: Arial, Hevletica, sans-serif !important;
    }
    .lah-date:first-letter {
        text-transform: capitalize;
    }
    .lah-date {
        font-weight: bold;
        padding: 5px 0;
    }
    .lah-section {
        font-size: 12px;
        line-height: 16px;
        background-color: #CFD1E2;
        border-radius: 20px;
        padding: 5px 20px 5px 8px;
        width: 550px;
        margin-bottom: 8px;
        margin-left: 5px;
        display: grid;
        grid-template-columns: 40px 1fr;
        row-gap: 5px;
    }
    .lah-section-label {
        text-align: center;
        font-size: 13px;
        grid-column-start: 1;
        grid-column-end: 3;
    }
    .lah-time {
        color: #0016A6;
    }
    .lah-title {
        color: black;
        text-decoration: none;
    }
    </style>`);

const templates = {
    main: `
        <br>
        <div id="lah-main">
            <label for="start">Диапазон:</label>
            с <input type="date" id="lah-from"> по <input type="date" id="lah-to">
            <button id="lah-load-headers" type="button">Загрузить заголовки</button>
        </div>
    `,
    full: (dates, headlines) => `
        <div id="lah-full">
            ${dates.map((date, i) => templates.day(date, headlines[i])).join('')}
        </div>
    `,
    day: (date, sections) => `
        <div class="lah-day">
            <div class="lah-date">${convertDateToHeader(date)}</div>
            ${sectionLabels.map(key => templates.section(key, sections[key])).join('')}
        </div>
    `,
    section: (label, headlines) => `
        <div class="lah-section">
            <div class="lah-section-label">${sectionLabelsRu[sectionLabels.indexOf(label)]}</div>
            ${headlines.map(templates.headline).join('')}
        </div>
    `,
    headline: ({ time, url, text }) => `
        <div class="lah-time">${time}</div>
        <a href="${url}" class="lah-title">${text}</a>
    `,
};

// ----- MAIN -----

const main = () => {
    const page = document.querySelector('.content-column');
    page.innerHTML += templates.main;
    const [elFrom, elTo] = page.querySelectorAll('input[type=date]');
    elFrom.value = getCurrentDateAsStr();
    elTo.value = getCurrentDateAsStr();
    const button = document.querySelector('#lah-load-headers');
    button.addEventListener('click', async () => {
        const oldResults = page.querySelector('#lah-full');
        if (oldResults) {
            oldResults.remove();
        }

        const html = await loadAllHeadlines(elFrom.valueAsDate, elTo.valueAsDate);
        page.innerHTML += html;
    });
};

main();
