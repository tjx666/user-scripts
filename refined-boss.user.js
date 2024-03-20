// ==UserScript==
// @name         重新定义Boss直聘
// @namespace    http://tampermonkey.net/
// @version      0.0.0
// @description  显示岗位最后修改时间，屏蔽不活跃岗位
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

    function getJobListUrls() {
        return window.performance
            .getEntries()
            .filter(
                (item) =>
                      item.name.includes('/joblist.json?'),
            )
            .map((item) => item.name);
    }

    /**
     * 翻页，搜索别的岗位都会请求 jobList
     */
    const listenUpdateJobList = (function () {
        const callbacks = [];
        let lastUpdateKey = '';

        function checkUpdate() {
            if (callbacks.length === 0) return;

            const jobListUrls = getJobListUrls();
            if (jobListUrls.length === 0) return;

            if (jobListUrls.at(-1) !== jobListUrls.at(-2)) {
                const updateKey = `${jobListUrls.at(-2)}->${jobListUrls.at(-1)}`;
                if (updateKey !== lastUpdateKey) {
                    (async function () {
                        const resp = await fetch(jobListUrls.at(-1));
                        const jobLists = (await resp.json()).zpData.jobList;
                        callbacks.forEach((cb) => cb(jobLists));
                    })();
                }
                lastUpdateKey = updateKey;
            }
        }

        (async function () {
            while (true) {
                checkUpdate();
                await sleep(100);
            }
        })();

        /**
         * @param {(jobList: any[]) => void} callback
         */
        return function (callback) {
            callbacks.push(callback);
            checkUpdate();
        };
    })();

    async function main() {
        listenUpdateJobList((jobList) => {
            const now = Date.now();
            const jobMap = jobList.reduce((map, cur) => {
                map.set(cur.encryptJobId, cur);
                return map;
            }, new Map());
            const jobCardLinks = document.querySelectorAll('a.job-card-left');
            for (const link of jobCardLinks) {
                const jobId = link.href.match(/job_detail\/(.*?)\.html/)?.[1];
                const job = jobMap.get(jobId);
                if (!job) continue;

                if(link.textContent.includes('继续沟通')){
                    link.parentNode.parentNode.remove();
                    return;
                }
                const duration = now - job.lastModifyTime;
                if (duration > month * 3) {
                    link.parentElement.parentElement.remove();
                    continue;
                }

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
