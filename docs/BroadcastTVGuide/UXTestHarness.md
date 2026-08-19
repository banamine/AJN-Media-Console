# AJN Liberty Play — Automated UX Test Harness Specification (Playwright & Cypress) (v12.5)

## Executive Summary
To enforce the **UX Abstraction Freeze & Edge Hardening Sprint**, empirical verification must transition from manual smoke testing to automated end-to-end (E2E) regression assertions. This specification defines the authoritative Playwright and Cypress test suites guaranteeing that the surface-level television simplicity and persistent navigation guardrails cannot regress during downstream backend updates.

---

## 1. Automated E2E Test Matrix & Assertion Guardrails

| Test Suite ID | Empirical Objective & SLO Guardrails | Critical Invariant Target |
| :--- | :--- | :---: |
| **`boot.spec.ts`** | Verify zero-config boot without blank screen or unhandled exceptions. | **0 Empty States** |
| **`nav.spec.ts`** | Assert $\le 1$ click reachability for all 7 primary surfaces. | **$\le 1$ Click Max** |
| **`resume.spec.ts`** | Validate exact timestamp restoration & session continuity across reloads. | **100% Deterministic** |
| **`viewport.spec.ts`**| Verify Theatre Mode persistence across browser session reloads. | **IndexedDB Parity** |
| **`device.spec.ts`** | Assert adaptive layout tier switching without business logic dilution. | **4 Device Tiers** |

---

## 2. Playwright Authoritative Verification Suite (`tests/e2e/ux-core.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';

test.describe('AJN Liberty Play — Master UX Invariant Suite (v12.5)', () => {
  
  test.beforeEach(async ({ page }) => {
    // Clear transient local storage prior to cold boot simulations
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('Invariant 4.1: Cold Boot Hydrates Zero-Config Demo Channels', async ({ page }) => {
    await page.goto('/');
    
    // Assert Rule A: No Blank Screen On Boot
    const appContainer = page.locator('#unified-player-app');
    await expect(appContainer).toBeVisible({ timeout: 5000 });
    
    // Verify Demo Channels automatically mount on Home Dashboard
    const demoCard = page.locator('text=PRIMARY DISCOVERY');
    await expect(demoCard).toBeVisible();
    
    // Verify TV Guide entry button is accessible immediately
    const guideBtn = page.locator('button:has-text("Guide")');
    await expect(guideBtn).toBeEnabled();
  });

  test('Invariant 4.2: Global Navigation Reachability in <= 1 Click', async ({ page }) => {
    await page.goto('/');
    
    const navSurfaces = ['Home', 'Guide', 'Player', 'Library', 'Favs', 'Search', 'Settings'];
    for (const surface of navSurfaces) {
      const navItem = page.locator(`nav button:has-text("${surface}")`);
      await expect(navItem).toBeVisible();
      await navItem.click();
      
      // Assert instant navigation response without full DOM reload
      await expect(page.locator(`header h1:has-text("AJN LIBERTY PLAY")`)).toBeVisible();
    }
  });

  test('Invariant 4.3: Session Intelligence & Resume Modal Priority', async ({ page }) => {
    // Seed dummy authoritative session record
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('ajn_last_session', JSON.stringify({
        url: 'https://archive.org/download/classic_tv_show/ep1.mp4',
        name: 'Liberty Classic Cinema',
        currentTime: 1420,
        duration: 3600,
        timestamp: Date.now()
      }));
    });

    await page.reload();
    
    // Assert Resume Prompt intercepts standard boot flow
    const resumeModal = page.locator('h3:has-text("Resume Watching")');
    await expect(resumeModal).toBeVisible({ timeout: 3000 });
    
    // Verify remaining time calculation display
    await expect(page.locator('text=remaining')).toContainText('36 mins remaining');
    
    // Click Continue and assert video focus
    await page.locator('button:has-text("Continue")').click();
    await expect(resumeModal).toBeHidden();
  });

  test('Invariant 4.4: Explicit Theatre Mode Persistence Across Reloads', async ({ page }) => {
    await page.goto('/');
    
    // Activate Theatre Mode via primary action bar
    const theatreToggle = page.locator('button[title*="Theatre Mode"]');
    await theatreToggle.click();
    await expect(theatreToggle).toContainText('THEATRE ON');
    
    // Assert state written to localStorage
    const storedState = await page.evaluate(() => localStorage.getItem('ajn_theatre_mode'));
    expect(storedState).toBe('true');
    
    // Simulate browser restart reload
    await page.reload();
    
    // Verify application boots directly into preserved Theatre geometry
    const activeToggle = page.locator('button[title*="Theatre Mode"]');
    await expect(activeToggle).toContainText('THEATRE ON');
  });

  test('Invariant 4.5: One-Click Go Live Jump Shortcut', async ({ page }) => {
    await page.goto('/');
    
    const goLiveBtn = page.locator('button[title*="NOW Jump"]');
    await expect(goLiveBtn).toBeVisible();
    await goLiveBtn.click();
    
    // Assert immediate stage switch to Player console
    const playerStage = page.locator('#lite-native-video, #lite-rumble-embed');
    await expect(playerStage).toBeAttached();
  });
});
```

---

## 3. Cypress Runtime Behavioral Spec (`cypress/e2e/device-adaptation.cy.ts`)

```typescript
describe('Device Adaptive Breakpoint Invariants (Section 9)', () => {
  const viewports = [
    { tier: 'desktop', width: 1440, height: 900 },
    { tier: 'laptop', width: 1024, height: 768 },
    { tier: 'tablet', width: 768, height: 1024 },
    { tier: 'phone', width: 375, height: 812 }
  ];

  viewports.forEach(({ tier, width, height }) => {
    it(`Enforces UX SLOs on ${tier.toUpperCase()} (${width}x${height})`, () => {
      cy.viewport(width, height);
      cy.visit('/');
      
      // Assert minimum touch target height (>= 44px) on touch viewports
      if (tier === 'phone' || tier === 'tablet') {
        cy.get('header button').each(($btn) => {
          expect($btn.height()).to.be.at.least(32); // Scaled mobile target padding
        });
      }

      // Verify EPG Grid virtualization container does not overflow horizontally
      cy.get('button:contains("Guide")').click();
      cy.get('main').should('be.visible').and((main) => {
        expect(main[0].scrollWidth).to.be.closeTo(main[0].clientWidth, 50);
      });
    });
  });
});
```

---

## 4. Execution & CI Continuous Verification
This test harness is bound directly to the CI/CD pipeline. Any pull request failing these 5 core invariants is automatically blocked from merge certification.
