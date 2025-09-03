// ==UserScript==
// @name         Refined GitHub Comments
// @license      MIT
// @homepageURL  https://github.com/bluwy/refined-github-comments
// @supportURL   https://github.com/bluwy/refined-github-comments
// @namespace    https://greasyfork.org/en/scripts/465056-refined-github-comments
// @version      0.2.2
// @description  Remove clutter in the comments view
// @author       Bjorn Lu
// @match        https://github.com/**
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.com
// @grant        none
// ==/UserScript==

// #region User settings

// common bots that i already know what they do
const authorsToMinimize = [
    'changeset-bot',
    'codeflowapp',
    'netlify',
    'vercel',
    'pkg-pr-new',
    'codecov',
    'astrobot-houston',
    'codspeed-hq',
];

// common comments that don't really add value
const commentMatchToMinimize = [
    /^![a-z]/, // commands that start with !
    /^\/[a-z]/, // commands that start with /
    /^> root@0.0.0/, // astro preview release bot
];

// #endregion

// #region Run code

// Used by `minimizeDiscussionThread`
let expandedThread = false;
const maxParentThreadHeight = 185;

(function () {
    'use strict';

    run();

    // listen to github page loaded event
    document.addEventListener('pjax:end', () => run());
    document.addEventListener('turbo:render', () => run());
})();

function run() {
    // Comments view
    const allTimelineItem = document.querySelectorAll('.js-timeline-item');
    const seenComments = [];

    allTimelineItem.forEach((timelineItem) => {
        minimizeComment(timelineItem);
        minimizeBlockquote(timelineItem, seenComments);
    });

    // Discussion threads view
    if (location.pathname.includes('/discussions/')) {
        minimizeDiscussionThread();
    }
}

// #endregion

// #region Features: minimize comment

// test urls:
// https://github.com/withastro/astro/pull/6845
/**
 * @param {HTMLElement} timelineItem
 */
function minimizeComment(timelineItem) {
    // things can happen twice in github for some reason
    if (timelineItem.querySelector('.refined-github-comments-toggle')) return;

    const header = timelineItem.querySelector('.timeline-comment-header');
    if (!header) return;

    const headerName = header.querySelector('a.author');
    if (!headerName) return;

    const commentBody = timelineItem.querySelector('.comment-body');
    if (!commentBody) return;

    const commentBodyText = commentBody.innerText.trim();

    // minimize the comment
    if (
        authorsToMinimize.includes(headerName.innerText) ||
        commentMatchToMinimize.some((match) => match.test(commentBodyText))
    ) {
        const commentContent = timelineItem.querySelector('.edit-comment-hide');
        if (!commentContent) return;
        const commentActions = timelineItem.querySelector('.timeline-comment-actions');
        if (!commentActions) return;
        const headerH3 = header.querySelector('h3');
        if (!headerH3) return;
        const headerDiv = headerH3.querySelector('div');
        if (!headerDiv) return;

        // hide comment
        header.style.borderBottom = 'none';
        commentContent.style.display = 'none';

        // add comment excerpt
        const excerpt = document.createElement('span');
        excerpt.setAttribute(
            'class',
            'text-fg-muted text-normal text-italic css-truncate css-truncate-overflow mr-2',
        );
        excerpt.innerHTML = commentBodyText.slice(0, 100);
        excerpt.style.opacity = '0.5';
        headerH3.classList.add('css-truncate', 'css-truncate-overflow');
        headerDiv.appendChild(excerpt);

        // add toggle button
        const toggleBtn = toggleComment((isShow) => {
            // headerH3 class needs to be toggled too so that the "edited dropdown" can be toggled
            if (isShow) {
                headerH3.classList.remove('css-truncate', 'css-truncate-overflow');
                header.style.borderBottom = '';
                commentContent.style.display = '';
                excerpt.style.display = 'none';
            } else {
                headerH3.classList.add('css-truncate', 'css-truncate-overflow');
                header.style.borderBottom = 'none';
                commentContent.style.display = 'none';
                excerpt.style.display = '';
            }
        });
        commentActions.prepend(toggleBtn);
    }
}

// #endregion

// #region Features: minimize blockquote

// test urls:
// https://github.com/bluwy/refined-github-comments/issues/1
// https://github.com/sveltejs/svelte/issues/2323
// https://github.com/pnpm/pnpm/issues/6463
/**
 * @param {HTMLElement} timelineItem
 * @param {{ text: string, id: string, author: string }[]} seenComments
 */
