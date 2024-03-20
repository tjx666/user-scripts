// ==UserScript==
// @name         Boss屏蔽已沟通岗位
// @namespace    http://tampermonkey.net/
// @version      0.0.1
// @description  基于https://greasyfork.org/zh-CN/scripts/486545-boss%E7%9B%B4%E8%81%98%E4%BF%A1%E6%81%AF%E9%80%8F%E5%87%BA 修改，屏蔽已沟通职位
// @author       Maziyo
// @match        https://www.zhipin.com/web/geek/job*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=zhipin.com
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js
// ==/UserScript==

(function () {
  "use strict";
  const dayjs = window.dayjs;

  class Store {
    constructor() {
      this.store = {
        name: "BossOk",
        jobListReqs: [],
        jobMap: {},
      };
    }
    set(key, value) {
      this.store[key] = value;
    }
    get(key) {
      return this.store[key];
    }
    bgColor(diffday) {
        if (diffday > 90) return "transparent";
        if (diffday > 30) return "#e8f7d8";
        if (diffday > 7) return "#f7e4d8";
        return "#f7d8d8";
    }
  }

  const store = new Store();

  function log(message) {
    console.log(`[${store.get("name")}]`, message);
  }

  function onFetchJoblist(data) {
    log(data);
    const jobList = data?.zpData?.jobList;
    const jobMap = jobList.reduce((acc, cur) => {
      acc[cur.encryptJobId] = cur;
      return acc;
    }, store.get("jobMap") || {});
    store.set("jobMap", jobMap);

    const $a = document.querySelectorAll("a[href]");
    $a.forEach((dom) => {
      const href = dom.getAttribute("href");
      const jobId = href.match(/job_detail\/(.*?)\.html/)?.[1];
      // 已经添加过的不再添加
      if (!jobId) return;
      

      // 除去已经沟通过的
      if(dom.textContent.includes('继续沟通')){
        dom.parentNode.parentNode.remove();
        return;
      }
      const attrKey = store.get("name").toLowerCase();
      if (dom.parentNode.querySelector(`[${attrKey}]`)){return;}
      const job = jobMap[jobId];
      if (!job) return;
      const { lastModifyTime } = job;
      const infodom = document.createElement("div");
      const diffday = -dayjs(lastModifyTime).diff(dayjs(), "day");
      infodom.innerHTML = `📅 最后更新日期：${dayjs(lastModifyTime).format(
        "YYYY-MM-DD"
      )} (${diffday}天前)`;
      infodom.style = `padding: 10px;background: ${store.bgColor(diffday)};`;
      infodom.setAttribute(attrKey, jobId);
      dom.parentNode.appendChild(infodom);
    });
  }

  function updateJoblistReqs() {
    const urls = window.performance
      .getEntries()
      .filter((item) => item.name.includes("joblist.json?"))
      ?.map((item) => item.name);
    store.set("jobListReqs", urls);
    return urls;
  }


  function update () {
    const now_urls = updateJoblistReqs();
    // 当客户端发起新请求时
    if (now_urls[now_urls.length - 1] != now_urls[now_urls.length - 2]) {
      const url = now_urls[now_urls.length - 1];
      window.fetch(url).then((res) => {
        res.json().then((data) => {
          onFetchJoblist(data);
          setTimeout(() => {
            update();
          }, 5000);
        });
      });
    } else {
        setTimeout(() => {
            update();
        }, 3000);
    }
  }

  update()

})();
