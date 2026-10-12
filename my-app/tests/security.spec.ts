import { test, expect } from '@playwright/test'
import path from 'node:path'

test('account settings, password and deletion', async ({ page }, testInfo) => {
  const email = `security-${Date.now()}-${testInfo.project.name}@example.com`
  let password = 'test-security-password-42'
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.getByRole('button', { name: 'Create an account', exact: true }).click()
  await page.getByLabel('Your name').fill('Security Test')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  const navigate = async (name: string) => {
    if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Open navigation' }).click()
    await page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
  }
  await navigate('Settings')
  await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send verification link' })).toBeDisabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  await page.screenshot({ path: `test-results/${testInfo.project.name}-security.png`, fullPage: true, animations: 'disabled' })
  await page.getByLabel('Display name').fill('Renamed Tester')
  await page.getByRole('button', { name: 'Save name', exact: true }).click()
  await expect(page.getByText('Your name has been updated.')).toBeVisible()
  if (testInfo.project.name !== 'mobile') await expect(page.getByText('Renamed Tester').first()).toBeVisible()
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Current password').fill(password)
  await dialog.getByLabel('New password', { exact: true }).fill('new-security-password-42')
  await dialog.getByLabel('Repeat new password').fill('new-security-password-42')
  await dialog.getByRole('button', { name: 'Change password', exact: true }).click()
  password = 'new-security-password-42'
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Password changed. Other sessions have been signed out.')).toBeVisible()
  for (const removed of ['Download all data', 'Restore backup', 'Set up 2FA'])
    await expect(page.getByRole('button', { name: removed, exact: true })).toHaveCount(0)
  await navigate('Scan receipt')
  // Preview privacy test does not depend on the OCR engine.
  await page.route('**/api/receipts/upload', (route) => route.fulfill({ status: 503, json: { detail: 'Preview test' } }))
  await page.getByLabel('Upload bank slip file').setInputFiles(path.resolve('tests/fixtures/receipt.png'))
  await expect(page.getByText('Slip preview hidden', { exact: true })).toBeVisible()
  await expect(page.locator('.receipt-preview img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show original preview' }).click()
  await expect(page.locator('.receipt-preview img')).toBeVisible()
  await page.getByRole('button', { name: 'Hide preview', exact: true }).click()
  await expect(page.locator('.receipt-preview img')).toHaveCount(0)
  await navigate('Settings')
  await page.getByRole('button', { name: 'Delete account', exact: true }).click()
  await dialog.getByLabel('Current password').fill(password)
  await dialog.getByLabel('Type DELETE to confirm').fill('DELETE')
  await dialog.getByRole('button', { name: 'Delete account permanently', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Good to see you.' })).toBeVisible()
  expect(errors).toEqual([])
})