function minimizeBlockquote(timelineItem, seenComments) {
    const commentBody = timelineItem.querySelector('.comment-body');
    if (!commentBody) return;

    const commentId = timelineItem.querySelector('.timeline-comment-group')?.id;
    if (!commentId) return;

    const commentAuthor = timelineItem.querySelector(
        '.timeline-comment-header a.author',
    )?.innerText;
    if (!commentAuthor) return;

    const commentText = commentBody.innerText.trim().replace(/\s+/g, ' ');

    // bail early in first comment and if comment is already checked before
    if (
        seenComments.length === 0 ||
        commentBody.querySelector('.refined-github-comments-reply-text')
    ) {
        seenComments.push({
            text: commentText,
            id: commentId,
            author: commentAuthor,
        });
        return;
    }

    const blockquotes = commentBody.querySelectorAll(':scope > blockquote');
    for (const blockquote of blockquotes) {
        const blockquoteText = blockquote.innerText.trim().replace(/\s+/g, ' ');

        const dupIndex = seenComments.findIndex((comment) => comment.text === blockquoteText);
        if (dupIndex >= 0) {
            const dup = seenComments[dupIndex];
            // if replying to the one above, always minimize it
            if (dupIndex === seenComments.length - 1) {
                // use span.js-clear so github would remove this summary when re-quoting this reply,
                // add nbsp so that the summary tag has some content, that the details would also
                // get copied when re-quoting too.
                const summary = `\
  <span class="js-clear text-italic refined-github-comments-reply-text">
    Replying to <strong>@${dup.author}</strong> above
  </span>&nbsp;`;
                blockquote.innerHTML = `<details><summary>${summary}</summary>${blockquote.innerHTML}</details>`;
            }
            // if replying to a long comment, or a comment with code, always minimize it
            else if (blockquoteText.length > 200 || blockquote.querySelector('pre')) {
                // use span.js-clear so github would remove this summary when re-quoting this reply,
                // add nbsp so that the summary tag has some content, that the details would also
                // get copied when re-quoting too.
                const summary = `\
  <span class="js-clear text-italic refined-github-comments-reply-text">
    Replying to <strong>@${dup.author}</strong>'s <a href="#${dup.id}">comment</a>
  </span>&nbsp;`;
                blockquote.innerHTML = `<details><summary>${summary}</summary>${blockquote.innerHTML}</details>`;
            }
            // otherwise, just add a hint so we don't have to navigate away a short sentence
            else {
                // use span.js-clear so github would remove this hint when re-quoting this reply
                const hint = `\
  <span dir="auto" class="js-clear text-italic refined-github-comments-reply-text" style="display: block; margin-top: -0.5rem; opacity: 0.7; font-size: 90%;">
    — <strong>@${dup.author}</strong> said in <a href="#${dup.id}">comment</a>
  </span>`;
                blockquote.insertAdjacentHTML('beforeend', hint);
            }
            continue;
        }

        const partialDupIndex = seenComments.findIndex((comment) =>
            comment.text.includes(blockquoteText),
        );
        if (partialDupIndex >= 0) {
            const dup = seenComments[partialDupIndex];
            // get first four words and last four words, craft a text fragment to highlight
            const splitted = blockquoteText.split(' ');
            const textFragment =
                splitted.length < 9
                    ? `#:~:text=${encodeURIComponent(blockquoteText)}`
                    : `#:~:text=${encodeURIComponent(
                          splitted.slice(0, 4).join(' '),
                      )},${encodeURIComponent(splitted.slice(-4).join(' '))}`;

            // if replying to the one above, prepend hint
            if (partialDupIndex === seenComments.length - 1) {
                // use span.js-clear so github would remove this hint when re-quoting this reply
                const hint = `\
  <span dir="auto" class="js-clear text-italic refined-github-comments-reply-text" style="display: block; margin-top: -0.5rem; opacity: 0.7; font-size: 90%;">
    — <strong>@${dup.author}</strong> <a href="${textFragment}">said</a> above
  </span>`;
                blockquote.insertAdjacentHTML('beforeend', hint);
            }
            // prepend generic hint
            else {
                // use span.js-clear so github would remove this hint when re-quoting this reply
                const hint = `\
  <span dir="auto" class="js-clear text-italic refined-github-comments-reply-text" style="display: block; margin-top: -0.5rem; opacity: 0.7; font-size: 90%;">
    — <strong>@${dup.author}</strong> <a href="${textFragment}">said</a> in <a href="#${dup.id}">comment</a>
  </span>`;
                blockquote.insertAdjacentHTML('beforeend', hint);
            }
        }
    }

    seenComments.push({ text: commentText, id: commentId, author: commentAuthor });
}

