import { expect, test } from '@playwright/test'

test.describe('SmartEngine demo 导出回归', () => {
  test('基础模式示例流程的预览与导出 XML 都应保留 smart 扩展而不是回退到 modeler 扩展', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('smart-export-xml-button')).toBeVisible()

    const adaptersTab = page.locator('.arco-tabs-tab').filter({ hasText: '适配器' })
    await expect(adaptersTab).toBeVisible()
    await adaptersTab.click()
    await page.getByTestId('smart-refresh-preview-button').click()

    const preview = page.getByTestId('smart-export-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText('xmlns:smart="http://smartengine.org/schema/process"')
    await expect(preview).toContainText('<smart:properties>')
    await expect(preview).not.toContainText('<modeler:properties>')

    await page.getByTestId('smart-export-xml-button').click()

    const exportTextarea = page.locator('.arco-modal textarea').first()
    await expect(exportTextarea).toBeVisible()
    const exportedXml = await exportTextarea.inputValue()

    expect(exportedXml).toContain('xmlns:smart="http://smartengine.org/schema/process"')
    expect(exportedXml).toContain('<smart:properties>')
    expect(exportedXml).toContain('<smart:executionListener')
    expect(exportedXml).not.toContain('<modeler:properties>')
  })
})