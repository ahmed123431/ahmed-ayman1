# RCMAPP - Reliability Centered Maintenance Application

A simple, modern web application for collecting asset data and displaying RCM analysis results powered by n8n automation.

## Overview

RCMAPP is a streamlined data collection and visualization tool that:
- Collects project and asset information from users
- Sends data to n8n for automated RCM analysis
- Displays analysis results in a clean, professional dashboard

## Application Flow

```
Login/SignUp → Subscription → Projects → Asset Addition → Dashboard
     ↓              ↓            ↓            ↓              ↓
  Authenticate   Choose Plan  Manage      Send to n8n   View Results
                              Projects      ↓ ↑          from n8n
                                          n8n Analysis
```

## Pages

### 1. Login / Sign Up
- User authentication
- **Route**: `/login`, `/signup`

### 2. Subscription
- Choose subscription plan (Basic, Professional, Enterprise)
- **Route**: `/subscription`

### 3. Projects
- Create and manage RCM projects
- View all projects
- Navigate to asset addition
- **Route**: `/` (home)

### 4. Asset Management (Asset Addition)
- Input asset information
- Send data to n8n webhook
- **Route**: `/assets`
- **Sends to**: n8n input webhook

### 5. Dashboard
- Display RCM analysis results
- Fetch data from n8n webhook
- Show risk assessment, maintenance recommendations, and cost analysis
- **Route**: `/dashboard`
- **Receives from**: n8n output webhook

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Routing**: React Router
- **Styling**: CSS Variables (custom design system)
- **Icons**: Lucide React
- **Automation**: n8n webhooks

## Design System

The app uses a custom design system with:
- **Primary Colors**: Industrial Blue (`--primary-*`)
- **Accent Colors**: Safety Orange (`--accent-*`)
- **Dark Mode First**: Optimized for dark theme
- **Responsive**: Mobile and web compatible
- **Simple & Clean**: Minimal complexity, maximum clarity

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- n8n instance (for production use)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd RCMAPP
```

2. Install dependencies:
```bash
npm install
```

3. Configure n8n webhooks (see [N8N_INTEGRATION_GUIDE.md](./N8N_INTEGRATION_GUIDE.md))

4. Start development server:
```bash
npm run dev
```

5. Open browser to `http://localhost:5176`

## Configuration

### n8n Webhook URLs

Update these files with your n8n webhook URLs:

**`src/pages/AssetManagement.tsx`** (line ~66):
```typescript
const n8nWebhookUrl = 'YOUR_N8N_WEBHOOK_URL_HERE';
```

**`src/pages/Dashboard.tsx`** (line ~53):
```typescript
const n8nResultsWebhookUrl = 'YOUR_N8N_RESULTS_WEBHOOK_URL_HERE';
```

See [N8N_INTEGRATION_GUIDE.md](./N8N_INTEGRATION_GUIDE.md) for detailed setup instructions.

## Project Structure

```
RCMAPP/
├── src/
│   ├── pages/
│   │   ├── Login.tsx              # Authentication
│   │   ├── SignUp.tsx             # User registration
│   │   ├── Subscription.tsx       # Plan selection
│   │   ├── Projects.tsx           # Project management
│   │   ├── AssetManagement.tsx    # Asset data input
│   │   └── Dashboard.tsx          # Results display
│   ├── App.tsx                    # Main app & routing
│   └── index.css                  # Design system
├── N8N_INTEGRATION_GUIDE.md       # n8n setup guide
└── README.md                      # This file
```

## Data Flow

### Input Flow (Asset Addition → n8n)

```javascript
{
  project_id: "string",
  asset_data: {
    equipment_name: "string",
    tag_number: "string",
    system: "string",
    manufacturer: "string",
    model: "string",
    criticality_level: "High" | "Medium" | "Low",
    installation_date: "YYYY-MM-DD",
    operating_hours_per_day: number,
    created_at: "ISO timestamp"
  }
}
```

### Output Flow (n8n → Dashboard)

```javascript
{
  asset_info: {
    equipment_name: string,
    tag_number: string,
    criticality_level: string
  },
  risk_assessment: {
    overall_risk: string,
    risk_priority_number: number,
    failure_modes: number
  },
  maintenance_recommendations: {
    frequency: string,
    type: string,
    priority: string
  },
  cost_analysis: {
    estimated_annual_cost: number,
    potential_savings: number
  },
  analysis_timestamp: string
}
```

## Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check
```

### Adding New Features

The app is intentionally simple. When adding features:
1. Keep the UI clean and minimal
2. Maintain the existing color scheme
3. Follow the page flow: Login → Subscription → Projects → Assets → Dashboard
4. Ensure n8n integration points are clearly documented

## Production Deployment

1. Update n8n webhook URLs to production instances
2. Build the app: `npm run build`
3. Deploy the `dist` folder to your hosting provider
4. Configure environment variables for sensitive data
5. Set up HTTPS for all communications

## Troubleshooting

See [N8N_INTEGRATION_GUIDE.md](./N8N_INTEGRATION_GUIDE.md) for n8n-specific troubleshooting.

### Common Issues

**App won't start:**
- Run `npm install` to ensure dependencies are installed
- Check Node.js version (18+ required)

**Data not sending to n8n:**
- Verify webhook URLs are correct
- Check browser console for errors
- Ensure n8n workflows are activated

**Dashboard shows mock data:**
- This is expected when n8n is not configured
- Configure webhooks to see real data

## License

[Your License Here]

## Support

For n8n integration help, see [N8N_INTEGRATION_GUIDE.md](./N8N_INTEGRATION_GUIDE.md)

For app issues, contact [your support channel]
