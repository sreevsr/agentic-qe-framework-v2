# Employee Portal — Orange HRM

**Application:** Orange HRM Demo
**URL:** {{ENV.BASE_URL}}
**Type:** web
**Tags:** @regression, @P1

## Metadata

- Total steps: 28
- Pages discovered: 6 (LoginPage, DashboardPage, LeavePage, DirectoryPage, BuzzPage)
- Elements verified: 24/28
- Explorer status: COMPLETE

## Common Setup

### LoginPage (/web/index.php/auth/login)

1. Navigate to {{ENV.BASE_URL}}/web/index.php/auth/login <!-- ORIGINAL -->
   <!-- LOCATOR: loginPage.url -->
2. Enter "Admin" in the Username field <!-- ORIGINAL -->
   <!-- LOCATOR: loginPage.usernameInput -->
3. Enter "admin123" in the Password field <!-- ORIGINAL -->
   <!-- LOCATOR: loginPage.passwordInput -->
4. Click the "Login" button <!-- ORIGINAL -->
   <!-- LOCATOR: loginPage.loginButton -->

### DashboardPage (/web/index.php/dashboard/index)

5. VERIFY dashboard page displays "Dashboard" <!-- ORIGINAL -->
   <!-- LOCATOR: dashboardPage.pageTitle -->

## Common Setup Once

### LoginPage (/web/index.php/auth/login)

1. VERIFY login page is loaded <!-- ORIGINAL -->
   <!-- LOCATOR: loginPage.loginForm -->

### Scenario: Apply Leave

**Tags:** @leave, @P1

### LeavePage (/web/index.php/leave/viewLeaveList)

1. Click on "Leave" in the side menu <!-- ORIGINAL -->
   <!-- LOCATOR: sideMenu.leaveLink -->
2. VERIFY Leave page displays "Leave List" <!-- ORIGINAL -->
   <!-- LOCATOR: leavePage.pageTitle -->
3. Click on "Apply" sub-menu item <!-- ORIGINAL -->
   <!-- LOCATOR: leavePage.applySubMenu -->

### LeaveApplyPage (/web/index.php/leave/applyLeave)

4. Select "US - Sick Leave" from the Leave Type dropdown <!-- ORIGINAL -->
   <!-- LOCATOR: leaveApplyPage.leaveTypeDropdown -->
5. Enter "2026-05-01" in the From Date field <!-- ORIGINAL -->
   <!-- LOCATOR: leaveApplyPage.fromDateInput -->
6. Enter "2026-05-03" in the To Date field <!-- ORIGINAL -->
   <!-- LOCATOR: leaveApplyPage.toDateInput -->
7. Enter "Family vacation" in the Comments textarea <!-- ORIGINAL -->
   <!-- LOCATOR: leaveApplyPage.commentsTextarea -->
8. Click the "Apply" button <!-- ORIGINAL -->
   <!-- LOCATOR: leaveApplyPage.applyButton -->
9. VERIFY success toast displays "Successfully Submitted" <!-- ORIGINAL -->
   <!-- LOCATOR: leaveApplyPage.successToast -->
10. VERIFY leave request appears in the Leave List <!-- ORIGINAL -->
    <!-- LOCATOR: leavePage.leaveListTable -->

### Scenario: Search Employee Directory

**Tags:** @directory, @P0

### DirectoryPage (/web/index.php/directory/viewDirectory)

1. Click on "Directory" in the side menu <!-- ORIGINAL -->
   <!-- LOCATOR: sideMenu.directoryLink -->
2. VERIFY Directory page displays "Directory" <!-- ORIGINAL -->
   <!-- LOCATOR: directoryPage.pageTitle -->
3. Enter "John" in the Employee Name search field <!-- ORIGINAL -->
   <!-- LOCATOR: directoryPage.employeeNameInput -->
4. Click the "Search" button <!-- ORIGINAL -->
   <!-- LOCATOR: directoryPage.searchButton -->
5. VERIFY search results contain "John" <!-- ORIGINAL -->
   <!-- LOCATOR: directoryPage.searchResults -->
6. Click on the first employee result card <!-- ORIGINAL -->
7. CAPTURE employee count as {{directoryCount}} <!-- ORIGINAL -->
   <!-- LOCATOR: directoryPage.resultCount -->
8. REPORT "Found {{directoryCount}} employees matching 'John'"

### Scenario: Post Buzz Message

**Tags:** @buzz, @P2

### BuzzPage (/web/index.php/buzz/viewBuzz)

1. Click on "Buzz" in the side menu <!-- ORIGINAL -->
   <!-- LOCATOR: sideMenu.buzzLink -->
2. VERIFY Buzz page displays "Buzz" <!-- ORIGINAL -->
   <!-- LOCATOR: buzzPage.pageTitle -->
3. Enter "Great team effort on the Q2 release!" in the post textarea <!-- ORIGINAL -->
   <!-- LOCATOR: buzzPage.postTextarea -->
4. Click the "Post" button <!-- ORIGINAL -->
   <!-- LOCATOR: buzzPage.postButton -->
5. VERIFY post appears in the Buzz feed with text "Great team effort on the Q2 release!" <!-- ORIGINAL -->
   <!-- LOCATOR: buzzPage.feedPost -->

## Common Teardown

### DashboardPage (/web/index.php/dashboard/index)

1. Click on the user dropdown in the top-right corner <!-- ORIGINAL -->
   <!-- LOCATOR: dashboardPage.userDropdown -->
2. Click "Sign Out" <!-- ORIGINAL -->
   <!-- LOCATOR: dashboardPage.logoutLink -->

### LoginPage (/web/index.php/auth/login)

3. VERIFY login page is displayed <!-- ORIGINAL -->
   <!-- LOCATOR: loginPage.loginForm -->
