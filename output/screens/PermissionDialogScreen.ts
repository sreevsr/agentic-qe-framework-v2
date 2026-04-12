import { BaseScreen } from '../core/base-screen';

export class PermissionDialogScreen extends BaseScreen {
  constructor(driver: WebdriverIO.Browser) {
    super(driver, 'permission-dialog');
  }

  /** Check if a dialog with "Not Now" is currently visible. */
  async isDialogVisible(): Promise<boolean> {
    return this.isVisible('notNowButton');
  }

  /** Dismiss the dialog by tapping "Not Now". */
  async dismissDialog(): Promise<void> {
    await this.tap('notNowButton');
  }

  /**
   * Try to dismiss any overlay/dialog. If no dialog is visible, does nothing.
   * Returns true if a dialog was dismissed, false otherwise.
   */
  async tryDismiss(): Promise<boolean> {
    if (await this.isDialogVisible()) {
      await this.dismissDialog();
      await this.driver.pause(500);
      return true;
    }
    return false;
  }
}