// #endregion

// #region Features: minimize discussion threads

// test urls:
// https://github.com/vitejs/vite/discussions/18191
function minimizeDiscussionThread() {
    if (expandedThread) {
        _minimizeDiscussionThread();
        return;
    }

    const discussionContainer = document.querySelector(
        '.discussion.js-discussion > .js-timeline-marker',
    );
    if (!discussionContainer) return;

    const tripleDotMenuContainer = document.querySelector('.timeline-comment-actions');
    if (!tripleDotMenuContainer) return;

    // Skip if already added
    if (document.getElementById('refined-github-comments-expand-btn') != null) return;

    tripleDotMenuContainer.style.display = 'flex';
    tripleDotMenuContainer.style.alignItems = 'center';

    // Create a "Collapse threads" button to enable this feature
    const expandBtn = document.createElement('button');
    expandBtn.id = 'refined-github-comments-expand-btn';
    expandBtn.setAttribute(
        'class',
        'Button--iconOnly Button--invisible Button--medium Button mr-2',
    );
    expandBtn.innerHTML = `\
  <svg class="Button-visual octicon octicon-zap" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
    <path d="M9.504.43a1.516 1.516 0 0 1 2.437 1.713L10.415 5.5h2.123c1.57 0 2.346 1.909 1.22 3.004l-7.34 7.142a1.249 1.249 0 0 1-.871.354h-.302a1.25 1.25 0 0 1-1.157-1.723L5.633 10.5H3.462c-1.57 0-2.346-1.909-1.22-3.004L9.503.429Zm1.047 1.074L3.286 8.571A.25.25 0 0 0 3.462 9H6.75a.75.75 0 0 1 .694 1.034l-1.713 4.188 6.982-6.793A.25.25 0 0 0 12.538 7H9.25a.75.75 0 0 1-.683-1.06l2.008-4.418.003-.006a.036.036 0 0 0-.004-.009l-.006-.006-.008-.001c-.003 0-.006.002-.009.004Z"></path>
  </svg>
  `;
    expandBtn.title = 'Collapse threads';
    expandBtn.addEventListener('click', () => {
        expandedThread = true;
        _minimizeDiscussionThread();
        expandBtn.remove();
    });
    tripleDotMenuContainer.prepend(expandBtn);
}

