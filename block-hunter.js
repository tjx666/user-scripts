// ==UserScript==
// @name         屏蔽 Boss 直聘猎头岗位
// @namespace    http://tampermonkey.net/
// @version      2024-03-13
// @description  boos 上现在猎头的的岗位太多了，直接屏蔽所有猎头的岗位
// @author       You
// @match        https://www.zhipin.com/web/geek/job*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=zhipin.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    async function sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(() => resolve(), ms);
        });
    }

    async function waitElement(selector) {
        while (document.querySelector(selector) === null) {
            await sleep(50);
        }
    }

    (async function main() {
        await waitElement('.job-list-box');
        const jobCards = document.querySelectorAll('.job-card-wrapper');
        jobCards.forEach((card) => {
            const hunterIcon = card.querySelector('img.job-tag-icon');
            if (hunterIcon?.alt === '猎头') {
                card.remove();
            }
        });
    })();
})();
