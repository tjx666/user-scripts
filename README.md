# User Scripts

自用的一些油猴脚本

## 脚本列表

| 脚本名                                         | 描述                                                                             | 从 GitHub 安装               | 从 GreasyFork 安装           |
| ---------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------- | ---------------------------- |
| [屏蔽 Boss 直聘猎头岗位][bh-github]            | 可以在`隐私保护` -> `屏蔽职位`里面设置不显示猎头岗位，但是有时候发现设置不生效   | [Install][bh-github-raw]     | [Install][bh-greasyfork]     |
| [重新定义 Boss 直聘][rb-github]                | 显示岗位最后修改时间，屏蔽已沟通过，不活跃的, 以及外包岗位                       | [Install][rb-github-raw]     | [Install][rb-greasyfork]     |
| [github-release-assets-recommend][grar-github] | 基于用户平台（操作系统+架构）智能推荐 GitHub Release 文件，支持中英文自动切换    | [Install][grar-github-raw]   | [Install][grar-greasyfork]   |
| [GitHub Actions 步骤日志复制][gacsl-github]    | 在 Actions Job 页面 hover 步骤标题显示复制按钮，自动展开并滚动加载完整日志后复制 | [Install][gacsl-github-raw]  | [Install][gacsl-greasyfork]  |
| [优化 GitHub 评论显示 (TJ)][rgc-tj-github]     | 折叠机器人评论和重复内容，清理评论视图杂乱信息。基于 [bluwy][bluwy-original]     | [Install][rgc-tj-github-raw] | [Install][rgc-tj-greasyfork] |

[bh-github]: https://github.com/tjx666/user-scripts/blob/main/block-hunter.user.js
[bh-github-raw]: https://raw.githubusercontent.com/tjx666/user-scripts/main/block-hunter.user.js
[bh-greasyfork]: https://greasyfork.org/zh-CN/scripts/489722-%E5%B1%8F%E8%94%BD-boss-%E7%9B%B4%E8%81%98%E7%8C%8E%E5%A4%B4%E5%B2%97%E4%BD%8D
[rb-github]: https://github.com/tjx666/user-scripts/blob/main/refined-boss.user.js
[rb-github-raw]: https://raw.githubusercontent.com/tjx666/user-scripts/main/refined-boss.user.js
[rb-greasyfork]: https://greasyfork.org/zh-CN/scripts/489794-%E9%87%8D%E6%96%B0%E5%AE%9A%E4%B9%89boss%E7%9B%B4%E8%81%98
[grar-github]: https://github.com/tjx666/user-scripts/blob/main/github-release-assets-recommend.user.js
[grar-github-raw]: https://raw.githubusercontent.com/tjx666/user-scripts/main/github-release-assets-recommend.user.js
[rgc-tj-github]: https://github.com/tjx666/user-scripts/blob/main/refined-gitHub-comments-tj.user.js
[rgc-tj-github-raw]: https://raw.githubusercontent.com/tjx666/user-scripts/main/refined-gitHub-comments-tj.user.js
[grar-greasyfork]: https://update.greasyfork.org/scripts/548506/github-release-assets-recommend.user.js
[rgc-tj-greasyfork]: https://update.greasyfork.org/scripts/548507/Refined%20GitHub%20Comments%20%28TJ%29.user.js
[bluwy-original]: https://github.com/bluwy/refined-github-comments
[gacsl-github]: https://github.com/tjx666/user-scripts/blob/main/github-actions-copy-logs.user.js
[gacsl-github-raw]: https://raw.githubusercontent.com/tjx666/user-scripts/main/github-actions-copy-logs.user.js
[gacsl-greasyfork]: https://update.greasyfork.org/scripts/548508/github-actions-copy-logs.user.js

## 致谢

- [Aloea](https://blog.liluhui.cn) 的脚本 [BOSS 直聘信息透出](https://greasyfork.org/zh-CN/scripts/486545-boss%E7%9B%B4%E8%81%98%E4%BF%A1%E6%81%AF%E9%80%8F%E5%87%BA)
  提供获取岗位信息的思路
- [bluwy](https://github.com/bluwy) 的 [Refined GitHub Comments](https://github.com/bluwy/refined-github-comments) 脚本
  为 GitHub 评论优化提供了基础思路和代码实现
