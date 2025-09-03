# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a collection of Greasemonkey/Tampermonkey userscripts for enhancing the Boss Zhipin (BOSS 直聘) job search experience. The project contains two main userscripts:

- `block-hunter.user.js` - Blocks recruiter job postings
- `refined-boss.user.js` - Shows job posting last modification time and filters out communicated, inactive, and outsourcing positions

## Package Management

- Uses **pnpm** as the package manager (specified in package.json)
- Install dependencies with: `pnpm install` or `ni`
- The project uses ES modules (`"type": "module"` in package.json)

## Available Scripts

- `pnpm run prepare` - Sets up git hooks using simple-git-hooks
- No build, test, or lint scripts are configured

## Code Architecture

### Main Userscripts

Both userscripts follow similar patterns:

- Standard Greasemonkey metadata headers with version, description, and target URLs
- Common utility functions like `sleep()` and `waitElement()`/`waitElements()`
- DOM manipulation to modify the Boss Zhipin job listing pages
- Use of MutationObserver for dynamic content updates

### Version Management

- **Automatic version bumping**: The `scripts/update-version.js` script automatically increments patch versions for modified `.user.js` files during pre-commit
- Pre-commit hook is configured in package.json (`"pre-commit": "node scripts/update-version.js"`)
- Modified files are automatically re-staged after version updates

### Project Structure

```plaintext
/
├── block-hunter.user.js    # Recruiter blocking script
├── refined-boss.user.js    # Job enhancement script
├── scripts/
│   └── update-version.js   # Automatic version management
├── package.json            # pnpm configuration with git hooks
└── README.md              # Documentation with installation links
```

## Development Workflow

1. Make changes to any `.user.js` file
2. Commit changes - the pre-commit hook will automatically:
   - Detect modified userscripts
   - Increment their patch version numbers
   - Re-stage the updated files
3. The scripts are published via GitHub raw URLs and GreasyFork

## Userscript Development Notes

- Both scripts target `https://www.zhipin.com/web/geek/job*`
- Scripts use `@grant none` (no special browser APIs required)
- Common patterns include waiting for DOM elements and filtering job cards
- Version format follows semantic versioning (major.minor.patch)
