/**
 * Cost Tracking System Example
 * 
 * This example demonstrates how to use the cost tracking and monitoring system
 * that was implemented for the personal chatbot application.
 */

import { CostTrackingService } from '../src/services/CostTrackingService';
import { OpenAIService } from '../src/services/OpenAIService';
import { AIResponse, ChatMessage } from '../src/models/AI';

// Example usage of the cost tracking system
async function demonstrateCostTracking() {
  const costTrackingService = new CostTrackingService();
  const openAIService = new OpenAIService();

  const userId = 1;
  const conversationId = 1;

  console.log('=== Cost Tracking System Demo ===\n');

  // 1. Generate AI response with cost tracking
  console.log('1. Generating AI response with cost tracking...');
  
  const messages: ChatMessage[] = [
    { role: 'user', content: 'Hello, how are you today?' }
  ];

  try {
    // Use the new method that includes cost tracking
    const aiResponse = await openAIService.generateResponseWithTracking(
      messages,
      userId,
      conversationId,
      'gpt-4o-mini'
    );

    console.log(`   Response: ${aiResponse.content.substring(0, 100)}...`);
    console.log(`   Tokens used: ${aiResponse.usage.totalTokens}`);
    console.log(`   Cost: $${aiResponse.cost.toFixed(4)}`);
    console.log(`   Model: ${aiResponse.model}\n`);

  } catch (error) {
    console.error('   Error generating response:', error);
  }

  // 2. Check cost limits
  console.log('2. Checking cost limits...');
  
  try {
    const costLimitStatus = await costTrackingService.checkCostLimits(userId);
    
    console.log(`   Within limits: ${costLimitStatus.isWithinLimit}`);
    console.log(`   Current cost: $${costLimitStatus.currentCost?.toFixed(4) || '0.0000'}`);
    console.log(`   Daily limit: $${costLimitStatus.limit?.toFixed(2) || 'Not set'}`);
    console.log(`   Warning: ${costLimitStatus.isWarning ? 'Yes' : 'No'}\n`);

  } catch (error) {
    console.error('   Error checking cost limits:', error);
  }

  // 3. Get usage statistics
  console.log('3. Getting usage statistics...');
  
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Last 7 days
    const endDate = new Date();

    const stats = await costTrackingService.getUserUsageStats(userId, startDate, endDate);
    
    console.log(`   Total cost (7 days): $${stats.totalCost.toFixed(4)}`);
    console.log(`   Total tokens: ${stats.totalTokens}`);
    console.log(`   Total requests: ${stats.totalRequests}`);
    console.log(`   Average cost per request: $${stats.averageCostPerRequest.toFixed(4)}`);
    console.log(`   Average tokens per request: ${stats.averageTokensPerRequest.toFixed(0)}`);
    
    if (stats.modelBreakdown.length > 0) {
      console.log('   Model breakdown:');
      stats.modelBreakdown.forEach(model => {
        console.log(`     ${model.model}: ${model.requests} requests, $${model.cost.toFixed(4)} (${model.percentage.toFixed(1)}%)`);
      });
    }
    console.log();

  } catch (error) {
    console.error('   Error getting usage stats:', error);
  }

  // 4. Generate cost report
  console.log('4. Generating daily cost report...');
  
  try {
    const report = await costTrackingService.generateCostReport(userId, 'daily');
    
    console.log(`   Report period: ${report.period.start.toDateString()} - ${report.period.end.toDateString()}`);
    console.log(`   Total cost: $${report.summary.totalCost.toFixed(4)}`);
    console.log(`   Total requests: ${report.summary.totalRequests}`);
    
    if (report.conversationBreakdown.length > 0) {
      console.log('   Top conversations by cost:');
      report.conversationBreakdown.slice(0, 3).forEach((conv, index) => {
        console.log(`     ${index + 1}. ${conv.conversationTitle || `Conversation ${conv.conversationId}`}: $${conv.cost.toFixed(4)}`);
      });
    }
    console.log();

  } catch (error) {
    console.error('   Error generating cost report:', error);
  }

  // 5. Get conversation cost
  console.log('5. Getting conversation cost...');
  
  try {
    const conversationCost = await costTrackingService.getConversationCost(conversationId);
    console.log(`   Conversation ${conversationId} total cost: $${conversationCost.toFixed(4)}\n`);

  } catch (error) {
    console.error('   Error getting conversation cost:', error);
  }

  // 6. Get usage logs with pagination
  console.log('6. Getting recent usage logs...');
  
  try {
    const logsResult = await costTrackingService.getUserUsageLogs(userId, {
      limit: 5,
      offset: 0,
    });
    
    console.log(`   Found ${logsResult.total} total usage logs`);
    console.log('   Recent logs:');
    
    logsResult.logs.forEach((log, index) => {
      console.log(`     ${index + 1}. ${log.actionType} - ${log.model || 'N/A'} - ${log.tokensUsed} tokens - $${log.costUsd.toFixed(4)} - ${log.createdAt.toISOString()}`);
    });
    console.log();

  } catch (error) {
    console.error('   Error getting usage logs:', error);
  }

  console.log('=== Demo Complete ===');
}

