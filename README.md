# Website Monitor

A comprehensive website monitoring tool built with Next.js that provides real-time monitoring of websites with multiple monitoring capabilities.

## Features

### 🔍 **Website Monitoring**
- Real-time website availability checking
- HTTP status code monitoring
- Response time measurement
- Uptime tracking

### ⚡ **Response Time Monitoring**
- Precise response time measurement in milliseconds
- Performance categorization (good/warning/critical)
- Historical response time tracking

### 🌐 **DNS Monitoring**
- A record resolution
- MX record checking
- TXT record analysis
- NS record verification
- DNS resolution status tracking

### 🔒 **SSL Monitoring**
- SSL certificate validation
- Certificate expiration date checking
- Certificate issuer information
- Days until expiration calculation
- SSL status categorization

### 📅 **Domain Expiration Monitoring**
- Domain registration expiration date checking
- Days until domain expiration
- WHOIS data retrieval
- Expiration status alerts

### 🔌 **Port Monitoring**
- Common port scanning (21, 22, 23, 25, 53, 80, 110, 143, 443, 993, 995, 3306, 5432, 8080)
- Port status detection (open/closed/timeout)
- Response time measurement for open ports

### 🏓 **Ping Monitoring**
- Host reachability testing
- Ping response time measurement
- Network connectivity verification

### 🔍 **Keyword Monitoring**
- Content keyword searching
- Keyword occurrence counting
- Case-insensitive keyword matching
- Content change detection

### ⏰ **Scheduled Monitoring**
- Cron-based scheduling
- Automated monitoring jobs
- Email alert notifications
- Configurable monitoring intervals

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd website-monitor
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Immediate Monitoring
1. Navigate to the "Monitor Now" tab
2. Enter a website URL (e.g., `https://example.com`)
3. Optionally add a keyword to monitor
4. Click "Start Monitoring"
5. View comprehensive results

### Scheduled Monitoring
1. Navigate to the "Scheduled Monitoring" tab
2. Enter website URL and optional keyword
3. Set cron schedule (e.g., `*/5 * * * *` for every 5 minutes)
4. Click "Add Scheduled Job"
5. Monitor jobs and run them manually if needed

### API Endpoints

#### Monitor Website
```bash
POST /api/monitor
Content-Type: application/json

{
  "url": "https://example.com",
  "keyword": "optional keyword"
}
```

#### Manage Scheduled Jobs
```bash
# Add a scheduled job
POST /api/scheduled-monitor
{
  "id": "job_123",
  "config": {
    "url": "https://example.com",
    "keyword": "optional",
    "schedule": "*/5 * * * *"
  }
}

# Get all jobs
GET /api/scheduled-monitor

# Get specific job
GET /api/scheduled-monitor?id=job_123

# Update job
PUT /api/scheduled-monitor?id=job_123
{
  "config": { ... }
}

# Remove job
DELETE /api/scheduled-monitor?id=job_123
```

#### Run Job Immediately
```bash
POST /api/run-job
{
  "jobId": "job_123"
}
```

## Monitoring Results

The monitoring system provides detailed results including:

- **Website Status**: Online/Offline/Error with status codes
- **Response Time**: Measured in milliseconds with performance categorization
- **DNS Records**: A, MX, TXT, NS record information
- **SSL Certificate**: Validity, expiration, issuer details
- **Domain Expiration**: Registration expiration date and remaining days
- **Port Status**: Open/closed status for common ports
- **Ping Results**: Host reachability and response time
- **Keyword Analysis**: Keyword presence and occurrence count

## Email Notifications

Configure email alerts for monitoring jobs:

```javascript
{
  "emailNotifications": {
    "enabled": true,
    "recipients": ["admin@example.com"],
    "smtp": {
      "host": "smtp.gmail.com",
      "port": 587,
      "secure": false,
      "auth": {
        "user": "your-email@gmail.com",
        "pass": "your-app-password"
      }
    }
  },
  "alertThresholds": {
    "responseTime": 3000,
    "sslExpiryDays": 30,
    "domainExpiryDays": 30
  }
}
```

## Cron Schedule Examples

- `*/5 * * * *` - Every 5 minutes
- `0 */1 * * *` - Every hour
- `0 0 * * *` - Daily at midnight
- `0 0 * * 0` - Weekly on Sunday
- `0 0 1 * *` - Monthly on the 1st

## Technologies Used

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Node.js** - Server-side runtime
- **Puppeteer** - Browser automation
- **Lighthouse** - Performance auditing
- **Node-cron** - Scheduled tasks
- **Nodemailer** - Email notifications

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
