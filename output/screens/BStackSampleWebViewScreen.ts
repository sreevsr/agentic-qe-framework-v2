import { BaseScreen } from '../core/base-screen';

export class BStackSampleWebViewScreen extends BaseScreen {
  constructor(driver: WebdriverIO.Browser) {
    super(driver, 'bstack-sample-web-view-screen');
  }

  async waitForScreen(): Promise<void> {
    await this.waitForElement('webView', 'displayed', 20000);
  }

  async isWebViewVisible(): Promise<boolean> {
    return this.isVisible('webView');
  }

  async tapUIElementsTab(): Promise<void> {
    await this.tap('uiElementsTab');
  }
}
