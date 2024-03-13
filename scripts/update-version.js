import fsp from 'fs/promises';
import { resolve } from 'path';
import { promisify } from 'util';
import { execa } from 'execa';
import _getStagedFiles from 'staged-git-files';

const getStagedFiles = promisify(_getStagedFiles);

async function updateVersion() {
    const stagedFiles = await getStagedFiles();
    let modified = false;
    const updatePromises = stagedFiles.map(async (item) => {
        if (item.filename.endsWith('.user.js') && item.status === 'Modified') {
            const filePath = resolve(process.cwd(), item.filename);
            const content = await fsp.readFile(filePath, 'utf8');
            const updatedContent = content.replace(
                /(\/\/ @version +)(\d+)\.(\d+)\.(\d+)/,
                (_match, prefix, major, minor, patch) => {
                    const newPatch = parseInt(patch, 10) + 1;
                    return `${prefix}${major}.${minor}.${newPatch}`;
                },
            );
            await fsp.writeFile(filePath, updatedContent, 'utf8');
            modified = true;
        }
    });
    await Promise.all(updatePromises);
    if (modified) {
        await execa('git', ['stage', '-A']);
    }
}

updateVersion();