function _minimizeDiscussionThread() {
    const timelineComments = document.querySelectorAll(
        '.timeline-comment.comment:not(.nested-discussion-timeline-comment)',
    );
    for (const timelineComment of timelineComments) {
        // Skip if already handled
        if (timelineComment.querySelector('.refined-github-comments-toggle')) continue;

        const parentThreadContent = timelineComment.children[1];
        if (!parentThreadContent) continue;

        // Find the "N replies" bottom text (a bit finicky but seems like the best selector)
        const bottomText = parentThreadContent.querySelector('span.color-fg-muted.no-wrap');
        const childrenThread = timelineComment.querySelector('[data-child-comments]');
        // Skip if 0 replies
        if (bottomText && childrenThread && /\d+/.exec(bottomText.textContent)?.[0] !== '0') {
            // Prepend a "expand thread" button
            // const expandBtn = document.createElement('button')
            // expandBtn.setAttribute('class', 'Button--secondary Button--small Button')
            // expandBtn.innerHTML = 'Expand thread'
            // expandBtn.addEventListener('click', () => {
            //   threadComment.style.display = ''
            //   bottomText.style.display = 'none'
            // })
            const toggleBtn = toggleComment((isShow) => {
                // Re-query as GitHub may update it when , e.g. showing more comments
                const childrenThreadAgain = timelineComment.querySelector('[data-child-comments]');
                if (childrenThreadAgain) {
                    if (isShow) {
                        childrenThreadAgain.style.display = '';
                        bottomText.classList.add('color-fg-muted');
                    } else {
                        childrenThreadAgain.style.display = 'none';
                        bottomText.classList.remove('color-fg-muted');
                    }
                }
            });
            bottomText.parentElement.insertBefore(toggleBtn, bottomText);
            childrenThread.style.display = 'none';
            bottomText.classList.remove('color-fg-muted');
            // Lazy to make the bottom text a button, share the click event to the button for now
            // NOTE: This click happens to expand the comment too. I'm not sure how to prevent that.
            bottomText.addEventListener('click', () => {
                toggleBtn.click();
            });
        }

        const commentBody = parentThreadContent.querySelector('.comment-body');
        if (commentBody && commentBody.clientHeight > maxParentThreadHeight) {
            // Shrink the OP thread to max height
            const css = `max-height:${maxParentThreadHeight}px;mask-image:linear-gradient(180deg, #000 80%, transparent);-webkit-mask-image:linear-gradient(180deg, #000 80%, transparent);`;
            commentBody.style.cssText += css;
            // Add "view"
            const commentActions = timelineComment.querySelector('.timeline-comment-actions');
            const toggleCommentBodyBtn = toggleComment((isShow) => {
                if (isShow) {
                    commentBody.style.maxHeight = '';
                    commentBody.style.maskImage = '';
                    commentBody.style.webkitMaskImage = '';
                } else {
                    commentBody.style.cssText += css;
                }
            });
            commentActions.style.display = 'flex';
            commentActions.style.alignItems = 'center';
            commentActions.prepend(toggleCommentBodyBtn);
            // Auto-expand on first click for nicer UX
            commentBody.addEventListener('click', () => {
                if (toggleCommentBodyBtn.dataset.show === 'false') {
                    toggleCommentBodyBtn.click();
                }
            });
        }
    }
}

// #endregion

// #region Utilities

// create the toggle comment like github does when you hide a comment
function toggleComment(onClick) {
    const btn = document.createElement('button');
    // copied from github hidden comment style
    btn.innerHTML = `
  <div class="color-fg-muted f6 no-wrap">
    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-unfold position-relative">
    <path d="m8.177.677 2.896 2.896a.25.25 0 0 1-.177.427H8.75v1.25a.75.75 0 0 1-1.5 0V4H5.104a.25.25 0 0 1-.177-.427L7.823.677a.25.25 0 0 1 .354 0ZM7.25 10.75a.75.75 0 0 1 1.5 0V12h2.146a.25.25 0 0 1 .177.427l-2.896 2.896a.25.25 0 0 1-.354 0l-2.896-2.896A.25.25 0 0 1 5.104 12H7.25v-1.25Zm-5-2a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5ZM6 8a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5A.75.75 0 0 1 6 8Zm2.25.75a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5ZM12 8a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5A.75.75 0 0 1 12 8Zm2.25.75a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5Z"></path>
    </svg>
  </div>
  <div class="color-fg-muted f6 no-wrap" style="display: none">
    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-fold position-relative">
      <path d="M10.896 2H8.75V.75a.75.75 0 0 0-1.5 0V2H5.104a.25.25 0 0 0-.177.427l2.896 2.896a.25.25 0 0 0 .354 0l2.896-2.896A.25.25 0 0 0 10.896 2ZM8.75 15.25a.75.75 0 0 1-1.5 0V14H5.104a.25.25 0 0 1-.177-.427l2.896-2.896a.25.25 0 0 1 .354 0l2.896 2.896a.25.25 0 0 1-.177.427H8.75v1.25Zm-6.5-6.5a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5ZM6 8a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5A.75.75 0 0 1 6 8Zm2.25.75a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5ZM12 8a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5A.75.75 0 0 1 12 8Zm2.25.75a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5Z"></path>
    </svg>
  </div>
  `;
    const showNode = btn.querySelector('div:nth-child(1)');
    const hideNode = btn.querySelector('div:nth-child(2)');
    let isShow = false;
    btn.setAttribute('type', 'button');
    btn.setAttribute('class', 'refined-github-comments-toggle timeline-comment-action btn-link');
    btn.dataset.show = isShow;
    btn.addEventListener('click', () => {
        isShow = !isShow;
        btn.dataset.show = isShow;
        if (isShow) {
            showNode.style.display = 'none';
            hideNode.style.display = '';
        } else {
            showNode.style.display = '';
            hideNode.style.display = 'none';
        }
        onClick(isShow);
    });
    return btn;
}

// #endregion
