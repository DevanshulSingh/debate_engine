# ⚡ Debate Engine

A multi-agent AI debate tool where two agents argue opposite sides of any decision, and a judge gives a final verdict.

## Setup

### 1. Install dependencies
```bash
npm install express cors node-fetch@2
```

### 2. Add your Anthropic API key
Edit server.js and replace `your-anthropic-api-key-here` with your actual key from console.anthropic.com

### 3. Run
```bash
node server.js
```

### 4. Run permanently with PM2
```bash
npm install -g pm2
pm2 start server.js
pm2 save
pm2 startup
```

## Rate limits
Edit these in server.js:
```javascript
const MAX_DEBATES_PER_DAY = 5;
const MIN_SECONDS_BETWEEN = 1;
```

## Check usage
