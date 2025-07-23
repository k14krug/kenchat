# Cost Tracking and Monitoring System

This document describes the comprehensive cost tracking and monitoring system implemented for the personal chatbot application. The system provides detailed usage logging, cost calculation, reporting, and limit enforcement for OpenAI API usage.

## Features

### ✅ Implemented Features

- **Usage Logging**: Automatic logging of all OpenAI API calls with detailed metadata
- **Cost Calculation**: Real-time cost calculation using current OpenAI pricing
- **Time-based Summaries**: Cost summaries by daily, weekly, and monthly periods
- **Cost Limits & Warnings**: Configurable spending limits with warning thresholds
- **Detailed Reporting**: Per-conversation and per-user cost breakdowns
- **REST API**: Complete API endpoints for cost tracking operations
- **Comprehensive Tests**: 57 unit tests covering all functionality

## Architecture

### Components

1. **UsageLog Model** (`src/models/UsageLog.ts`)
   - Defines data structures for usage tracking
   - Includes cost summaries, breakdowns, and reporting interfaces

2. **UsageLogRepository** (`src/repositories/UsageLogRepository.ts`)
   - Database operations for usage logs
   - Aggregation queries for statistics and reports
   - Pagination and filtering support

3. **CostTrackingService** (`src/services/CostTrackingService.ts`)
   - Core business logic for cost tracking
   - Cost limit enforcement and warnings
   - Report generation and statistics

4. **CostTrackingController** (`src/controllers/CostTrackingController.ts`)
   - REST API endpoints for cost tracking
   - Request validation and response formatting

5. **OpenAIService Integration**
   - Enhanced with cost tracking capabilities
   - Automatic usage logging for all API calls

## Database Schema

The system uses a `usage_logs` table with the following structure:

```sql
CREATE TABLE usage_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  conversation_id INT,
  action_type ENUM('message_sent', 'message_received', 'summary_created', 'persona_used') NOT NULL,
  model VARCHAR(100),
  tokens_used INT DEFAULT 0,
  cost_usd DECIMAL(10, 6) DEFAULT 0.000000,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
  
  INDEX idx_user_id (user_id),
  INDEX idx_conversation_id (conversation_id),
  INDEX idx_action_type (action_type),
  INDEX idx_created_at (created_at)
);
```

## Configuration

Add these environment variables to your `.env` file:

```bash
# Cost tracking configuration
COST_TRACKING_ENABLED=true
COST_TRACKING_DAILY_LIMIT=10.00
COST_TRACKING_WEEKLY_LIMIT=50.00
COST_TRACKING_MONTHLY_LIMIT=200.00
COST_TRACKING_WARNING_THRESHOLD=80
COST_TRACKING_ALERT_WEBHOOK_URL=https://your-webhook-url.com/alerts
```

### Configuration Options

- `COST_TRACKING_ENABLED`: Enable/disable cost tracking (default: true)
- `COST_TRACKING_DAILY_LIMIT`: Daily spending limit in USD (optional)
- `COST_TRACKING_WEEKLY_LIMIT`: Weekly spending limit in USD (optional)
- `COST_TRACKING_MONTHLY_LIMIT`: Monthly spending limit in USD (optional)
- `COST_TRACKING_WARNING_THRESHOLD`: Warning threshold percentage 0-100 (default: 80)
- `COST_TRACKING_ALERT_WEBHOOK_URL`: Webhook URL for cost alerts (optional)

## API Endpoints

All endpoints require authentication via Bearer token.

### GET /api/cost-tracking/stats

Get user usage statistics for a date range.

**Query Parameters:**
- `startDate` (required): ISO 8601 date string
- `endDate` (required): ISO 8601 date string

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCost": 25.50,
    "totalTokens": 10000,
    "totalRequests": 50,
    "averageCostPerRequest": 0.51,
    "averageTokensPerRequest": 200,
    "modelBreakdown": [
      {
        "model": "gpt-4o-mini",
        "requests": 30,
        "tokens": 6000,
        "cost": 15.30,
        "percentage": 60
      }
    ]
  }
}
```

### GET /api/cost-tracking/report

Generate a cost report for a specific period.

**Query Parameters:**
- `period` (required): "daily", "weekly", or "monthly"
- `date` (optional): ISO 8601 date string for the report date

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2024-01-15T00:00:00.000Z",
      "end": "2024-01-15T23:59:59.999Z",
      "type": "daily"
    },
    "summary": {
      "totalCost": 5.25,
      "totalTokens": 1000,
      "totalRequests": 10
    },
    "dailyBreakdown": [...],
    "conversationBreakdown": [...]
  }
}
```

### GET /api/cost-tracking/limits

Check current cost limit status for the user.

**Response:**
```json
{
  "success": true,
  "data": {
    "isWithinLimit": true,
    "currentCost": 5.0,
    "limit": 10.0,
    "warningThreshold": 80,
    "isWarning": false
  }
}
```

### GET /api/cost-tracking/conversation/:conversationId

Get total cost for a specific conversation.

**Response:**
```json
{
  "success": true,
  "data": {
    "conversationId": 123,
    "totalCost": 15.75
  }
}
```

### GET /api/cost-tracking/logs

Get paginated usage logs for the user.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page 1-100 (default: 50)
- `startDate` (optional): ISO 8601 date string
- `endDate` (optional): ISO 8601 date string
- `actionType` (optional): Filter by action type
- `conversationId` (optional): Filter by conversation ID

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 100,
      "totalPages": 2,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### GET /api/cost-tracking/pricing

Get current OpenAI model pricing information.

