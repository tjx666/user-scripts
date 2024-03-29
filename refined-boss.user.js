// ==UserScript==
// @name         重新定义Boss直聘
// @namespace    http://tampermonkey.net/
// @version      0.0.3
// @description  显示岗位最后修改时间，屏蔽，已沟通过，不活跃岗位
// @author       YuTengjing
// @supportURL   https://github.com/tjx666/user-scripts/issues
// @homepage     https://github.com/tjx666/user-scripts
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

    async function waitElements(selector, delay = 50) {
        let elements;
        while (true) {
            elements = document.querySelectorAll(selector);
            if (elements.length !== 0) {
                return elements;
            }
            await sleep(delay);
        }
    }

    const day = 1000 * 60 * 60 * 24;
    const week = day * 7;
    const month = week * 4;
    function humanizeDuration(ms) {
        if (ms <= day) {
            return '一天内';
        } else if (ms <= day * 3) {
            return '三天内';
        } else if (ms <= week) {
            return '本周内';
        } else if (ms <= week * 2) {
            return '两周内';
        } else if (ms <= month) {
            return '本月内';
        } else if (ms <= month * 3) {
            return '最近三个月';
        } else {
            return '超过三个月';
        }
    }

    function getDurationColor(ms) {
        if (ms <= week) return '#fe574a';
        else if (ms <= month) return '#40b14f';
        else return '#666';
    }

    function getFetchJobListBaseUrl() {
        return window.performance
            .getEntries()
            .filter((item) => item.name.includes('/joblist.json?'))[0]?.name;
    }

    /**
     * 翻页，搜索别的岗位都会请求 jobList
     */
    const listenUpdateJobList = (function () {
        const callbacks = [];
        let fetchJobListBaseUrl;

        async function publishUpdate() {
            if (callbacks.length === 0) return;

            // location url params -> fetchJobListParams
            const keyMap = {
                areaBusiness: 'multiBusinessDistrict',
            };
            const baseUrlObj = new URL(fetchJobListBaseUrl);
            const fetchJobListParams = baseUrlObj.searchParams;
            const locationParams = new URLSearchParams(location.search);
            for (const [key, value] of locationParams.entries()) {
                fetchJobListParams.set(keyMap[key] ?? key, value);
            }

            const fetchJobListUrl = baseUrlObj.toString();
            const resp = await fetch(fetchJobListUrl);

            const jobLists = (await resp.json()).zpData.jobList;
            callbacks.forEach((cb) => cb(jobLists));
        }

        (async function pollBaseFetchJobListUrl() {
            while (true) {
                fetchJobListBaseUrl = getFetchJobListBaseUrl();
                if (fetchJobListBaseUrl) {
                    publishUpdate();

                    // monitor location url change
                    let lastUrl = location.href;
                    (async function () {
                        while (true) {
                            const currentUrl = location.href;
                            if (currentUrl !== lastUrl) {
                                publishUpdate();
                                lastUrl = currentUrl;
                            }
                            await sleep(100);
                        }
                    })();

                    return;
                }

                await sleep(32);
            }
        })();

        /**
         * @param {(jobList: any[]) => void} callback
         */
        return function (callback) {
            callbacks.push(callback);
        };
    })();

    async function main() {
        listenUpdateJobList(async (jobList) => {
            const now = Date.now();
            const jobMap = jobList.reduce((map, cur) => {
                map.set(cur.encryptJobId, cur);
                return map;
            }, new Map());
            const jobCardLinks = await waitElements('a.job-card-left');

            for (const link of jobCardLinks) {
                const jobId = link.href.match(/job_detail\/(.*?)\.html/)?.[1];
                const job = jobMap.get(jobId);
                if (!job) continue;

                // 屏蔽已沟通过的岗位
                if (link.textContent.includes('继续沟通')) {
                    link.parentNode.parentNode.remove();
                    continue;
                }

                // 屏蔽不活跃岗位
                const duration = now - job.lastModifyTime;
                if (duration > month * 3) {
                    link.parentElement.parentElement.remove();
                    continue;
                }

                // 屏蔽外包岗位
                const outsourcingKeywords = ['外包', '外派'];
                if (outsourcingKeywords.some((keyword) => job.jobName.includes(keyword))) {
                    link.parentElement.parentElement.remove();
                    continue;
                }

                // 显示岗位最后修改时间
                const jobTitle = link.querySelector('.job-title');
                const modDateSpan = document.createElement('span');
                modDateSpan.className = 'mod-date';
                modDateSpan.innerHTML = '&emsp;' + humanizeDuration(duration);
                modDateSpan.style = `font-size: 13px; font-weight: normal; color: ${getDurationColor(
                    duration,
                )};`;
                jobTitle.append(modDateSpan);
            }
        });
    }

    main();
})();
