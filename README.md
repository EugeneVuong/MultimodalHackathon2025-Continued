# Second Sight

A multimodal video‐search and live‐monitoring platform combining:

Automatic video captioning via Google Gemini
Text‐embedding search with Together AI & DeepLake
Live stream viewing & snapshots via VideoSDK
AI‐powered chat interface and alert actions

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Table of Contents
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [TODOs](#todos)
- [Learn More](#learn-more)
- [Deploy on Vercel](#deploy-on-vercel)

## Getting Started

First, navigate to the backend and create a virtual environment to install requirements:

```
cd backend
pip install -r requirements.txt
```

Then create a .env file in both the backend and frontend with the following keys:

```
# Backend Keys
GEMINI_API_KEY="YOUR-KEY-HERE"
TOGETHER_API_KEY="YOUR-KEY-HERE"
ACTIVELOOP_TOKEN = "YOUR-KEY-HERE"

```

```
# Frontend keys
VITE_FIREBASE_API_KEY="YOUR-KEY-HERE"
VITE_FIREBASE_AUTH_DOMAIN="YOUR-KEY-HERE"
VITE_FIREBASE_PROJECT_ID="YOUR-KEY-HERE"
VITE_FIREBASE_STORAGE_BUCKET="YOUR-KEY-HERE"
VITE_FIREBASE_MESSAGING_SENDER_ID="YOUR-KEY-HERE"
VITE_FIREBASE_APP_ID="YOUR-KEY-HERE"
VITE_FIREBASE_MEASUREMENT_ID="YOUR-KEY-HERE"

NEXT_PUBLIC_VIDEOSDK_AUTH_TOKEN="YOUR-KEY-HERE"


```

Then navigate to the frontend and run:
```
npm install
npm run dev
```

In the backend run:

```
python GoogleGemini.py

```
Also, in GoogleGemini.py, change the path to your own dataset created on Activeloop's DeepLake app at: https://app.activeloop.ai
```
# Change this to your own created dataset
path = "al://second-sight/video-recordings"
```

Now you can navigate to a browser at http://localhost:3000

You can access individual cameras at http://localhost:3000/camera where you will be prompted to enable your camera and the backend waits for motion detection which is then saved to the ActiveLoop database.

You can access the main dashboard with http://localhost:3000/dashboard where you can add camera systems and query for videos in the chat section on the right



Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Project Structure

This repository contains:

backend/: A FastAPI server that processes videos, stores frames, captions, and embeddings in a DeepLake dataset, and offers a /query endpoint.
frontend/: A Next.js (App Router) client with a dashboard for connecting to live streams, AI chat interface, and alert management.

The project follows the Next.js App Router structure:

```
├── app/                # Main application code
│   ├── components/     # Reusable UI components
│   ├── lib/            # Utility functions and shared code
│   ├── api/            # API routes
│   └── page.tsx        # Home page component
├── public/             # Static assets
├── styles/             # Global styles
└── types/              # TypeScript type definitions
```

## Contributing

We welcome contributions from the community! Here's how you can contribute:

1. **Fork the Repository**
   - Create your own fork of the project

2. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/project-name.git
   cd project-name
   ```

3. **Install Dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

4. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

5. **Make Your Changes**
   - Implement your feature or fix
   - Write or update tests as needed
   - Update documentation to reflect your changes

6. **Run Tests**
   ```bash
   npm test
   # or
   yarn test
   ```

7. **Commit Your Changes**
   ```bash
   git commit -m "Add feature: your feature description"
   ```

8. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

9. **Submit a Pull Request**
   - Go to the original repository on GitHub
   - Click "New Pull Request"
   - Select your fork and branch
   - Add a description of your changes
   - Submit the pull request

### Code Style

- We use ESLint and Prettier for code formatting
- Run `npm run lint` before submitting a PR
- Follow the existing code style and patterns

## TODOs

Here are some features and improvements we're looking to implement. Feel free to take on any of these tasks!

### High Priority
- [ ] Implement user authentication system
- [ ] Create responsive design for mobile devices
- [ ] Add comprehensive test coverage (unit and integration tests)
- [ ] Optimize performance and loading times

### Medium Priority
- [ ] Add dark mode support
- [ ] Implement internationalization (i18n)
- [ ] Create documentation for API endpoints
- [ ] Add more accessibility features

### Low Priority
- [ ] Set up CI/CD pipeline
- [ ] Add analytics tracking
- [ ] Create user onboarding experience
- [ ] Implement feature flags system

If you'd like to work on one of these TODOs, please comment on the related issue or create a new issue to discuss your approach before starting work.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