**Response:**
```json
{
  "success": true,
  "data": {
    "models": [...],
    "pricing": {...},
    "lastUpdated": "2024-01-15T10:30:00.000Z"
  }
}
```

## Usage Examples

### Basic Usage in Code

```typescript
import { CostTrackingService } from '../src/services/CostTrackingService';
import { OpenAIService } from '../src/services/OpenAIService';

const costTrackingService = new CostTrackingService();
const openAIService = new OpenAIService();

// Generate AI response with automatic cost tracking
const aiResponse = await openAIService.generateResponseWithTracking(
  messages,
  userId,
  conversationId,
  'gpt-4o-mini'
);

// Check cost limits before making requests
const costStatus = await costTrackingService.checkCostLimits(userId);
if (!costStatus.isWithinLimit) {
  throw new Error('Cost limit exceeded');
}

// Get usage statistics
const stats = await costTrackingService.getUserUsageStats(
  userId,
  startDate,
  endDate
);

// Generate cost report
const report = await costTrackingService.generateCostReport(
  userId,
  'daily'
);
```

### API Usage Examples

```bash
# Get usage statistics
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/cost-tracking/stats?startDate=2024-01-01&endDate=2024-01-31"

# Generate daily report
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/cost-tracking/report?period=daily&date=2024-01-15"

# Check cost limits
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/cost-tracking/limits"

# Get conversation cost
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/cost-tracking/conversation/123"

# Get usage logs
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/cost-tracking/logs?page=1&limit=20"
```

## Cost Calculation

The system uses current OpenAI pricing (as of 2024):

| Model | Input Cost (per 1M tokens) | Output Cost (per 1M tokens) |
|-------|----------------------------|------------------------------|
| gpt-4o | $5.00 | $15.00 |
| gpt-4o-mini | $0.15 | $0.60 |
| gpt-4-turbo | $10.00 | $30.00 |
| gpt-4 | $30.00 | $60.00 |
| gpt-3.5-turbo | $0.50 | $1.50 |

Cost calculation formula:
```
Total Cost = (Input Tokens / 1000) × Input Rate + (Output Tokens / 1000) × Output Rate
```

## Monitoring and Alerts

### Cost Limits

The system supports three types of cost limits:
- **Daily Limit**: Resets at midnight
- **Weekly Limit**: Resets on Monday
- **Monthly Limit**: Resets on the 1st of each month

### Warning System

When costs reach the warning threshold (default 80% of limit):
- Warning flag is set in cost limit status
- Optional webhook alert is sent
- Logs warning message

### Limit Enforcement

When costs exceed the configured limit:
- `checkCostLimits()` returns `isWithinLimit: false`
- `generateResponseWithTracking()` throws `AIQuotaExceededError`
- Optional webhook alert is sent
- Error is logged

## Testing

The system includes comprehensive test coverage:

```bash
# Run all cost tracking tests
npm test -- --testPathPatterns="CostTracking|UsageLog"

# Run specific test files
npm test tests/services/CostTrackingService.test.ts
npm test tests/repositories/UsageLogRepository.test.ts
npm test tests/controllers/CostTrackingController.test.ts
```

**Test Coverage:**
- 57 total tests
- CostTrackingService: 17 tests
- UsageLogRepository: 21 tests
- CostTrackingController: 19 tests

## Performance Considerations

### Database Optimization

- Indexed columns for efficient queries
- Pagination for large result sets
- Aggregation queries for statistics
- Proper foreign key relationships

### Caching Strategies

Consider implementing caching for:
- Daily/weekly/monthly cost totals
- Frequently accessed usage statistics
- Model pricing information

### Cleanup and Maintenance

- Implement log rotation for old usage logs
- Archive historical data beyond retention period
- Monitor database size and performance
- Regular backup of usage data

## Security Considerations

- All endpoints require authentication
- User isolation (users can only see their own data)
- Input validation and sanitization
- Rate limiting on API endpoints
- Secure webhook URL validation

## Future Enhancements

Potential improvements for the cost tracking system:

1. **Real-time Dashboards**: WebSocket-based live cost monitoring
2. **Budget Forecasting**: Predictive cost analysis based on usage patterns
3. **Team/Organization Limits**: Shared cost limits across multiple users
4. **Cost Optimization**: Recommendations for model selection based on cost/performance
5. **Advanced Alerting**: Multiple notification channels (email, Slack, etc.)
6. **Data Export**: CSV/Excel export of usage data and reports
7. **Cost Attribution**: Tag-based cost allocation for different use cases

## Troubleshooting

### Common Issues

1. **Cost tracking not working**
   - Check `COST_TRACKING_ENABLED` environment variable
   - Verify database connection and migrations
   - Check logs for error messages

2. **Incorrect cost calculations**
   - Verify model pricing in `src/models/AI.ts`
   - Check token counting accuracy
   - Review usage log entries

3. **Limits not enforcing**
   - Confirm limit configuration in environment variables
   - Check date/time calculations for period boundaries
   - Verify `checkCostLimits()` is called before API requests

4. **Performance issues**
   - Review database indexes
   - Implement query optimization
   - Consider caching frequently accessed data

### Debug Information

Enable debug logging by setting `LOG_LEVEL=debug` in your environment variables. This will provide detailed information about:
- Cost calculations
- Limit checks
- Database queries
- API request/response details

## Support

For issues or questions about the cost tracking system:

1. Check the test files for usage examples
2. Review the example code in `examples/cost-tracking-example.ts`
3. Enable debug logging for troubleshooting
4. Check database logs for query performance issues