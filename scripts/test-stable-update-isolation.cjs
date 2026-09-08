// Exercise the updater version shipped in v2.2.2 with mocked GitHub responses.
const assert = require('node:assert/strict');
const { AppUpdater } = require('electron-updater/out/AppUpdater');
const { GitHubProvider } = require('electron-updater/out/providers/GitHubProvider');
const { classifyVersion } = require('./release-channel.cjs');

async function main() {
  const updater = new AppUpdater(null, { version: '2.2.2' });
  assert.equal(updater.allowPrerelease, false);
  const requests = [];
  const executor = { request: async options => {
    const url = options.path;
    requests.push(url);
    if (url.endsWith('.atom')) return '<feed>' + ['v2.3.0-dev.1', 'v2.2.2'].map(tag =>
      `<entry><title>${tag}</title><link href="https://github.com/Matthmusic/To-DoX/releases/tag/${tag}"/><content>Notes</content></entry>`).join('') + '</feed>';
    if (url.endsWith('/latest')) return JSON.stringify({ tag_name: 'v2.2.2' });
    if (url.endsWith('/v2.2.2/latest.yml')) return 'version: 2.2.2\nfiles: []\n';
    throw Error('Unexpected update request: ' + url);
  }};
  const provider = new GitHubProvider({ provider: 'github', owner: 'Matthmusic', repo: 'To-DoX' }, updater, { executor, platform: 'win32', isUseMultipleRangeRequest: false });
  const release = await provider.getLatestVersion();
  assert.equal(release.version, '2.2.2');
  assert.equal(release.tag, 'v2.2.2');
  assert.equal(requests.some(url => url.includes('/v2.3.0-dev.1/')), false);
  assert.equal(classifyVersion('2.3.0-dev.1'), 'dev');
  console.log('PASS: stable 2.2.2 ignores a newer dev release and reads only stable latest.yml.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
