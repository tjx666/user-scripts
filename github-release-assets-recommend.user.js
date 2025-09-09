// ==UserScript==
// @name         github-release-assets-recommend
// @namespace    https://github.com/tjx666/user-scripts
// @version      0.5.1
// @description  Highlights compatible assets in GitHub release pages based on your platform (auto language detection)
// @author       yutengjing
// @match        https://github.com/*/releases/tag/*
// @match        https://github.com/*/releases/latest
// @grant        none
// @homepageURL  https://github.com/tjx666/user-scripts
// @supportURL   https://github.com/tjx666/user-scripts/issues
// ==/UserScript==

(function () {
    'use strict';

    // ==================== 配置常量 ====================

    /**
     * 调试开关，设为 true 启用日志输出
     */
    const DEBUG = true;

    /**
     * 语言检测 - 支持中文和英文
     */
    const isZhCN =
        navigator.language.startsWith('zh') ||
        document.documentElement.lang.startsWith('zh') ||
        document.querySelector('html[lang*="zh"]') !== null;

    /**
     * 多语言文本配置
     */
    const LABELS = isZhCN
        ? {
              recommended: '推荐',
              compatible: '兼容',
              tooltips: {
                  recommended: '完美匹配您的设备',
                  compatible: '与您的设备兼容，但可能不是最优选择',
              },
          }
        : {
              recommended: 'Recommended',
              compatible: 'Compatible',
              tooltips: {
                  recommended: 'Perfect match for your device',
                  compatible: 'Compatible with your device',
              },
          };

    /**
     * 优先级分数配置
     */
    const PRIORITY = {
        PREFERRED_FORMAT: 250, // OS + 架构 + 首选格式完全匹配
        PERFECT_MATCH: 200, // OS + 架构完全匹配
        OS_MATCH: 100, // 仅OS匹配
        ARCH_MATCH: 50, // 仅架构匹配
        NO_MATCH: 0, // 不匹配
        AUXILIARY_FILE: -1000, // 辅助文件（不显示）
    };

    /**
     * 文件扩展名匹配配置
     */
    const EXTENSIONS = {
        macos: ['.dmg', '.pkg', '.zip'],
        windows: ['.exe', '.msi', '.zip'],
        linux: ['.AppImage', '.deb', '.rpm', '.tar.gz', '.snap', '.flatpak', '.zip'],
    };

    /**
     * 各平台首选格式配置
     */
    const PREFERRED_EXTENSIONS = {
        macos: ['.dmg', '.pkg'],
        windows: ['.exe', '.msi'],
        linux: ['.AppImage', '.deb', '.rpm'],
    };

    /**
     * 架构匹配关键词配置
     */
    const ARCH_KEYWORDS = {
        arm64: ['arm64', 'aarch64', 'apple', 'm1', 'm2', 'm3'],
        arm32: ['arm32', 'armv7', 'armhf'],
        x64: ['x64', 'x86_64', 'amd64', 'intel'],
        x86: ['x86', 'i386', '386'],
    };

    /**
     * 辅助文件扩展名（不会显示标签）
     */
    const AUXILIARY_EXTENSIONS = ['.blockmap', '.sig', '.sha256', '.asc', '.yml', '.yaml'];

    /**
     * 超时配置
     */
    const TIMEOUTS = {
        ELEMENT_WAIT: 15000, // 等待元素出现
        ASSETS_LOAD: 10000, // 等待资源加载
        RETRY_DELAY: 1000, // 重试延迟
    };

    /**
     * 样式配置
     */
    const STYLES = {
        RECOMMENDED: {
            backgroundColor: '#238636',
            color: 'white',
            text: LABELS.recommended,
        },
        COMPATIBLE: {
            backgroundColor: '#0969da',
            color: 'white',
            text: LABELS.compatible,
        },
        INFO_BOX: {
            backgroundColor: '#f6f8fa',
            borderColor: '#d0d7de',
            platform: '#0969da',
        },
    };

    // ==================== 全局变量 ====================

    /**
     * 平台检测结果缓存
     */
    let platformCache = null;

    // ==================== 工具函数 ====================

    /**
     * 日志输出封装函数
     */
    function log(...args) {
        if (DEBUG) {
            console.log('[GitHub Smart Release]', ...args);
        }
    }

    /**
     * 获取 WebGL 渲染器信息
     * @returns {string} 渲染器名称或错误信息
     */
    function getWebGLRenderer() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl');
            if (!gl) return 'unavailable';

            // 尝试获取调试信息扩展
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unavailable';
            }

            // 回退到基础渲染器信息
            return gl.getParameter(gl.RENDERER) || 'unavailable';
        } catch (e) {
            return 'error';
        }
    }

    /**
     * 检测操作系统类型
     * @param {string} userAgent - 浏览器用户代理字符串
     * @returns {string} 操作系统类型
     */
    function detectOS(userAgent) {
        const ua = userAgent.toLowerCase();
        if (ua.includes('mac')) return 'macos';
        if (ua.includes('windows') || ua.includes('win')) return 'windows';
        if (ua.includes('linux')) return 'linux';
        return 'unknown';
    }

    /**
     * 从用户代理检测架构
     * @param {string} userAgent - 浏览器用户代理字符串
     * @returns {Object} 检测结果
     */
    function detectArchFromUserAgent(userAgent) {
        const ua = userAgent.toLowerCase();
        if (ua.includes('arm64') || ua.includes('aarch64') || ua.includes('arm')) {
            return { arch: 'arm64', method: 'userAgent', confidence: 'high' };
        }
        return { arch: 'x64', method: 'unknown', confidence: 'low' };
    }

    /**
     * 使用 navigator.userAgentData 检测架构
     * @returns {Promise<Object>} 检测结果
     */
    async function detectArchFromUserAgentData() {
        if (!('userAgentData' in navigator) || !navigator.userAgentData.getHighEntropyValues) {
            return { arch: null, method: 'userAgentData', confidence: 'unavailable' };
        }

        try {
            const uaData = await navigator.userAgentData.getHighEntropyValues(['architecture']);
            if (uaData.architecture === 'arm') {
                return { arch: 'arm64', method: 'userAgentData', confidence: 'high' };
            } else if (uaData.architecture === 'x86') {
                return { arch: 'x64', method: 'userAgentData', confidence: 'high' };
            }
        } catch (e) {
            log('userAgentData detection failed:', e);
        }

        return { arch: null, method: 'userAgentData', confidence: 'failed' };
    }

    /**
     * 使用 WebGL 渲染器检测 Apple Silicon
     * @returns {Object} 检测结果
     */
    function detectAppleSiliconFromWebGL() {
        const renderer = getWebGLRenderer();

        // Chrome: "Apple M1", "Apple M2", "Apple M3"
        // Safari: "Apple GPU" (不够准确)
        if (
            renderer &&
            (renderer.includes('Apple M') ||
                renderer.includes('M1') ||
                renderer.includes('M2') ||
                renderer.includes('M3'))
        ) {
            return { arch: 'arm64', method: 'webgl_renderer', confidence: 'high', renderer };
        }

        return { arch: null, method: 'webgl_renderer', confidence: 'low', renderer };
    }

    /**
     * 检测 macOS 设备的架构
     * @param {string} userAgent - 浏览器用户代理字符串
     * @returns {Promise<Object>} 架构检测结果
     */
    async function detectMacOSArch(userAgent) {
        let arch = 'x64';
        let detectionResults = { method: 'unknown', confidence: 'low' };

        // 方法1: 用户代理检测
        const uaResult = detectArchFromUserAgent(userAgent);
        if (uaResult.confidence === 'high') {
            return { arch: uaResult.arch, detectionResults: uaResult };
        }

        // 方法2: userAgentData API (Chrome专有，最准确)
        const uadResult = await detectArchFromUserAgentData();
        if (uadResult.arch && uadResult.confidence === 'high') {
            return { arch: uadResult.arch, detectionResults: uadResult };
        }

        // 方法3: WebGL渲染器检测
        const webglResult = detectAppleSiliconFromWebGL();
        if (webglResult.arch && webglResult.confidence === 'high') {
            return { arch: webglResult.arch, detectionResults: webglResult };
        }

        // 方法4: WebGL扩展检测 (ARM Mac可能缺少某些扩展)
        let missingS3TC = false;
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl');
            if (gl) {
                const extensions = gl.getSupportedExtensions() || [];
                missingS3TC = extensions.indexOf('WEBGL_compressed_texture_s3tc_srgb') === -1;
            }
        } catch (e) {
            // Ignore
        }

        // 方法5: CPU核心数检测 (苹果芯片通常有更多核心)
        const highCoreCount = navigator.hardwareConcurrency && navigator.hardwareConcurrency >= 8;

        // 统计推断：2024年后大部分新Mac都是Apple Silicon
        arch = 'arm64';
        detectionResults = {
            method: 'mac_default_arm64',
            confidence: 'medium',
            reason: 'Default to ARM64 for modern Macs',
            webglRenderer: webglResult.renderer,
            missingS3TC,
            highCoreCount,
            hardwareConcurrency: navigator.hardwareConcurrency,
            userAgentDataAvailable: 'userAgentData' in navigator,
        };

        log('macOS architecture detection:', { finalArch: arch, ...detectionResults });
        return { arch, detectionResults };
    }

    /**
     * 检测用户平台和架构（带缓存）
     * @returns {Promise<Object>} 平台信息
     */
    async function detectPlatform() {
        // 如果缓存存在，直接返回
        if (platformCache) {
            log('Using cached platform detection result');
            return platformCache;
        }

        const userAgent = navigator.userAgent;
        const os = detectOS(userAgent);
        let arch = 'x64';
        let detectionResults = null;

        if (os === 'macos') {
            const macResult = await detectMacOSArch(userAgent);
            arch = macResult.arch;
            detectionResults = macResult.detectionResults;
        } else {
            // 对于非 macOS，使用基础检测
            const result = detectArchFromUserAgent(userAgent);
            arch = result.arch;
        }

        log('Platform detection details:', {
            userAgent,
            detected: { os, arch },
            webGLRenderer: getWebGLRenderer(),
        });

        // 缓存结果
        platformCache = {
            os,
            arch,
            ...(detectionResults && { detectionResults }),
        };

        return platformCache;
    }

    /**
     * 获取文件匹配优先级
     * @param {string} filename - 文件名
     * @param {Object} userPlatform - 用户平台信息
     * @param {string} userPlatform.os - 操作系统
     * @param {string} userPlatform.arch - 架构
     * @returns {number} 优先级分数
     */
    function getFilePriority(filename, userPlatform) {
        const name = filename.toLowerCase();
        const { os, arch } = userPlatform;

        // 过滤辅助文件，返回负分不显示标签
        if (AUXILIARY_EXTENSIONS.some((ext) => name.endsWith(ext))) {
            return PRIORITY.AUXILIARY_FILE;
        }

        let osMatch = false;
        let archMatch = false;

        // 检查操作系统匹配
        if (EXTENSIONS[os] && EXTENSIONS[os].some((ext) => name.endsWith(ext))) {
            osMatch = true;
        }

        // 检查架构匹配（支持所有架构）
        let detectedArch = null;
        for (const [archType, keywords] of Object.entries(ARCH_KEYWORDS)) {
            if (keywords.some((keyword) => name.includes(keyword))) {
                detectedArch = archType;
                archMatch = arch === archType;
                break;
            }
        }

        // 检查是否为首选格式
        const isPreferredFormat = PREFERRED_EXTENSIONS[os] && 
            PREFERRED_EXTENSIONS[os].some((ext) => name.endsWith(ext));

        // 优先级计算
        if (osMatch && archMatch) {
            if (isPreferredFormat) {
                // 完全匹配 + 首选格式：最高优先级
                return PRIORITY.PREFERRED_FORMAT;
            } else {
                // 完全匹配但非首选格式：推荐
                return PRIORITY.PERFECT_MATCH;
            }
        } else if (osMatch && !archMatch) {
            // 操作系统匹配但架构不匹配：对于苹果芯片不显示标签
            if (os === 'macos' && arch === 'arm64') {
                // 苹果芯片遇到 x64 文件，不显示标签
                return PRIORITY.NO_MATCH;
            } else {
                // 其他情况显示兼容
                return PRIORITY.OS_MATCH;
            }
        } else if (archMatch && !osMatch) {
            // 同架构的其他格式可以标记为兼容
            return PRIORITY.ARCH_MATCH;
        } else {
            // 不匹配
            return PRIORITY.NO_MATCH;
        }
    }

    /**
     * 添加样式
     */
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .smart-release-recommended {
                background-color: ${STYLES.RECOMMENDED.backgroundColor} !important;
                color: ${STYLES.RECOMMENDED.color} !important;
                border-radius: 6px !important;
                padding: 2px 6px !important;
                font-weight: 600 !important;
                margin-left: 8px !important;
                transition: all 0.2s ease !important;
            }
            
            .smart-release-recommended:hover {
                opacity: 0.8 !important;
            }
            
            .smart-release-compatible {
                background-color: ${STYLES.COMPATIBLE.backgroundColor} !important;
                color: ${STYLES.COMPATIBLE.color} !important;
                border-radius: 6px !important;
                padding: 2px 6px !important;
                margin-left: 8px !important;
                transition: all 0.2s ease !important;
            }
            
            .smart-release-compatible:hover {
                opacity: 0.8 !important;
            }
            
            .smart-release-info {
                background-color: ${STYLES.INFO_BOX.backgroundColor} !important;
                border: 1px solid ${STYLES.INFO_BOX.borderColor} !important;
                border-radius: 6px !important;
                padding: 8px 12px !important;
                margin: 16px 0 !important;
                font-size: 14px !important;
            }
            
            .smart-release-platform {
                font-weight: 600 !important;
                color: ${STYLES.INFO_BOX.platform} !important;
            }
            
            /* 暗色主题支持 */
            @media (prefers-color-scheme: dark) {
                .smart-release-info {
                    background-color: #21262d !important;
                    border-color: #30363d !important;
                    color: #e6edf3 !important;
                }
                
                .smart-release-platform {
                    color: #58a6ff !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 等待元素出现
     * @param {string} selector - CSS选择器
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise<Element|null>} 找到的元素或null
     */
    function waitForElement(selector, timeout = TIMEOUTS.ELEMENT_WAIT) {
        return new Promise((resolve) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver(() => {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });

            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
    }

    /**
     * 等待 assets 列表完全加载
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise<boolean>} 是否加载成功
     */
    function waitForAssetsLoaded(timeout = TIMEOUTS.ASSETS_LOAD) {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = Math.floor(timeout / 1000); // 每秒检查一次

            function checkAssets() {
                attempts++;

                // 尝试多种选择器策略
                const selectors = [
                    'a[href*="/releases/download/"]',
                    'ul[data-view-component="true"] a[href*="/releases/download/"]',
                    'details[open] a[href*="/releases/download/"]',
                    '.Box ul a[href*="/releases/download/"]',
                ];

                let assetLinks = [];
                let usedSelector = '';

                for (const selector of selectors) {
                    assetLinks = Array.from(document.querySelectorAll(selector));
                    if (assetLinks.length > 0) {
                        usedSelector = selector;
                        break;
                    }
                }

                log(`Observer check attempt ${attempts}`);
                log(`Found ${assetLinks.length} asset links using selector: ${usedSelector}`);

                // 调试信息：列出找到的文件名
                if (assetLinks.length > 0) {
                    const filenames = assetLinks.map((link) => {
                        const textContent = link.textContent.trim();
                        const href = link.getAttribute('href');
                        return textContent || href.split('/').pop();
                    });
                    log('Asset filenames:', filenames);
                }

                // 调试信息：检查页面状态
                const detailsElement = document.querySelector('details');
                const assetsContainer = document.querySelector('ul[data-view-component="true"]');
                const boxContainer = document.querySelector('.Box--condensed');

                log('Page elements status:', {
                    detailsOpen: detailsElement ? detailsElement.hasAttribute('open') : 'not found',
                    assetsContainer: assetsContainer ? 'found' : 'not found',
                    boxContainer: boxContainer ? 'found' : 'not found',
                });

                if (assetLinks.length > 0) {
                    log('Assets loaded successfully');
                    return true;
                }

                if (attempts >= maxAttempts) {
                    log('Max attempts reached');
                    return false;
                }

                return null; // 继续等待
            }

            // 立即检查一次
            const result = checkAssets();
            if (result === true) {
                resolve(true);
                return;
            } else if (result === false) {
                resolve(false);
                return;
            }

            log('Assets not found, setting up periodic check...');

            const intervalId = setInterval(() => {
                const result = checkAssets();
                if (result === true) {
                    clearInterval(intervalId);
                    resolve(true);
                } else if (result === false) {
                    clearInterval(intervalId);
                    resolve(false);
                }
            }, 1000);
        });
    }

    /**
     * 处理 release 页面
     * @throws {Error} 如果处理过程中发生错误
     */
    async function processReleasePage() {
        try {
            const userPlatform = await detectPlatform();
            log('Detected platform:', userPlatform);

            // 等待 assets 区域加载 - 更新选择器以匹配实际页面结构
            log('Looking for assets container...');
            const assetsContainer = await waitForElement(
                'ul[data-view-component="true"], details-toggle details, [data-testid*="asset"]',
            );
            if (!assetsContainer) {
                log('Assets container not found');
                return;
            }

            // 查找并展开 details 元素（如果存在）
            const detailsElement = document.querySelector('details');
            if (detailsElement && !detailsElement.hasAttribute('open')) {
                const summary = detailsElement.querySelector('summary');
                if (summary) {
                    log('Expanding assets list...');
                    summary.click();
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
            }

            // 等待 assets 完全加载（处理异步加载）
            log('Waiting for assets to load...');
            const assetsLoaded = await waitForAssetsLoaded();
            if (!assetsLoaded) {
                log('Assets failed to load within timeout');
                return;
            }

            // 获取所有资源链接
            const assetLinks = Array.from(
                document.querySelectorAll('a[href*="/releases/download/"]'),
            );
            if (assetLinks.length === 0) {
                log('No asset links found after loading');
                return;
            }

            log(`Found ${assetLinks.length} assets`);

            // 计算每个文件的匹配度
            const scoredAssets = assetLinks.map((link) => {
                const filename = link.textContent.trim();
                const priority = getFilePriority(filename, userPlatform);
                return { link, filename, priority };
            });

            // 按优先级排序
            scoredAssets.sort((a, b) => b.priority - a.priority);

            // 添加标签
            const bestMatch = scoredAssets.find(
                (asset) => asset.priority >= PRIORITY.PERFECT_MATCH,
            );
            const compatibleAssets = scoredAssets.filter(
                (asset) => asset.priority > 0 && asset.priority < PRIORITY.PERFECT_MATCH,
            );

            log(
                'Asset scores:',
                scoredAssets.map((a) => ({ filename: a.filename, priority: a.priority })),
            );

            // 标记推荐文件 (完全匹配：OS + 架构)
            if (bestMatch) {
                const recommendedTag = document.createElement('span');
                recommendedTag.textContent = STYLES.RECOMMENDED.text;
                recommendedTag.className = 'smart-release-recommended';
                recommendedTag.title = `${LABELS.tooltips.recommended} (${userPlatform.os} ${userPlatform.arch})`;
                bestMatch.link.parentNode.appendChild(recommendedTag);
            }

            // 标记兼容文件 (部分匹配或同架构其他格式)
            compatibleAssets.slice(0, 3).forEach((asset) => {
                const compatibleTag = document.createElement('span');
                compatibleTag.textContent = STYLES.COMPATIBLE.text;
                compatibleTag.className = 'smart-release-compatible';
                compatibleTag.title = LABELS.tooltips.compatible;
                asset.link.parentNode.appendChild(compatibleTag);
            });
        } catch (error) {
            log('Error processing release page:', error);

            // 在页面上显示错误信息（仅调试模式）
            if (DEBUG) {
                const errorInfo = document.createElement('div');
                errorInfo.className = 'smart-release-info';
                errorInfo.style.backgroundColor = '#fee';
                errorInfo.style.borderColor = '#fcc';
                errorInfo.innerHTML = `
                    <div><strong>⚠️ Smart Release 处理失败:</strong></div>
                    <div><small>${error.message}</small></div>
                `;

                const target =
                    document.querySelector('h1[data-view-component="true"]') ||
                    document.querySelector('main > div:first-child');
                if (target) {
                    target.parentNode.insertBefore(errorInfo, target.nextSibling);
                }
            }

            throw error; // 重新抛出错误供上层处理
        }
    }

    // 防止重复处理的标记
    let isProcessing = false;
    let hasProcessed = false;

    /**
     * 带重试机制的页面处理函数
     * @param {number} maxRetries - 最大重试次数，默认为2次
     * @throws {Error} 如果所有重试都失败
     */
    async function processWithRetry(maxRetries = 2) {
        if (isProcessing) {
            log('Already processing, skipping...');
            return;
        }

        if (hasProcessed && window.location.href === window.lastProcessedUrl) {
            log('Already processed this page, skipping...');
            return;
        }

        isProcessing = true;

        try {
            for (let i = 0; i < maxRetries; i++) {
                try {
                    await processReleasePage();
                    hasProcessed = true;
                    window.lastProcessedUrl = window.location.href;
                    log('Processing completed successfully');
                    return; // 成功则退出
                } catch (error) {
                    log(`Attempt ${i + 1} failed:`, error);
                    if (i < maxRetries - 1) {
                        // 等待一段时间后重试
                        await new Promise((resolve) => setTimeout(resolve, TIMEOUTS.RETRY_DELAY));
                    }
                }
            }
            log('All attempts failed to process release page');
        } finally {
            isProcessing = false;
        }
    }

    /**
     * 检查当前页面是否为GitHub release页面
     * @returns {boolean} 如果是release页面返回true，否则返回false
     */
    function isReleasePage() {
        const isReleaseUrl = /github\.com\/.*\/releases(\/tag\/|\/latest)/.test(
            window.location.href,
        );
        const hasReleaseElements =
            document.querySelector('h1[data-view-component="true"]') &&
            document.querySelector('a[href*="/releases/download/"]');
        log('URL check:', isReleaseUrl, 'Elements check:', hasReleaseElements);
        return isReleaseUrl || hasReleaseElements;
    }

    /**
     * 初始化脚本，添加样式并开始监听页面变化
     * 在页面加载和URL变化时自动处理release页面
     */
    function init() {
        log('GitHub Smart Release Downloads - Initializing...');
        log('Current URL:', window.location.href);

        addStyles();

        // 检查是否为release页面
        if (!isReleasePage()) {
            log('Not a release page, skipping...');
            return;
        }

        if (document.readyState === 'loading') {
            log('Document still loading, waiting for DOMContentLoaded...');
            document.addEventListener('DOMContentLoaded', () => {
                log('DOMContentLoaded fired, starting processing...');
                processWithRetry();
            });
        } else {
            log('Document ready, starting processing...');
            processWithRetry();
        }

        // 处理 turbo 导航
        document.addEventListener('turbo:load', () => {
            log('Turbo load event, reprocessing...');
            processWithRetry();
        });

        // 处理 GitHub 的软导航
        document.addEventListener('pjax:end', () => {
            log('PJAX end event, reprocessing...');
            processWithRetry();
        });
    }

    init();
})();
