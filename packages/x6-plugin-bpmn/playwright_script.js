const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:3101');
    await page.evaluate(() => {
      return window.__x6PluginBrowserHarness.createPoolLaneTaskScenario();
    });
    
    const nodeIds = ['pool-1', 'lane-1', 'task-1'];
    for (const id of nodeIds) {
      const snapshot = await page.evaluate((id) => {
        return window.__x6PluginBrowserHarness.getNodeSnapshot(id);
      }, id);
      console.log(`Snapshot for ${id}:`, JSON.stringify(snapshot, null, 2));
    }

    const poolSnapshots = await page.evaluate(() => {
      return window.__x6PluginBrowserHarness.getPoolLaneSnapshots('pool-1');
    });
    console.log(`Pool lane snapshots for pool-1:`, JSON.stringify(poolSnapshots, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
})();
