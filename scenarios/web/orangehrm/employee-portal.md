# Employee Portal — Orange HRM

**Application:** Orange HRM Demo
**URL:** {{ENV.BASE_URL}}
**Type:** web
**Tags:** @regression, @P1

## Common Setup

1. Navigate to {{ENV.BASE_URL}}/web/index.php/auth/login
2. Enter "Admin" in the Username field
3. Enter "admin123" in the Password field
4. Click the "Login" button
5. VERIFY dashboard page displays "Dashboard"

## Common Setup Once

1. Navigate to {{ENV.BASE_URL}}/web/index.php/auth/login
2. VERIFY login page is loaded

### Scenario: Apply Leave

**Tags:** @leave, @P1

1. Click on "Leave" in the side menu
2. VERIFY Leave page displays "Leave List"
3. Click on "Apply" sub-menu item
4. Select "CAN - Vacation" from the Leave Type dropdown
5. Enter "2026-05-01" in the From Date field
6. Enter "2026-05-03" in the To Date field
7. Enter "Family vacation" in the Comments textarea
8. Click the "Apply" button
9. VERIFY success toast displays "Successfully Saved"
10. VERIFY leave request appears in the Leave List

### Scenario: Search Employee Directory

**Tags:** @directory, @P0

1. Click on "Directory" in the side menu
2. VERIFY Directory page displays "Directory"
3. Enter "John" in the Employee Name search field
4. Click the "Search" button
5. VERIFY search results contain "John"
6. CAPTURE employee count as {{directoryCount}}
7. REPORT "Found {{directoryCount}} employees matching 'John'"

### Scenario: Post Buzz Message

**Tags:** @buzz, @P2

1. Click on "Buzz" in the side menu
2. VERIFY Buzz page displays "Buzz"
3. Enter "Great team effort on the Q2 release!" in the post textarea
4. Click the "Post" button
5. VERIFY post appears in the Buzz feed with text "Great team effort on the Q2 release!"
6. SCREENSHOT buzz-post-confirmation

## Common Teardown

1. Click on the user dropdown in the top-right corner
2. Click "Logout"
3. VERIFY login page is displayed
