# FPL Optimizer - Setup Guide

## 🚀 Quick Start

The FPL Optimizer now features a sleek **Futuristic Cyberpunk** theme with a redesigned Team Data Portal!

### Running Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000`

The server will proxy all API requests to the official FPL API, so everything works seamlessly!

## 🎨 Features

- **Futuristic Cyberpunk Design** - Neon cyan accents, animated scan lines, glowing effects
- **Team Data Portal** - Clean, modern interface for loading your FPL team
- **Metric Cards** - Hover effects, gradient accents, responsive grid layout
- **Full Mobile Support** - Responsive design works perfectly on all devices

## 🔧 Alternative: Deploy to Vercel

For production deployment:

```bash
npm run deploy
```

This will deploy to Vercel with serverless API functions.

## 📊 API Endpoints

The server provides these endpoints:

- `/api/bootstrap-static` - FPL bootstrap data (players, teams, etc.)
- `/api/fixtures` - Fixture data
- `/api/team?teamId=123456` - Team data for a specific team
- `/api/picks?teamId=123456&gw=15` - Team picks for a gameweek
- `/api/event-live?gw=15` - Live gameweek data

## 🎯 Usage

1. Enter your FPL Team ID (found in your FPL URL)
2. Click "LOAD DATA"
3. View your team stats, transfer suggestions, and captain picks
4. Navigate between Dashboard, Player Database, My Team, and Wildcard Builder

Enjoy the futuristic experience! 🚀✨
