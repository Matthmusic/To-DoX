// Shared CEA release policy. Run after npm ci and before packaging.
const fs = require('node:fs');
const path = require('node:path');

function classifyVersion(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(version);
  if (!match || match[4]?.split('.').some(part => /^\d+$/.test(part) && part.length > 1 && part[0] === '0')) {
    throw new Error(`Invalid SemVer: ${version}. Use 2.3.0-beta.1 or 2.3.0-dev.1.`);
  }
  if (!match[4]) return 'stable';
  const prefix = match[4].split('.')[0];
  if (['beta', 'rc'].includes(prefix)) return 'beta';
  if (['dev', 'alpha', 'nightly'].includes(prefix)) return 'dev';
  throw new Error(`Unsupported prerelease channel: ${prefix}`);
}

function prepareRelease(root = process.cwd(), env = process.env) {
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8').replace(/^\uFEFF/, ''));
  const channel = classifyVersion(version);
  if (env.GITHUB_REF?.startsWith('refs/tags/') && env.GITHUB_REF.slice(10) !== `v${version}`) {
    throw new Error(`Tag ${env.GITHUB_REF} does not match package.json v${version}. Update package.json and the lockfile before tagging.`);
  }
  const prerelease = channel !== 'stable';
  if (env.GITHUB_ENV) fs.appendFileSync(env.GITHUB_ENV, `EP_PRE_RELEASE=${prerelease}\nEP_DRAFT=false\nCEA_RELEASE_CHANNEL=${channel}\n`);
  console.log(`CEA release: ${version} (${channel}; prerelease=${prerelease})`);
  return { version, channel, prerelease };
}

module.exports = { classifyVersion, prepareRelease };
if (require.main === module) prepareRelease();
