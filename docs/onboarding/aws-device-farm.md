# Onboarding — AWS Device Farm

This guide covers running the Agentic QE Framework v2's mobile tests on **AWS Device Farm**, Amazon's cloud-based mobile device testing service. Device Farm has a fundamentally different execution model from BrowserStack / Sauce Labs / LambdaTest — you don't list devices in `wdio.conf.ts`; instead you package your tests as a zip, upload it to Device Farm, and select a named **device pool** (a set of devices managed in the AWS console or via Terraform).

**Target audience:** teams in AWS-native organizations where Device Farm is the approved cloud testing service, or teams needing very large device pools (Device Farm has one of the broadest real-device catalogs among major cloud providers) with AWS billing already in place.

**Estimated time:** 60-120 minutes for first-time setup (mostly AWS IAM config + test bundle packaging).

**When to use Device Farm vs the other cloud farms:**
- ✅ Your organization is AWS-centric and prefers to keep testing inside AWS (unified billing, consolidated logs, SSO)
- ✅ You need to use private VPC resources (test apps that talk to AWS-hosted backends without going over the public internet)
- ✅ You want integration with other AWS services (CloudWatch alerts on test failures, S3 for artifact storage, Lambda triggered on test completion)
- ✅ Your organization's security policy forbids third-party cloud testing vendors but allows AWS
- ❌ You want the fastest / cleanest WDIO integration — the other vendors offer direct Appium endpoints; Device Farm's model is more indirect
- ❌ You want to iterate quickly — the zip-upload-and-wait-for-pool model is slower per iteration than direct Appium
- ❌ You only need a handful of devices — the other vendors are simpler for small test matrices

