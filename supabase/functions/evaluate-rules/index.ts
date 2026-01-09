import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Rule {
  id: string;
  name: string;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  cooldown_minutes: number;
  is_enabled: boolean;
}

interface MetricsSnapshot {
  id: string;
  voluum_campaign_id: string;
  clicks: number;
  conversions: number;
  cost: number;
  revenue: number;
  profit: number;
  roi: number | null;
  epc: number | null;
  cvr: number | null;
  created_at: string;
}

interface Condition {
  field: string;
  operator: string;
  value: number;
}

// Evaluate a single condition against metrics
function evaluateCondition(condition: Condition, metrics: MetricsSnapshot): boolean {
  const fieldValue = metrics[condition.field as keyof MetricsSnapshot] as number;
  const targetValue = condition.value;

  switch (condition.operator) {
    case '>':
    case 'gt':
      return fieldValue > targetValue;
    case '<':
    case 'lt':
      return fieldValue < targetValue;
    case '>=':
    case 'gte':
      return fieldValue >= targetValue;
    case '<=':
    case 'lte':
      return fieldValue <= targetValue;
    case '==':
    case 'eq':
      return fieldValue === targetValue;
    case '!=':
    case 'ne':
      return fieldValue !== targetValue;
    default:
      console.warn(`Unknown operator: ${condition.operator}`);
      return false;
  }
}

// Check if all conditions match
function evaluateAllConditions(conditions: Condition[], metrics: MetricsSnapshot): boolean {
  if (!conditions || conditions.length === 0) return false;
  return conditions.every(condition => evaluateCondition(condition, metrics));
}

// Send LINE Notify alert
async function sendLineNotify(message: string, lineToken: string): Promise<boolean> {
  try {
    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lineToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `message=${encodeURIComponent(message)}`,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[evaluate-rules] LINE Notify failed:', errorText);
      return false;
    }

    console.log('[evaluate-rules] LINE Notify sent successfully');
    return true;
  } catch (error) {
    console.error('[evaluate-rules] LINE Notify error:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lineToken = Deno.env.get('LINE_NOTIFY_TOKEN');

    console.log('[evaluate-rules] Starting rule evaluation...');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all enabled rules
    const { data: rules, error: rulesError } = await supabase
      .from('rules')
      .select('*')
      .eq('is_enabled', true);

    if (rulesError) {
      console.error('[evaluate-rules] Failed to fetch rules:', rulesError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch rules' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rules || rules.length === 0) {
      console.log('[evaluate-rules] No enabled rules found');
      return new Response(
        JSON.stringify({ success: true, message: 'No enabled rules to evaluate', triggersCreated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[evaluate-rules] Found ${rules.length} enabled rules`);

    // Get latest metrics snapshots (grouped by campaign, most recent)
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('metrics_snapshots')
      .select('*')
      .order('created_at', { ascending: false });

    if (snapshotsError) {
      console.error('[evaluate-rules] Failed to fetch snapshots:', snapshotsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch snapshots' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unique latest snapshot per campaign
    const latestByCampaign = new Map<string, MetricsSnapshot>();
    for (const snapshot of (snapshots || [])) {
      if (!latestByCampaign.has(snapshot.voluum_campaign_id)) {
        latestByCampaign.set(snapshot.voluum_campaign_id, snapshot);
      }
    }

    console.log(`[evaluate-rules] Found ${latestByCampaign.size} campaigns with metrics`);

    let triggersCreated = 0;
    const triggeredRules: string[] = [];

    // Evaluate each rule against each campaign's metrics
    for (const rule of rules as Rule[]) {
      const conditions = Array.isArray(rule.conditions) 
        ? rule.conditions as Condition[]
        : [];

      if (conditions.length === 0) {
        console.log(`[evaluate-rules] Rule "${rule.name}" has no conditions, skipping`);
        continue;
      }

      for (const [campaignId, metrics] of latestByCampaign) {
        // Check cooldown - see if there's a recent trigger for this rule/campaign
        const cooldownTime = new Date(Date.now() - rule.cooldown_minutes * 60 * 1000).toISOString();
        
        const { data: recentTriggers } = await supabase
          .from('rule_triggers')
          .select('id')
          .eq('rule_id', rule.id)
          .eq('voluum_campaign_id', campaignId)
          .gte('triggered_at', cooldownTime)
          .limit(1);

        if (recentTriggers && recentTriggers.length > 0) {
          console.log(`[evaluate-rules] Rule "${rule.name}" is in cooldown for campaign ${campaignId}`);
          continue;
        }

        // Evaluate conditions
        if (evaluateAllConditions(conditions, metrics)) {
          console.log(`[evaluate-rules] Rule "${rule.name}" triggered for campaign ${campaignId}`);

          // Create trigger record
          const { error: triggerError } = await supabase
            .from('rule_triggers')
            .insert({
              rule_id: rule.id,
              voluum_campaign_id: campaignId,
              snapshot_id: metrics.id,
              status: 'triggered',
              action_result: { conditions_matched: conditions }
            });

          if (triggerError) {
            console.error('[evaluate-rules] Failed to create trigger:', triggerError);
            continue;
          }

          triggersCreated++;
          triggeredRules.push(`${rule.name} (${campaignId.slice(0, 8)}...)`);

          // Send LINE Notify if configured
          if (lineToken) {
            const message = `
🚨 Rule Triggered: ${rule.name}
📊 Campaign: ${campaignId.slice(0, 12)}...
📈 Metrics:
- Profit: $${metrics.profit?.toFixed(2) || 0}
- ROI: ${metrics.roi?.toFixed(1) || 0}%
- Clicks: ${metrics.clicks || 0}
- Conversions: ${metrics.conversions || 0}
⏰ Time: ${new Date().toISOString()}`;

            const notifySent = await sendLineNotify(message, lineToken);
            
            // Update trigger with notification result
            await supabase
              .from('rule_triggers')
              .update({
                status: notifySent ? 'completed' : 'notify_failed',
                action_result: { 
                  conditions_matched: conditions,
                  line_notify_sent: notifySent 
                }
              })
              .eq('rule_id', rule.id)
              .eq('voluum_campaign_id', campaignId)
              .order('triggered_at', { ascending: false })
              .limit(1);
          }
        }
      }
    }

    console.log(`[evaluate-rules] Completed. Created ${triggersCreated} triggers`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Rule evaluation completed`,
        triggersCreated,
        triggeredRules,
        rulesEvaluated: rules.length,
        campaignsChecked: latestByCampaign.size
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[evaluate-rules] Exception:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: 'Rule evaluation failed', message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
