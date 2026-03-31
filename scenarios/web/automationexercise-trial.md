# Scenario: AutomationExercise Signup, Shop, Checkout, and Invoice Verification

## Metadata
- **Module:** E2E Shopping Flow
- **Priority:** P1
- **Type:** web
- **Tags:** e2e, regression, P1, signup, cart, checkout, payment, invoice
- **Depends On:** None
- **Produces:** None

## Application
- **URL:** {{ENV.BASE_URL}}

## Pre-conditions
- Application accessible at {{ENV.BASE_URL}} (https://automationexercise.com/)
- Signup email must not already be registered (use a unique email per run)

## Detail Level: HIGH (User provided detailed steps, items, form fields, and verifications)
Steps below closely follow the user's specification. The Explorer-Builder will discover
actual selectors, page structure, and interaction mechanics in the live browser.

## Steps

### Signup Flow
1. Navigate to {{ENV.BASE_URL}}
2. Click on "Signup / Login" link
3. Enter "QA Demo" as name and {{ENV.SIGNUP_EMAIL}} as email in the "New User Signup!" form. The Signup email must not already be registered (use a unique email per run).
4. Click "Next" button.
5. Enter {{ENV.SIGNUP_PASSWORD}} in the password field
6. Click the "Signup" button
7. VERIFY: Account information form is displayed (signup page with title, password, DOB fields)
8. Select title "Mr"
9. Select date of birth: Day 1, Month February, Year 1999
10. Fill in first name "QA" and last name "Demo"
10. Fill in address: "Brigade Sparkle, Vishweshwar Nagar", Country "India", State "Karnataka", City "Mysore", Zipcode "570008"
11. Enter mobile number "9876543210"
12. Click "Create Account" button
13. VERIFY: "ACCOUNT CREATED!" message is displayed
14. SCREENSHOT: account-created
15. Click "Continue" button

### Shopping Flow — Note Prices and Add to Cart
16. Navigate to the Products page
17. Locate "Blue Top" product
18. CAPTURE: Read the price of "Blue Top" as {{blueTopPrice}}
19. REPORT: Print Blue Top price = {{blueTopPrice}}
20. Add "Blue Top" to cart
21. Click "Continue Shopping" to remain on products page
22. Locate "Men Tshirt" product
23. CAPTURE: Read the price of "Men Tshirt" as {{menTshirtPrice}}
24. REPORT: Print Men Tshirt price = {{menTshirtPrice}}
25. Add "Men Tshirt" to cart
26. Click "Continue Shopping" to remain on products page
27. Locate "Fancy Green Top" product
28. CAPTURE: Read the price of "Fancy Green Top" as {{fancyGreenTopPrice}}
29. REPORT: Print Fancy Green Top price = {{fancyGreenTopPrice}}
30. Add "Fancy Green Top" to cart
31. Click "Continue Shopping" to remain on products page
32. Locate "Frozen Tops For Kids" product
33. CAPTURE: Read the price of "Frozen Tops For Kids" as {{frozenTopPrice}}
34. REPORT: Print Frozen Tops For Kids price = {{frozenTopPrice}}
35. Add "Frozen Tops For Kids" to cart

### Cart Verification
36. Navigate to Cart page
37. VERIFY: "Blue Top" is displayed in the cart
38. VERIFY: "Men Tshirt" is displayed in the cart
39. VERIFY: "Fancy Green Top" is displayed in the cart
40. VERIFY: "Frozen Tops For Kids" is displayed in the cart
41. VERIFY: Blue Top price in cart matches {{blueTopPrice}}
42. VERIFY: Men Tshirt price in cart matches {{menTshirtPrice}}
43. VERIFY: Fancy Green Top price in cart matches {{fancyGreenTopPrice}}
44. VERIFY: Frozen Tops For Kids price in cart matches {{frozenTopPrice}}
45. SCREENSHOT: cart-with-all-items

### Checkout — Address Verification
46. Click "Proceed To Checkout" button
47. VERIFY: Delivery address name contains "QA Demo"
48. VERIFY: Billing address contains "Brigade Sparkle, Vishweshwar Nagar"
49. VERIFY: Billing address contains "Mysore" and "Karnataka" and "570008"
50. VERIFY: Delivery address matches billing address (same name, street, city, state, zip)

### Order Review — Item and Price Verification
51. VERIFY: "Blue Top" is listed in the order review
52. VERIFY: "Men Tshirt" is listed in the order review
53. VERIFY: "Fancy Green Top" is listed in the order review
54. VERIFY: "Frozen Tops For Kids" is listed in the order review
55. VERIFY: Item prices in order review match captured prices ({{blueTopPrice}}, {{menTshirtPrice}}, {{fancyGreenTopPrice}}, {{frozenTopPrice}})
56. CALCULATE: {{expectedTotal}} = {{blueTopPrice}} + {{menTshirtPrice}} + {{fancyGreenTopPrice}} + {{frozenTopPrice}}
57. CAPTURE: Read the total price displayed as {{totalPrice}}
58. VERIFY: Total price {{totalPrice}} matches {{expectedTotal}}
59. REPORT: Print total price = {{totalPrice}}

### Place Order
60. Enter delivery note: "Delivery only on weekends from 9AM to 6PM" in the comment text area
61. Click "Place Order" button

### Payment
62. Enter "QA Demo" as name on card
63. Enter {{ENV.CARD_NUMBER}} as card number
64. Enter {{ENV.CARD_CVC}} as CVC
65. Enter {{ENV.CARD_EXP_MONTH}} as expiration month
66. Enter {{ENV.CARD_EXP_YEAR}} as expiration year
67. Click "Pay and Confirm Order" button

### Order Confirmation and Invoice
68. VERIFY: Order confirmation message "Congratulations! Your order has been confirmed!" is displayed
69. SCREENSHOT: order-confirmed
70. Click "Download Invoice" button
71. VERIFY: Invoice file is downloaded successfully to OS' default Downloads folder
72. VERIFY: Downloaded invoice contains the name "QA Demo"
73. VERIFY: Downloaded invoice total price matches {{totalPrice}}
74. SCREENSHOT: invoice-verified

### Logout
75. Click "Logout" link
76. VERIFY: User is redirected to the login/signup page

## Test Data
| Field | Value | Notes |
|-------|-------|-------|
| signupName | QA Demo | Full display name for signup |
| signupEmail | {{ENV.SIGNUP_EMAIL}} | Must be unique per run — e.g., qademo0991@gmail.com |
| signupPassword | {{ENV.SIGNUP_PASSWORD}} | From environment |
| title | Mr | Account title |
| dob | 01-Feb-1999 | Date of birth |
| firstName | QA | First name |
| lastName | Demo | Last name |
| address | Brigade Sparkle, Vishweshwar Nagar | Street address |
| country | India | Country |
| state | Karnataka | State |
| city | Mysore | City |
| zipcode | 570008 | Zipcode |
| phone | 9876543210 | Mobile number |
| product1 | Blue Top | First product to add |
| product2 | Men Tshirt | Second product to add |
| product3 | Fancy Green Top | Third product to add |
| product4 | Frozen Tops For Kids | Fourth product to add |
| cardName | QA Demo | Name on card |
| cardNumber | {{ENV.CARD_NUMBER}} | e.g., 1234 5678 9810 1234 |
| cardCVC | {{ENV.CARD_CVC}} | e.g., 585 |
| cardExpMonth | {{ENV.CARD_EXP_MONTH}} | e.g., 02 |
| cardExpYear | {{ENV.CARD_EXP_YEAR}} | e.g., 2032 |
| deliveryNote | Delivery only on weekends from 9AM to 6PM | Comment for order |

## Notes
- This scenario has **76 steps** — subagent splitting recommended. Natural breakpoints:
  - **Scenario A (Steps 1-15):** Signup flow
  - **Scenario B (Steps 16-45):** Shopping and cart verification
  - **Scenario C (Steps 46-76):** Checkout, payment, invoice, and logout
- The site may show ads or consent popups — Explorer-Builder should dismiss if encountered
- "Continue Shopping" modal appears after adding each item to cart — Explorer-Builder must handle this
- Products page may require scrolling to find all four items
- Invoice is a downloadable file — Explorer-Builder must use Playwright download handling
- Invoice content verification may require reading the downloaded file (PDF or text)
- The site uses standard HTML form elements — no SSO, no complex auth

## Notes for Explorer-Builder
- Products may be on the main products page or require search/scrolling to locate
- The "Add to cart" button may appear on hover over the product card
- After adding to cart, a modal dialog appears with "Continue Shopping" and "View Cart" buttons
- The checkout page has separate "Delivery Address" and "Billing Address" sections
- Payment form fields are standard HTML inputs
- Invoice download triggers a file download — use `waitForEvent('download')` pattern
- To verify invoice contents, read the downloaded file after download completes
