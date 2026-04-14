import { BaseScreen } from '../core/base-screen';

export class BStackSampleUIElementsScreen extends BaseScreen {
  constructor(driver: WebdriverIO.Browser) {
    super(driver, 'bstack-sample-ui-elements-screen');
  }

  async waitForScreen(): Promise<void> {
    await this.waitForElement('navBarTitle', 'displayed', 20000);
  }

  async isTextButtonVisible(): Promise<boolean> {
    return this.isVisible('textButton');
  }

  async isAlertButtonVisible(): Promise<boolean> {
    return this.isVisible('alertButton');
  }

  async tapAlertButton(): Promise<void> {
    await this.tap('alertButton');
  }

  async tapWebViewTab(): Promise<void> {
    await this.tap('webViewTab');
  }

  async tapUIElementsTab(): Promise<void> {
    await this.tap('uiElementsTab');
  }
}
