# Deploying to Microsoft Azure Container Apps

This guide outlines how to deploy the Web Screen Capture Server on Microsoft Azure Container Apps using the existing Dockerfile. 

Azure Container Apps is a serverless container hosting platform. Unlike Render's 512MB RAM limit, Azure allows you to easily configure your container to use **1.0 to 2.0 Cores of CPU** and **2.0 to 4.0 GiB of RAM**, which completely prevents Out-of-Memory (OOM) crashes during Chromium and FFmpeg video capture.

---

## Step 1: Sign Up for Azure Free Credits
1. Go to [azure.microsoft.com/free](https://azure.microsoft.com/free).
2. Click **Start free** and log in with a Microsoft account.
3. Complete the verification. This will give you **$200 USD (or equivalent in your currency) of free credits** valid for 30 days, which is more than enough to test and run this service.

---

## Step 2: Create a Container App in the Azure Portal
1. Log in to the [Azure Portal](https://portal.azure.com/).
2. Search for **Container Apps** in the top search bar and click on it.
3. Click **Create** (or **Create container app**).
4. Fill in the **Basics** tab:
   - **Subscription**: Select your Free Trial subscription.
   - **Resource Group**: Click *Create new* and name it `web-scrapper-rg`.
   - **Container App Name**: Enter a name (e.g., `web-scrapper-recorder-api`).
   - **Region**: Choose a region close to you or Europe (e.g., `West Europe` or `East US 2`).
   - **Container Apps Environment**: Leave the default name or create a new one.

---

## Step 3: Configure Deployment from GitHub
1. Click **Next: Container >** to go to the Container tab.
2. Uncheck **Use quickstart image**.
3. Under **Deployment source**, select **GitHub**.
4. Click **Authorize** to connect your GitHub account.
5. Once authorized, select the repository details:
   - **Organization**: Your GitHub username.
   - **Repository**: `Web-Scracpper-Recorder-API` (or your repository name).
   - **Branch**: `main`.
6. Under **Build configuration**:
   - **Build type**: Select **Dockerfile**.
   - **Dockerfile path**: Leave it as `./Dockerfile` (our root Dockerfile).
   - **Context path**: Leave it as `./`.

---

## Step 4: Configure CPU, RAM, and Ingress
1. On the same Container tab, scroll down to **Container resource allocation**:
   - **CPU**: Select **1.0 CPU Cores** (or 2.0 for faster video encoding).
   - **Memory**: Select **2.0 GiB** (or 4.0 GiB for ultra-smooth 1080p60 recording). **This is the key setting that prevents crashes!**

2. Click **Next: Ingress >** to go to Ingress settings:
   - **Ingress**: Select **Enabled**.
   - **Target Port**: Enter **`3000`** (matching our Express server port).
   - **Traffic**: Select **Accepting traffic from anywhere** (External).

---

## Step 5: Add Environment Variables
1. Scroll down to the **Environment variables** section.
2. Click **Add** to add the parameters from your local `.env` file:
   - `NODE_ENV` = `production`
   - `VIDEO_OUTPUT_DIR` = `./videos`
   - `AUDIO_OUTPUT_DIR` = `./audio`
   - `MAX_DURATION` = `300`
   - `REPLICATE_API_TOKEN` = `your_replicate_token_here`
   - `FIREBASE_CREDENTIALS` = `your_minified_firebase_json_here` *(Use the single-line minified JSON string we built)*
   - `R2_ACCESS_KEY_ID` = `your_cloudflare_r2_access_key`
   - `R2_SECRET_ACCESS_KEY` = `your_cloudflare_r2_secret_key`
   - `R2_ENDPOINT` = `https://your-account-id.r2.cloudflarestorage.com`
   - `R2_BUCKET_NAME` = `webscrapping`
   - `R2_PUBLIC_URL_PREFIX` = `https://your-public-url.dev`
   - `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` = `true`
   - `PUPPETEER_EXECUTABLE_PATH` = `/usr/bin/chromium`

---

## Step 6: Create and Build
1. Click **Review + create** at the bottom.
2. Once validation passes, click **Create**.
3. Azure will start creating the resources. This also automatically generates a GitHub Actions workflow in your GitHub repository (`.github/workflows/`) that builds the Docker container and pushes it to Azure.
4. Once deployment finishes, Azure will display your app URL (e.g. `https://web-scrapper-recorder-api.agreeablecliff-12345.eastus2.azurecontainerapps.io`).
5. Access your UI dashboard by visiting:
   `https://<your-azure-app-url>/scrapper`

Any future changes you push to GitHub will automatically trigger a new build and update the Azure service!