// API Endpoints Usage Examples
function demonstrateAPIEndpoints() {
  console.log('\n=== API Endpoints Usage Examples ===\n');

  console.log('1. Get user usage statistics:');
  console.log('   GET /api/cost-tracking/stats?startDate=2024-01-01&endDate=2024-01-31');
  console.log('   Authorization: Bearer <token>\n');

  console.log('2. Generate cost report:');
  console.log('   GET /api/cost-tracking/report?period=daily&date=2024-01-15');
  console.log('   Authorization: Bearer <token>\n');

  console.log('3. Check cost limits:');
  console.log('   GET /api/cost-tracking/limits');
  console.log('   Authorization: Bearer <token>\n');

  console.log('4. Get conversation cost:');
  console.log('   GET /api/cost-tracking/conversation/123');
  console.log('   Authorization: Bearer <token>\n');

  console.log('5. Get usage logs with pagination:');
  console.log('   GET /api/cost-tracking/logs?page=1&limit=20&actionType=message_received');
  console.log('   Authorization: Bearer <token>\n');

  console.log('6. Get pricing information:');
  console.log('   GET /api/cost-tracking/pricing');
  console.log('   Authorization: Bearer <token>\n');
}

// Environment Configuration Examples
function demonstrateEnvironmentConfiguration() {
  console.log('\n=== Environment Configuration Examples ===\n');

  console.log('Add these environment variables to your .env file:\n');

  console.log('# Cost tracking configuration');
  console.log('COST_TRACKING_ENABLED=true');
  console.log('COST_TRACKING_DAILY_LIMIT=10.00');
  console.log('COST_TRACKING_WEEKLY_LIMIT=50.00');
  console.log('COST_TRACKING_MONTHLY_LIMIT=200.00');
  console.log('COST_TRACKING_WARNING_THRESHOLD=80');
  console.log('COST_TRACKING_ALERT_WEBHOOK_URL=https://your-webhook-url.com/alerts');
  console.log();

  console.log('Configuration explanation:');
  console.log('- COST_TRACKING_ENABLED: Enable/disable cost tracking (default: true)');
  console.log('- COST_TRACKING_DAILY_LIMIT: Daily spending limit in USD');
  console.log('- COST_TRACKING_WEEKLY_LIMIT: Weekly spending limit in USD');
  console.log('- COST_TRACKING_MONTHLY_LIMIT: Monthly spending limit in USD');
  console.log('- COST_TRACKING_WARNING_THRESHOLD: Warning threshold percentage (0-100)');
  console.log('- COST_TRACKING_ALERT_WEBHOOK_URL: Webhook URL for cost alerts');
}

// Run the demonstration
if (require.main === module) {
  demonstrateCostTracking()
    .then(() => {
      demonstrateAPIEndpoints();
      demonstrateEnvironmentConfiguration();
    })
    .catch(console.error);
}

export {
  demonstrateCostTracking,
  demonstrateAPIEndpoints,
  demonstrateEnvironmentConfiguration,
};