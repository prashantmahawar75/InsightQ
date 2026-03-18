# InsightQ - AI-Powered Business Intelligence Dashboard

InsightQ is a web application that enables non-technical users to generate interactive, AI-powered business intelligence dashboards through natural language queries. Simply ask questions in plain English (or use voice input) and get instant visualizations with AI-generated insights.

## Features

- **Natural Language Queries**: Ask questions in plain English, get SQL-powered results
- **Voice Input**: Speak your questions using Web Speech API (Chrome/Edge)
- **Interactive Charts**: Bar, Line, Pie, Scatter, and Area charts via Recharts
- **AI-Generated Insights**: 3-sentence narrative summaries with action recommendations
- **Anomaly Detection**: Automatic statistical outlier detection (2σ threshold)
- **Confidence Scoring**: Trust indicators (HIGH/MEDIUM/LOW) for every chart
- **CSV Upload**: Zero-setup analytics with automatic schema detection
- **Follow-up Suggestions**: AI-generated next questions based on your data
- **Dark/Light Theme**: Toggle between themes with persistence
- **PNG Export**: Export charts as images for sharing
- **Session Persistence**: Query history and charts persist across refreshes
- **Demo Mode**: Pre-cached responses when AI is unavailable

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- shadcn/ui components
- Recharts
- html2canvas

### Backend
- Node.js + Express
- SQLite (better-sqlite3)
- Google Gemini 1.5 Flash
- csv-parse

## Getting Started

### Prerequisites
- Node.js 18+
- Google Gemini API key (get one at https://aistudio.google.com/app/apikey)

### Installation

1. Clone the repository:
```bash
cd insightq
```

2. Install all dependencies:
```bash
npm run install:all
```

3. Configure environment variables:
```bash
# Create backend/.env file
cp backend/.env.example backend/.env
# Edit backend/.env and add your Gemini API key
```

4. Start the development servers:
```bash
npm run dev
```

This will start:
- Backend API: http://localhost:3001
- Frontend: http://localhost:3000

### Demo Dataset

The application comes pre-loaded with a demo dataset containing:
- 1,200+ sales records (Jan 2023 - Dec 2024)
- 4 regions: North, South, East, Southeast
- 6 product categories
- 23 sales representatives
- Intentional anomalies for testing:
  - August 2023 revenue spike (3σ above average)
  - Southeast Q1 2024 revenue dip (18% below regional average)

### Example Queries

Try these queries to explore the demo data:
- "Show me total revenue by product category for 2024"
- "Compare monthly revenue trends across all regions"
- "Which sales reps had the highest discount rates?"
- "What are the top 5 products by revenue?"

## Project Structure

```
insightq/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── query.ts      # Main query endpoint
│   │   │   └── upload.ts     # CSV upload endpoint
│   │   ├── services/
│   │   │   ├── gemini.ts     # Gemini API client
│   │   │   ├── sqlExecutor.ts
│   │   │   ├── schemaInjector.ts
│   │   │   ├── csvProcessor.ts
│   │   │   ├── confidenceSignals.ts
│   │   │   └── demoCache.ts
│   │   ├── data/
│   │   │   ├── seedData.ts   # Demo data generator
│   │   │   └── demoCache.json
│   │   └── types.ts
│   └── package.json
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── QueryInput.tsx
│   │   ├── ChartCard.tsx
│   │   ├── Sidebar.tsx
│   │   ├── DataHealthCard.tsx
│   │   ├── FollowUpChips.tsx
│   │   ├── ThemeToggle.tsx
│   │   └── ui/
│   ├── lib/
│   │   ├── anomalyDetector.ts
│   │   ├── confidenceScorer.ts
│   │   ├── formatters.ts
│   │   ├── localStorage.ts
│   │   ├── voiceInput.ts
│   │   └── types.ts
│   └── package.json
└── package.json
```

## API Endpoints

### POST /api/query
Execute a natural language query against the database.

Request:
```json
{
  "query": "Show me total revenue by category",
  "sessionContext": ["previous query 1", "previous query 2"],
  "dataSource": "demo",
  "tableName": "optional_csv_table_name",
  "feedbackContext": "optional feedback for re-runs"
}
```

Response:
```json
{
  "chartConfigs": [...],
  "narrative": "3-sentence AI summary",
  "followUps": ["question 1", "question 2", "question 3"],
  "confidence": "HIGH",
  "sqlHealth": "first_try",
  "rowCount": 42,
  "sql": "SELECT ..."
}
```

### POST /api/upload
Upload and process a CSV file.

Request: `multipart/form-data` with `file` field

Response:
```json
{
  "tableName": "csv_filename_abc123",
  "schema": [...],
  "healthCard": {...},
  "starterQuestions": [...]
}
```

## Security

- All SQL is constrained to SELECT statements only
- Dangerous keywords (DROP, DELETE, INSERT, etc.) are blocked via regex
- API keys are stored only on the backend
- User input is validated before processing

## License

MIT
