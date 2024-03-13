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

    async function waitElement(selector, delay = 50) {
        let element = document.querySelector(selector);
        while (element === null) {
            await sleep(delay);
            element = document.querySelector(selector);
        }
        return element;
    }

    async function update() {
        await waitElement('.job-list-box');
        const jobCards = document.querySelectorAll('.job-card-wrapper');
        jobCards.forEach((card) => {
            const hunterIcon = card.querySelector('img.job-tag-icon');
            if (hunterIcon?.alt === '猎头') {
                card.remove();
            }
        });
    }

    (async function main() {
        await update();

        const searchResultDiv = document.querySelector('.search-job-result');
        if (searchResultDiv) {
            const observer = new MutationObserver((mutationsList) => {
                for (const mutation of mutationsList) {
                    if (mutation.type === 'childList') {
                        const firstAddNode = mutation.addedNodes[0];
                        if (
                            firstAddNode &&
                            firstAddNode.nodeName === 'UL' &&
                            firstAddNode.matches('.job-list-box')
                        ) {
                            update();
                        }
                    }
                }
            });
            observer.observe(searchResultDiv, { childList: true });
        }
    })();
})();
