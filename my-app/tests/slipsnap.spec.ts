import { test, expect } from '@playwright/test'
import path from 'node:path'

test('account, entries, filters, categories, receipt OCR, export and persistent session', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const email = `e2e-${Date.now()}-${testInfo.project.name}@example.com`
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Good to see you.' })).toBeVisible()
  await page.screenshot({ path: `test-results/${testInfo.project.name}-login.png`, fullPage: true })
  await page.getByRole('button', { name: 'Create an account' }).click()
  await page.getByLabel('Your name').fill('Jamie')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('local-test-password-42')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'A little clarity, Jamie.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your picture starts here' })).toBeVisible()
  const navigate = async (name: string) => {
    if (testInfo.project.name === 'mobile')
      await page.getByRole('button', { name: 'Open navigation' }).click()
    await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
  }
  await navigate('Transactions')
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click()
  await page.getByLabel('Merchant / description').fill('Neighborhood Café')
  await page.getByLabel('Amount (THB)', { exact: true }).fill('150.25')
  await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Food & drinks' })
  await page.getByRole('button', { name: 'Save transaction' }).click()
  await expect(page.getByRole('button', { name: 'Neighborhood Café', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click()
  await page.getByRole('button', { name: '↙ Income' }).click()
  await page.getByLabel('Merchant / description').fill('September salary')
  await page.getByLabel('Amount (THB)', { exact: true }).fill('45000')
  await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Salary' })
  await page.getByRole('button', { name: 'Save transaction' }).click()
  await expect(page.getByText('2 transactions', { exact: true })).toBeVisible()
  await page.getByLabel('Search merchants').fill('Neighborhood')
  await expect(page.getByText('1 transaction', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Neighborhood Café', exact: true }).click()
  await page.getByLabel('Amount (THB)', { exact: true }).fill('175.50')
  await page.getByRole('button', { name: 'Save transaction' }).click()
  await expect(page.getByRole('cell', { name: '−฿175.50' })).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'CSV', exact: true }).click()
  expect((await downloadPromise).suggestedFilename()).toBe('slipsnap-transactions.csv')
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await navigate('Categories')
  await page.getByRole('button', { name: 'New category' }).click()
  await page.getByLabel('Category name').fill('Weekend adventures')
  await page.getByRole('button', { name: 'Save category' }).click()
  await expect(page.getByRole('heading', { name: 'Weekend adventures' })).toBeVisible()
  await navigate('Scan receipt')
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-upload.png`,
    fullPage: true,
  })
  await page
    .getByLabel('Upload bank slip file')
    .setInputFiles(path.resolve('tests/fixtures/receipt.png'))
  await expect(page.getByLabel('วันที่โอน (วัน/เดือน/ปี)')).toHaveValue('2026-09-17', {
    timeout: 100_000,
  })
  await expect(page.getByLabel('จำนวนเงินที่โอนออก (บาท)')).toHaveValue('210.00')
  await expect(page.locator('input[placeholder="รหัสอ้างอิงตามสลิป (ถ้ามี)"]')).toHaveValue('')
  await expect(page.locator('main')).not.toContainText('SCB')
  await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Food & drinks' })
  await page.getByRole('button', { name: 'บันทึกเงินโอนออก' }).click()
  await expect(page.getByRole('heading', { name: 'All tucked away.' })).toBeVisible()
  await page.getByRole('button', { name: 'See my transactions' }).click()
  await expect(page.getByRole('button', { name: 'Bank transfer', exact: true })).toBeVisible()
  await navigate('Overview')
  await expect(page.getByText('฿45,000.00', { exact: true }).first()).toBeVisible()
  await expect(page.locator('.recharts-pie-sector').first()).toBeVisible()
  const dismiss = page.getByRole('button', { name: 'Dismiss notification' })
  await expect(dismiss).toBeHidden({ timeout: 6_000 })
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-dashboard.png`,
    fullPage: true,
  })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'A little clarity, Jamie.' })).toBeVisible()
  if (testInfo.project.name === 'mobile')
    await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Good to see you.' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Good to see you.' })).toBeVisible()
  expect(errors).toEqual([])
})
