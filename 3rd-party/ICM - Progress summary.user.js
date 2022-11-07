// ==UserScript==
// @name         ICM - Progress summary
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       Onderhond for the base code, monk-time for code cleanup and debugging
// @match        https://*.icheckmovies.com/profiles/progress/*
// @grant        none
// ==/UserScript==

'use strict';

const limits = [1, 10, 100, 250, 500, 750, 1000, 1500, 2000, 3000];
const aim = 500;
const minimizeRealEstate = false;

const allRanksRaw = document.querySelectorAll('#progressall > li .rank a');
const allRanks = [...allRanksRaw].map(el => parseInt(el.innerHTML.slice(1), 10));
allRanks.sort((a, b) => a - b);
const allCount = allRanks.length;

const nf = Intl.NumberFormat();
const sumAimOvershoot = allRanks.filter(x => x > aim).map(x => x - aim).reduce((a, b) => a + b);
const sumRanks = allRanks.reduce((a, b) => a + b);

const results = limits.map(limit => {
    const firstIndexAbove = allRanks.findIndex(x => x > limit);
    const count = firstIndexAbove !== -1 ? firstIndexAbove : allRanks.length;
    return {
        limit,
        count,
        limitLabel: limit !== Infinity ? `T${limit}` : '',
        percentage: Math.round((count / allCount) * 100),
    };
});

const awardTypes = ['Platinum', 'Gold', 'Silver', 'Bronze'];
const awardCounts = awardTypes.map(type =>
    document.querySelectorAll(`#progressall .awardCutoff${type} .cutoff`).length);

const getHeader = ({ limit, limitLabel }) =>
    `<th ${limit === aim ? 'class="aim"' : ''}>${limitLabel}</th>`;
const getCell1 = ({ limit, count }) =>
    `<td ${limit === aim ? 'class="aim"' : ''}>${count}</td>`;
const getCell2 = ({ limit, percentage }) =>
    `<td ${limit === aim ? 'class="aim"' : ''}>${percentage}%</td>`;

const wrap = `
    <div class="ohWrap">
        <div class="ohExtraInfo">
            <div class="table">
                <div>
                    <table>
                        <thead>
                            <tr>${awardTypes.map(type => `<th>${type}</th>`).join('\n')}</tr>
                        </thead>
                        <tbody>
                            <tr>${awardCounts.map(count => `<td>${allCount - count}</td>`).join('\n')}</tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <div class="ohExtraInfo">
            <div class="table">
                <div>
                    <table>
                        <thead>
                            <tr>${results.map(getHeader).join('\n')}</tr>
                        </thead>
                        <tbody>
                            <tr>${results.map(getCell1).join('\n')}</tr>
                            <tr class="percentages">${results.map(getCell2).join('\n')}</tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="ohAll">
                <div>T${aim} overshoot: <b>${nf.format(sumAimOvershoot)}</b></div>
                <div>Sum of all ranks: <b>${nf.format(sumRanks)}</b></div>
            </div>
        </div>
    </div>
`;

const minimized = `
    <details>
        <summary><span>Progress data</span></summary>
        <div class="summaryDetails">${wrap}</div>
    </details>
`;

const html = `
    <div class="ohProgressData">
        ${minimizeRealEstate ? minimized : wrap}
    </div>
`;

const printExtraLocation = document.getElementById('progressFilter');
printExtraLocation.insertAdjacentHTML('beforebegin', html);

document.head.insertAdjacentHTML('beforeend', `
    <style>
        .ohProgressData { margin: 32px 0; }
        .ohExtraInfo { border: 4px solid #dee3d1; padding: 8px; border-radius: 16px; }
        .ohExtraInfo + .ohExtraInfo { margin-top: 12px; }
        .ohExtraInfo .table { border-radius: 8px; overflow: hidden; }
        .ohExtraInfo .table > div { margin: 0 -2px; }
        .ohExtraInfo table { border-spacing: 2px 0; margin: 0; }
        .ohExtraInfo table th { background: #dee3d1; padding: 0 8px; text-align: center; color: #567d68; }
        .ohExtraInfo table th.aim { background: #C02525; color: #fff; }
        .ohExtraInfo table td.aim { color: #C02525; font-weight: 700; }
        .ohExtraInfo table td { background: #fff; padding: 0 8px; text-align: center; }
        .spec { display: flex; margin: 4px 0; }
        .spec .label { font-weight: 700; flex-basis: 160px; }
        .ohExtraInfo tr.percentages { font-size: 12px; }
        .ohExtraInfo tr.percentages td { border-top: 1px solid #dee3d1; }
        .ohExtraInfo .ohAll { background: #fff; padding: 8px; border-radius: 8px; margin-top: 8px; }
        .ohExtraInfo .ohAll > * { display: inline-block; }
        .ohExtraInfo .ohAll > * + * { margin-left: 12px; }
        .ohExtraInfo .ohAll > * + *:before { content: "|"; margin-right: 12px; }
        .ohProgressData details summary { padding-bottom: 6px; border-bottom: 2px solid #567d68; }
        .ohProgressData details summary span { margin-left: 3px; font-size: 16px; color: #567d68; font-weight: 700; }
        .ohProgressData details .summaryDetails { padding-top: 16px; }
    </style>
`);
