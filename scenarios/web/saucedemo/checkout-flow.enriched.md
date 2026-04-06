# SauceDemo — Checkout Flow

**Application:** SauceDemo
**URL:** https://www.saucedemo.com
**Type:** web
**Tags:** @smoke, @P0

## Metadata

- Total steps: 24
- Pages discovered: 5 (LoginPage, InventoryPage, CartPage, CheckoutInfoPage, CheckoutOverviewPage, CheckoutCompletePage)
- Elements verified: 24/24
- Explorer status: COMPLETE

## Steps

### LoginPage (/)

1. Navigate to https://www.saucedemo.com <!-- ORIGINAL -->
   <!-- LOCATOR: loginPage.url -->
2. Enter "standard_user" in the Username field <!-- ORIGINAL -->
   <!-- LOCATOR: loginPage.usernameInput -->
3. Enter "secret_sauce" in the Password field <!-- ORIGINAL -->
   <!-- LOCATOR: loginPage.passwordInput -->
4. Click the "Login" button <!-- ORIGINAL -->
   <!-- LOCATOR: loginPage.loginButton -->

### InventoryPage (/inventory.html)

5. VERIFY inventory page displays "Products" <!-- ORIGINAL -->
   <!-- LOCATOR: inventoryPage.pageTitle -->
6. Click "Add to cart" on "Sauce Labs Fleece Jacket" <!-- ORIGINAL -->
   <!-- LOCATOR: inventoryPage.addToCartBackpack -->
7. Click "Add to cart" on "Sauce Labs Bike Light" <!-- ORIGINAL -->
   <!-- LOCATOR: inventoryPage.addToCartBikeLight -->
8. VERIFY cart badge displays "2" <!-- ORIGINAL -->
   <!-- LOCATOR: inventoryPage.cartBadge -->
9. Click the shopping cart icon <!-- ORIGINAL -->
   <!-- LOCATOR: inventoryPage.cartLink -->

### CartPage (/cart.html)

10. VERIFY cart page displays "Your Cart" <!-- ORIGINAL -->
    <!-- LOCATOR: cartPage.pageTitle -->
11. VERIFY "Sauce Labs Backpack" appears in cart <!-- ORIGINAL -->
    <!-- LOCATOR: cartPage.inventoryItem -->
12. VERIFY "Sauce Labs Bike Light" appears in cart <!-- ORIGINAL -->
    <!-- LOCATOR: cartPage.inventoryItem -->
13. Click the "Checkout" button <!-- ORIGINAL -->
    <!-- LOCATOR: cartPage.checkoutButton -->

### CheckoutInfoPage (/checkout-step-one.html)

14. Enter "John" in the First Name field <!-- ORIGINAL -->
    <!-- LOCATOR: checkoutInfoPage.firstNameInput -->
15. Enter "Doe" in the Last Name field <!-- ORIGINAL -->
    <!-- LOCATOR: checkoutInfoPage.lastNameInput -->
16. Enter "90210" in the Zip/Postal Code field <!-- ORIGINAL -->
    <!-- LOCATOR: checkoutInfoPage.postalCodeInput -->
17. Click the "Continue" button <!-- ORIGINAL -->
    <!-- LOCATOR: checkoutInfoPage.continueButton -->

### CheckoutOverviewPage (/checkout-step-two.html)

18. VERIFY checkout overview displays "Checkout: Overview" <!-- ORIGINAL -->
    <!-- LOCATOR: checkoutOverviewPage.pageTitle -->
19. VERIFY item total displays "Item total: $49.99" <!-- ORIGINAL -->
    <!-- LOCATOR: checkoutOverviewPage.subtotalLabel -->
20. Click the "Finish" button <!-- ORIGINAL -->
    <!-- LOCATOR: checkoutOverviewPage.finishButton -->

### CheckoutCompletePage (/checkout-complete.html)

21. VERIFY confirmation page displays "Thank you for your order!" <!-- ORIGINAL -->
    <!-- LOCATOR: checkoutCompletePage.completeHeader -->
22. Click "Back Home" button <!-- ORIGINAL -->
    <!-- LOCATOR: checkoutCompletePage.backHomeButton -->

### InventoryPage (/inventory.html)

23. VERIFY inventory page displays "Products" <!-- ORIGINAL -->
    <!-- LOCATOR: inventoryPage.pageTitle -->
