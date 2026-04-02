# Shared Flows

Reusable plan fragments that can be included in any execution plan via the `INCLUDE` step type.

## Usage

In a plan.json:
```json
{
  "type": "INCLUDE",
  "action": { "flow": "shared-flows/login-orangehrm.plan-fragment.json" }
}
```

The replay engine inlines the fragment's steps at execution time. One place to update if the flow changes — all plans using it get the update automatically.

## File Format

A shared flow fragment is a JSON file with a `steps` array:
```json
{
  "name": "login-orangehrm",
  "description": "Login to OrangeHRM demo with ENV credentials",
  "steps": [
    {
      "id": 1,
      "description": "Navigate to login page",
      "type": "NAVIGATE",
      "action": { "url": "{{ENV.BASE_URL}}" }
    },
    {
      "id": 2,
      "description": "Fill username and password",
      "type": "ACTION",
      "action": {
        "verb": "fill_form",
        "fields": [
          { "target": { "role": "textbox", "name": "Username" }, "value": "{{ENV.TEST_USERNAME}}" },
          { "target": { "role": "textbox", "name": "Password" }, "value": "{{ENV.TEST_PASSWORD}}" }
        ]
      }
    },
    {
      "id": 3,
      "description": "Click Login",
      "type": "ACTION",
      "action": { "verb": "click", "target": { "role": "button", "name": "Login" } }
    },
    {
      "id": 4,
      "description": "Verify dashboard loaded",
      "type": "VERIFY",
      "action": { "assertion": "elementVisible", "target": { "role": "heading", "name": "Dashboard" } }
    }
  ]
}
```

## Naming Convention

`{flow-name}.plan-fragment.json`

Examples:
- `login-orangehrm.plan-fragment.json`
- `login-unify.plan-fragment.json`
- `setup-employee-data.plan-fragment.json`
- `cleanup-test-data.plan-fragment.json`
