# Scenario: Epic Table Data Navigation

## Module: table navigation

## Priority: P1-Standard

## Application

- **URL:** https://epicview-qa.powerappsportals.com/Experts/
- **Credentials:** username: `{{ENV.TEST_USERNAME}}` / password: `{{ENV.TEST_PASSWORD}}`

## Common Setup

1. Navigate to URL
2. Sign with user email `{{ENV.TEST_USERNAME}}`
3. Click on 'Next'
4. Fill password with `{{ENV.TEST_PASSWORD}}`
5. Click on 'Sign in'
6. VERIFY: 'National Speciality' link is displayed

**Tags:** smoke, P1

## Steps

1. Click on four-directional arrow link to the right of 'National Speciality' link
2. Wait for 'National Speciality' grid to reload
3. In the Grid header click on the up-down arrow for 'Speciality' header to sort
4. Wait for grid to reload
5. VERIFY: One of the up-down arrows of 'Speciality' header turns red
6. Again click on the up-down arrow for 'Speciality' header to sort
7. Wait for grid to reload
8. VERIFY: One of the up-down arrows of 'Speciality' header turns red
9. Click on the three dots right next to 'Speciality' header
10. VERIFY: Filter text box opens
11. Input text 'Sports' in the filter text box
12. Click 'Apply'
13. Wait for the grid to reload
14. VERIFY: All search results in 'Speciality' column contains 'Sports'
15. Check if there is pagination for search results
16. If pagination exists, click on next page in the pagination

    1. Wait for grid to reload
    2. VERIFY: Search results in 'Speciality' column contains 'Sports' with at least one search result
    3. Go back to the previous page from pagination
    4. Wait for grid to reload
17. Expand the 'By speciality' dropdown at the top right of the page and check if 'EPIC Accountants' option is visible

    1. If 'EPIC Accountants' option is visible, select 'EPIC Accountants'
    2. Click Submit
    3. Wait for 'National Speciality' grid to reload
    4. CAPTURE: Count the number of search results with 'EPIC Accountants' in the grid and store as {{secondPageSearchResults}}
    5. REPORT: Print the number of search results in second page {{secondPageSearchResults}}



## Notes for Analyst Agent

- This application has many grids and grids take several seconds to load after each interation.
- After the Common Setup, the 'National Specialty' appears but in a just a couple of seconds the page reloads. Wait for this reload and then proceed with Steps