**Assumption:** you have already completed the core framework setup from the [main README](../../README.md#setup) — `npm install`, `npm run setup`, VS Code with GitHub Copilot installed, Node 18+ verified.

---

## 0. How AWS Device Farm Differs From the Other Cloud Farms

Before starting, understand the model. Device Farm is NOT a direct Appium endpoint — the framework doesn't point `wdio.conf.ts` at a Device Farm URL the way it does for BrowserStack or Sauce Labs.

**The Device Farm execution model:**

1. You package your **test project** (tests, dependencies, spec files) into a zip file in Device Farm's expected structure
2. You upload the zip + your app's APK/IPA to Device Farm via the `aws devicefarm` CLI or SDK
3. You create (or reference an existing) **device pool** — a named list of specific devices from Device Farm's catalog (e.g., "Android flagships Q1 2026" = Pixel 8 + Galaxy S23 + OnePlus 12)
4. You schedule a **test run** that ties together: your uploaded test project + your uploaded app + a device pool + optional configuration
5. Device Farm provisions sessions on each device in the pool, runs your tests, and reports results via the CLI or console

**Key implication:** the framework's `wdio.conf.ts` still runs — but it runs **inside Device Farm's device-side session**, not from your laptop. Your laptop (or CI runner) just kicks off the upload and polls for completion.

**Another key implication:** the `beforeSuite` hook and platform filter (`--mochaOpts.grep "@android-only|@cross-platform"`) still apply, because your wdio.conf.ts goes along for the ride in the zip. Device Farm doesn't alter the WDIO runtime — it just hosts it on the device.

---

## 1. Prerequisites

| Need | Why | Verify |
|---|---|---|
| **AWS account with Device Farm access** | The paid service backing everything | Log in to AWS Console → search "Device Farm" → should show a landing page |
| **IAM user or role with `AWSDeviceFarmFullAccess` managed policy** (or a narrower custom policy) | CLI calls require API credentials | IAM console → your user → Permissions |
| **AWS CLI v2 installed + configured** | `aws devicefarm` subcommands | `aws --version` → v2.x; `aws sts get-caller-identity` → should print your account + user |
| **Node.js 18+** | Framework requirement | `node --version` |
| **A built APK (Android) or signed IPA (iOS)** | The app under test | |
| **Your test project zipped in Device Farm's expected format** | Device Farm's "Appium Node.js test type" expects a specific zip layout | Covered in step 4 below |
| **Corporate approval for AWS Device Farm spend** | Device Farm bills per device-minute — pricing as of early 2026 is ~$0.17/device-minute for standard devices, higher for premium | Ask your FinOps / cloud admin |
| **IAM region = `us-west-2`** (Oregon) **for Device Farm** | Device Farm is currently only available in `us-west-2` | `aws configure get region` — if not `us-west-2`, you'll need to pass `--region us-west-2` on every command or reconfigure |

**Note on regional availability:** AWS Device Farm is only available in the US West (Oregon) region. All API calls must target `us-west-2` regardless of where your other AWS resources live. This is an AWS service constraint, not something the framework controls.

---

## 2. Configure the AWS CLI

```bash
# Install AWS CLI v2 if not already installed
# macOS
brew install awscli

# Linux (Ubuntu/Debian)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Windows
# Download and run https://awscli.amazonaws.com/AWSCLIV2.msi

# Verify
aws --version      # aws-cli/2.x.x

# Configure credentials (interactive — asks for Access Key ID, Secret Access Key, region, output format)
aws configure
# AWS Access Key ID: AKIA...
# AWS Secret Access Key: ...
# Default region name: us-west-2             ← MANDATORY for Device Farm
# Default output format: json

# Verify authentication works
aws sts get-caller-identity
# Should print your account number, user ARN, user ID
```

**Corporate gotcha — temporary credentials via SSO or AssumeRole:** if your org uses AWS SSO (IAM Identity Center), use `aws sso login` instead of static credentials, and make sure your SSO profile has a session long enough to outlast your test runs (Device Farm test runs can take 30-90 minutes for larger device pools). If your session expires mid-run, the CLI loses the ability to poll for results.

---

## 3. Create a Device Farm Project + Device Pool (One-Time Setup)

### Step 3a — Create a project

A Device Farm "project" is a container for uploads, device pools, and test runs. Create one via the AWS Console first (easier than CLI for first time):

1. Open the AWS Device Farm console → https://us-west-2.console.aws.amazon.com/devicefarm
2. Click **Create a new project**
3. Name it (e.g., `agentic-qe-mobile`)
4. Click **Create project**
5. Note the project ARN from the URL or the project details page — it looks like `arn:aws:devicefarm:us-west-2:123456789012:project:12345678-1234-1234-1234-123456789abc`

Or via CLI:
```bash
aws devicefarm create-project \
  --name "agentic-qe-mobile" \
  --region us-west-2
```
The response includes the project ARN. Save it as an env var for future commands:
```bash
export DF_PROJECT_ARN="arn:aws:devicefarm:us-west-2:123456789012:project:..."
```

### Step 3b — Create a device pool

A device pool is a named list of devices. You can create it via the AWS Console's device picker UI (easier) or via CLI with JSON rules.

**Console path:**
1. In your project → **Settings → Device pools → Create device pool**
2. Give it a name (e.g., `android-flagships`)
3. In the device selection UI, filter by `Platform: Android` and pick:
   - Google Pixel 8 (Android 14)
   - Samsung Galaxy S23 (Android 13)
   - OnePlus 12 (Android 14)
4. Click **Create device pool**
5. Note the pool ARN

**CLI equivalent** (more flexible but requires JSON):
```bash
aws devicefarm create-device-pool \
  --project-arn "$DF_PROJECT_ARN" \
  --name "android-flagships" \
  --rules '[
    {"attribute":"PLATFORM","operator":"EQUALS","value":"\"ANDROID\""},
    {"attribute":"MANUFACTURER","operator":"IN","value":"[\"Google\",\"Samsung\",\"OnePlus\"]"}
  ]' \
  --max-devices 10 \
  --region us-west-2
```

Save the pool ARN as an env var:
```bash
export DF_POOL_ARN="arn:aws:devicefarm:us-west-2:...:devicepool:..."
```

**iOS pool:** create a separate pool for iOS with `"attribute":"PLATFORM","operator":"EQUALS","value":"\"IOS\""`. iOS test runs use an entirely separate pool and upload.

---

## 4. Package the Test Bundle for Device Farm

This is the part that's unique to Device Farm and takes some care. Device Farm's "Appium Node.js" test type expects a specific zip structure.

### Expected zip layout

```
test-bundle.zip
├── package.json                       (with all dependencies declared)
├── wdio.conf.ts                       (or a Device Farm-specific variant)
├── tests/
│   └── mobile/
│       └── ... (all your spec files)
├── core/                              (framework runtime)
├── screens/                           (your screen objects)
├── locators/                          (your locator JSONs)
├── test-data/                         (your test data)
├── node_modules/                      (YES, bundled — Device Farm does not run npm install server-side)
└── ... (anything else your tests need at runtime)
```

**Critical point: `node_modules` must be bundled inside the zip.** Device Farm doesn't run `npm install` on the device — it executes your code as-is. If you omit `node_modules`, the tests fail immediately with "Cannot find module '@wdio/...'".

### Step 4a — Build the bundle

```bash
# From the framework root
cd output

# Install dependencies (you may have already done this; do it again to be sure it's up to date)
npm install

# Transpile TypeScript to JavaScript (Device Farm may not have tsc at runtime — safer to ship pre-compiled)
npx tsc --noEmit false --outDir ./dist
# If this produces errors you don't want to fix right now, you can ship .ts files and rely on ts-node at runtime,
# but it's slower and more fragile. Pre-compiling is recommended.

# Create the zip with the expected structure
zip -r ../device-farm-bundle.zip \
  package.json \
  wdio.conf.ts \
  tsconfig.json \
  tests/ \
  core/ \
  screens/ \
  pages/ \
  locators/ \
  test-data/ \
  node_modules/ \
  -x "**/node_modules/**/test/**" \
  -x "**/node_modules/**/tests/**" \
  -x "**/node_modules/**/docs/**" \
  -x "**/node_modules/**/*.md"       # exclude documentation from dependencies to shrink the zip

cd ..
ls -lh device-farm-bundle.zip
# Expect 80-300 MB depending on your dependency footprint
```

**Watch the bundle size.** Device Farm accepts uploads up to 2 GB, but large bundles take longer to upload and longer for each device to extract before tests start. Under 300 MB is typical; over 500 MB is a smell that you're shipping unused dependencies.

### Step 4b — Test the bundle locally before uploading

**Crucial sanity check:** unzip the bundle into a clean directory and try to run it. If it fails here, it will fail on Device Farm too — and Device Farm iteration is slower (upload + queue + run = 10-15 min round-trip minimum).

```bash
mkdir /tmp/df-test && cd /tmp/df-test
unzip /path/to/device-farm-bundle.zip
# Can you run a single spec against a local emulator without errors?
PLATFORM=android npx wdio run wdio.conf.ts --spec tests/mobile/parity/test-lifecycle-hooks.spec.ts
# If this fails → fix the bundle → re-zip → retry
```

---

## 5. Upload the Test Bundle + App to Device Farm

Device Farm has three separate upload types you'll use:
- `APPIUM_NODE_TEST_PACKAGE` — your test bundle zip
- `ANDROID_APP` (or `IOS_APP`) — your APK or IPA
- `APPIUM_NODE_TEST_SPEC` — an optional YAML spec that controls how tests run on the device (covered below)

### Step 5a — Upload the test bundle

```bash
# Create the upload record (Device Farm returns a pre-signed S3 URL to PUT the file to)
aws devicefarm create-upload \
  --project-arn "$DF_PROJECT_ARN" \
  --name "test-bundle.zip" \
  --type APPIUM_NODE_TEST_PACKAGE \
  --region us-west-2
# Response includes:
#   upload.arn   — save this
#   upload.url   — pre-signed S3 URL for PUT

# Save the ARN
export DF_BUNDLE_ARN="arn:aws:devicefarm:us-west-2:...:upload:..."

# PUT the zip to the pre-signed URL (use the URL from the response above)
curl -T device-farm-bundle.zip "<pre-signed-url-from-response>"

# Wait for Device Farm to process the upload (it validates + unpacks + checks format)
aws devicefarm get-upload --arn "$DF_BUNDLE_ARN" --region us-west-2 \
  --query 'upload.status' --output text
# Poll this every 10 seconds until it prints SUCCEEDED (may take 30-90 seconds)
```

If the status ends up `FAILED`, check `upload.message` in the full `get-upload` response — it usually tells you what's wrong with the zip structure (missing `node_modules`, wrong filename, corrupted zip, etc.).

### Step 5b — Upload the app

```bash
# Create upload record
aws devicefarm create-upload \
  --project-arn "$DF_PROJECT_ARN" \
  --name "app.apk" \
  --type ANDROID_APP \
  --region us-west-2

export DF_APP_ARN="arn:aws:devicefarm:us-west-2:...:upload:..."

# PUT the APK to the pre-signed URL
curl -T /path/to/your-app.apk "<pre-signed-url-from-response>"

# Wait for processing
aws devicefarm get-upload --arn "$DF_APP_ARN" --region us-west-2 \
  --query 'upload.status' --output text
```

For iOS, use `--type IOS_APP` and upload a signed IPA.

### Step 5c — (Optional) Upload a test spec YAML

Device Farm supports a "test spec" YAML file that controls what commands are run on the device during the test session. This is optional — if you don't provide one, Device Farm uses its default Appium Node.js test spec, which runs `npx wdio run wdio.conf.ts` inside the unzipped bundle.

The default spec works fine for most cases. If you need custom behavior (different wdio.conf.ts, additional env vars, pre/post commands), create a YAML file like this:

```yaml
# device-farm-testspec.yml
version: 0.1
phases:
  install:
    commands:
      - export NVM_DIR=$HOME/.nvm
      - . $NVM_DIR/nvm.sh
      - nvm use 20
      - node --version
  pre_test:
    commands:
      # $DEVICEFARM_TEST_PACKAGE_PATH is where Device Farm unzipped your bundle
      - cd $DEVICEFARM_TEST_PACKAGE_PATH
      - echo "PLATFORM=android" > .env
      - echo "APPIUM_HOST=localhost" >> .env
      - echo "APPIUM_PORT=4723" >> .env
  test:
    commands:
      - cd $DEVICEFARM_TEST_PACKAGE_PATH
      - PLATFORM=android npx wdio run wdio.conf.ts --mochaOpts.grep "@android-only|@cross-platform"
  post_test:
    commands:
      - echo "Test run complete"
artifacts:
  - $DEVICEFARM_TEST_PACKAGE_PATH/test-results
```

Upload it:
```bash
aws devicefarm create-upload \
  --project-arn "$DF_PROJECT_ARN" \
  --name "device-farm-testspec.yml" \
  --type APPIUM_NODE_TEST_SPEC \
  --region us-west-2

export DF_SPEC_ARN="arn:aws:devicefarm:us-west-2:...:upload:..."
curl -T device-farm-testspec.yml "<pre-signed-url>"
```

---

## 6. Schedule a Test Run

Once all three uploads are `SUCCEEDED`, schedule a run:

```bash
aws devicefarm schedule-run \
  --project-arn "$DF_PROJECT_ARN" \
  --app-arn "$DF_APP_ARN" \
  --device-pool-arn "$DF_POOL_ARN" \
  --name "mobile-regression-$(date +%Y%m%d-%H%M%S)" \
  --test "type=APPIUM_NODE,testPackageArn=$DF_BUNDLE_ARN,testSpecArn=$DF_SPEC_ARN" \
  --region us-west-2
# Response includes run.arn — save it to poll for status

export DF_RUN_ARN="arn:aws:devicefarm:us-west-2:...:run:..."
```

If you're not using a custom test spec, omit `testSpecArn` — Device Farm uses its default.

### Poll for run status

```bash
# Status goes: PENDING → SCHEDULING → PREPARING → RUNNING → COMPLETED
aws devicefarm get-run --arn "$DF_RUN_ARN" --region us-west-2 \
  --query 'run.{status:status, result:result, totalJobs:totalJobs, completedJobs:completedJobs}' \
  --output table
```

Polling tip: the run progresses through states slowly (15-30s per device provisioning + 30-60s per test). For a 3-device pool running a 5-minute test suite, expect total wall-clock time of 10-20 minutes from schedule to completion.

### Fetch results and artifacts

Once `status` is `COMPLETED`:
```bash
# List all jobs (one per device) in the run
aws devicefarm list-jobs --arn "$DF_RUN_ARN" --region us-west-2

# For each job, fetch artifacts (logs, screenshots, videos)
aws devicefarm list-artifacts \
  --arn "<job-arn>" \
  --type FILE \
  --region us-west-2

# Artifacts are in S3 — each has a `url` field. Download with curl.
```

---

## 7. Automate With a CI Pipeline

Doing the upload + schedule + poll by hand is tedious. Wrap it in a script or GitHub Action workflow.

### Example shell script — `scripts/devicefarm-run.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

PROJECT_ARN="$DF_PROJECT_ARN"
POOL_ARN="$DF_POOL_ARN"
APP_PATH="${1:-./app/build/outputs/apk/release/app-release.apk}"

# 1. Build the test bundle
cd output
npm install
zip -r ../device-farm-bundle.zip . -x "test-results/*" "reports/*" -q
cd ..

# 2. Upload the bundle
BUNDLE_RESPONSE=$(aws devicefarm create-upload \
  --project-arn "$PROJECT_ARN" \
  --name "bundle-$(date +%s).zip" \
  --type APPIUM_NODE_TEST_PACKAGE \
  --region us-west-2)
BUNDLE_ARN=$(echo "$BUNDLE_RESPONSE" | jq -r '.upload.arn')
BUNDLE_URL=$(echo "$BUNDLE_RESPONSE" | jq -r '.upload.url')
curl -sST device-farm-bundle.zip "$BUNDLE_URL"

# 3. Upload the app
APP_RESPONSE=$(aws devicefarm create-upload \
  --project-arn "$PROJECT_ARN" \
  --name "app-$(date +%s).apk" \
  --type ANDROID_APP \
  --region us-west-2)
APP_ARN=$(echo "$APP_RESPONSE" | jq -r '.upload.arn')
APP_URL=$(echo "$APP_RESPONSE" | jq -r '.upload.url')
curl -sST "$APP_PATH" "$APP_URL"

# 4. Wait for both uploads to process
for ARN in "$BUNDLE_ARN" "$APP_ARN"; do
  while true; do
    STATUS=$(aws devicefarm get-upload --arn "$ARN" --region us-west-2 --query 'upload.status' --output text)
    echo "Upload $ARN: $STATUS"
    [[ "$STATUS" == "SUCCEEDED" ]] && break
    [[ "$STATUS" == "FAILED" ]] && { echo "Upload failed: $ARN"; exit 1; }
    sleep 10
  done
done

# 5. Schedule the run
RUN_RESPONSE=$(aws devicefarm schedule-run \
  --project-arn "$PROJECT_ARN" \
  --app-arn "$APP_ARN" \
  --device-pool-arn "$POOL_ARN" \
  --name "ci-run-$(date +%Y%m%d-%H%M%S)" \
  --test "type=APPIUM_NODE,testPackageArn=$BUNDLE_ARN" \
  --region us-west-2)
RUN_ARN=$(echo "$RUN_RESPONSE" | jq -r '.run.arn')
echo "Run scheduled: $RUN_ARN"

# 6. Poll for completion
while true; do
  STATUS=$(aws devicefarm get-run --arn "$RUN_ARN" --region us-west-2 --query 'run.status' --output text)
  RESULT=$(aws devicefarm get-run --arn "$RUN_ARN" --region us-west-2 --query 'run.result' --output text)
  echo "Run status: $STATUS / $RESULT"
  [[ "$STATUS" == "COMPLETED" ]] && break
  sleep 30
done

# 7. Report
if [[ "$RESULT" == "PASSED" ]]; then
  echo "✅ All tests passed"
  exit 0
else
  echo "❌ Run result: $RESULT"
  exit 1
fi
```

### GitHub Actions wrapper

```yaml
# .github/workflows/device-farm.yml
name: AWS Device Farm Tests

on:
  push:
    branches: [main]

jobs:
  device-farm:
    runs-on: ubuntu-latest
    env:
      AWS_REGION: us-west-2
      DF_PROJECT_ARN: ${{ secrets.DF_PROJECT_ARN }}
      DF_POOL_ARN: ${{ secrets.DF_POOL_ARN }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-west-2

      - name: Install framework dependencies
        run: |
          npm install
          npm run setup
          cd output && npm install

      - name: Build APK
        run: |
          cd your-android-app
          ./gradlew assembleRelease

      - name: Run Device Farm tests
        run: |
          chmod +x scripts/devicefarm-run.sh
          scripts/devicefarm-run.sh ./your-android-app/app/build/outputs/apk/release/app-release.apk
```

---

## 8. Device Farm Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `aws devicefarm ...` returns "not authorized" errors | IAM user lacks Device Farm permissions | Attach `AWSDeviceFarmFullAccess` managed policy, or a narrower custom policy covering `devicefarm:*` |
| Upload status stuck at `PROCESSING` for >5 minutes | Bundle format issue — Device Farm is rejecting it silently | Fetch `upload.message` from `get-upload` — usually says "bundle missing node_modules" or "unsupported file layout". Re-check your zip structure against step 4. |
| Upload status `FAILED` with message "Unable to extract package" | Zip is corrupted or contains symbolic links that don't resolve | Rebuild the zip using `zip -ry` (follow symlinks) instead of `zip -r` |
| Run starts but all devices fail with "Test file not found" | Wrong entry point in test spec, or `wdio.conf.ts` isn't at bundle root | Verify the zip root contains `wdio.conf.ts` (not `output/wdio.conf.ts`). Make sure your test spec YAML's `cd` commands land in the right directory. |
| Run completes but all tests skipped | Mocha grep pattern doesn't match any test titles on the cloud device | Your specs probably don't have the platform tag (`@android-only`, `@ios-only`, `@cross-platform`) — see [README § Mobile Platform Targeting](../../README.md#mobile-platform-targeting--platform-header-convention). |
| Test runs take significantly longer than expected | Each device provisions + runs serially within its job, and device-pool provisioning has overhead (30-60s per device) | Expected behavior. Use smaller pools for faster iteration. Use larger pools for comprehensive regression (amortizes overhead across more tests). |
| Can't find run results in CloudWatch | Device Farm doesn't ship logs to CloudWatch by default | Set up a CloudWatch log destination in your Device Farm project settings, or download artifacts manually via `list-artifacts`. |
| Bundle size exceeds 2 GB limit | node_modules is too big | Exclude dev dependencies: `zip -r ... node_modules -x "**/typescript/lib/**" -x "**/*.md" -x "**/test/**"`. Or consider using `npm ci --production` before zipping. |
| iOS app upload fails | Unsigned IPA | Device Farm requires **development-signed** IPAs with proper provisioning profiles. It handles per-device re-signing for physical devices, but the base IPA must be validly signed. You cannot upload a simulator `.app` bundle — that's only for the iOS Simulator, not real devices. |
| Costs are much higher than expected | Large device pool × long test run × many runs per day | Review: (a) pool size — can you reduce to critical devices only? (b) use "unmetered" devices for frequent runs (flat monthly fee instead of per-minute), (c) skip Device Farm for smoke tests, reserve it for release gates |

---

## 9. Cost Management

Device Farm is expensive by default because of the per-device-minute pricing model. Strategies to keep it sustainable:

- **Metered vs unmetered devices**: Device Farm offers "unmetered device slots" as a flat monthly subscription (often more economical if you run >300 minutes/month on a specific device). Review which devices are frequently used and consider the unmetered option.
- **Smaller pools for most runs**: run against 1-2 flagship devices on every PR, reserve the 10-device pool for nightly regression or release gates.
- **Smoke tests elsewhere, Device Farm for release**: run smoke tests on local emulators or cheaper cloud (BrowserStack/LambdaTest) during development; use Device Farm only when release criteria demand real-AWS-device coverage.
- **Job timeouts**: set a sensible `--execution-configuration jobTimeoutMinutes=30` on your runs to prevent runaway sessions from burning budget.
- **Monitor with Cost Explorer**: set up AWS Cost Explorer alerts for `AWS Device Farm` service spend — catch overruns early.

---

## 10. What You Have Now

- An AWS account with Device Farm access in `us-west-2`
- A Device Farm project and at least one device pool (Android and/or iOS)
- A shell script (or GitHub Actions workflow) that builds your test bundle, uploads it, schedules a run, and polls for results
- A first successful test run against at least one real device in the cloud
- An understanding of the zip-upload model (vs. the direct-Appium model of BrowserStack/Sauce/LambdaTest)

**Next:** if you're running multi-vendor cloud tests (e.g., BrowserStack for PR checks + Device Farm for release gates), keep the two workflows separate and don't try to share the same `wdio.conf.ts`. Device Farm's execution model is distinct enough that bundling shared configuration adds more risk than it saves.

**Contribution ask:** if you build a working Device Farm workflow, please contribute a sample `ci/workflows/devicefarm.yml` + `scripts/devicefarm-run.sh` to the framework's repo. Device Farm setups are notoriously fragile in CI, and a known-good working example is gold for the next person.
