import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VoluumCampaign {
  id: string;
  name: string;
  status: string;
  workspaceId?: string;
}

interface VoluumReportRow {
  campaignId: string;
  campaignName: string;
  clicks: number;
  conversions: number;
  cost: number;
  revenue: number;
  profit: number;
  roi: number;
  epc: number;
  cvr: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const voluumBaseUrl = Deno.env.get('VOLUUM_BASE_URL') || 'https://api.voluum.com';
    const voluumAccessKey = Deno.env.get('VOLUUM_ACCESS_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    console.log('[voluum-sync] Starting sync...');

    if (!voluumAccessKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'VOLUUM_ACCESS_KEY not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse access key
    const parseAccessKey = (raw: string) => {
      const s = raw.trim();
      if (s.includes(':')) {
        const [id, ...rest] = s.split(':');
        return { accessId: id.trim(), accessKey: rest.join(':').trim() };
      }
      if (s.includes('\n')) {
        const parts = s.split(/\r?\n/).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) return { accessId: parts[0], accessKey: parts[1] };
      }
      return null;
    };

    const creds = parseAccessKey(voluumAccessKey);
    if (!creds) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid VOLUUM_ACCESS_KEY format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate with Voluum
    console.log('[voluum-sync] Authenticating...');
    const authResponse = await fetch(`${voluumBaseUrl}/auth/access/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        accessId: creds.accessId,
        accessKey: creds.accessKey
      })
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('[voluum-sync] Auth failed:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication failed', details: errorText }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authData = await authResponse.json();
    const token = authData.token;
    console.log('[voluum-sync] Authenticated successfully');

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get or create voluum account
    let { data: account } = await supabase
      .from('voluum_accounts')
      .select('id')
      .eq('name', 'Default Account')
      .single();

    if (!account) {
      const { data: newAccount, error: createError } = await supabase
        .from('voluum_accounts')
        .insert({ name: 'Default Account', base_url: voluumBaseUrl })
        .select('id')
        .single();
      
      if (createError) {
        console.error('[voluum-sync] Failed to create account:', createError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create voluum account' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      account = newAccount;
    }

    const accountId = account.id;
    console.log('[voluum-sync] Using account:', accountId);

    // Fetch campaigns from Voluum
    console.log('[voluum-sync] Fetching campaigns...');
    const campaignsResponse = await fetch(`${voluumBaseUrl}/campaign`, {
      headers: {
        'cwauth-token': token,
        'Accept': 'application/json'
      }
    });

    if (!campaignsResponse.ok) {
      const errorText = await campaignsResponse.text();
      console.error('[voluum-sync] Campaigns fetch failed:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch campaigns', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const campaignsData = await campaignsResponse.json();
    const campaigns: VoluumCampaign[] = campaignsData.campaigns || [];
    console.log('[voluum-sync] Found', campaigns.length, 'campaigns');

    // Upsert campaigns to database
    for (const campaign of campaigns) {
      const { error: upsertError } = await supabase
        .from('campaigns')
        .upsert({
          voluum_campaign_id: campaign.id,
          name: campaign.name,
          status_cache: campaign.status || 'unknown',
          account_id: accountId,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'voluum_campaign_id'
        });

      if (upsertError) {
        console.error('[voluum-sync] Failed to upsert campaign:', campaign.id, upsertError);
      }
    }
    console.log('[voluum-sync] Campaigns synced');

    // Fetch report data (last 7 days) - Voluum requires times rounded to the hour
    const now = new Date();
    now.setMinutes(0, 0, 0); // Round down to current hour
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Format as ISO string with only hours (YYYY-MM-DDTHH:00:00Z)
    const formatHour = (d: Date) => {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const hour = String(d.getUTCHours()).padStart(2, '0');
      return `${year}-${month}-${day}T${hour}:00:00Z`;
    };
    
    const fromStr = formatHour(from);
    const toStr = formatHour(now);

    console.log('[voluum-sync] Fetching report from', fromStr, 'to', toStr);
    
    const reportUrl = `${voluumBaseUrl}/report?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&tz=UTC&groupBy=campaign&columns=campaignId,campaignName,clicks,conversions,cost,revenue,profit,roi,epc,cvr`;
    console.log('[voluum-sync] Report URL:', reportUrl);

    const reportResponse = await fetch(reportUrl, {
      headers: {
        'cwauth-token': token,
        'Accept': 'application/json'
      }
    });

    if (!reportResponse.ok) {
      const errorText = await reportResponse.text();
      console.error('[voluum-sync] Report fetch failed:', errorText);
      // Continue without report data - campaigns were synced
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Campaigns synced but report fetch failed',
          campaignsCount: campaigns.length,
          reportError: errorText
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const reportData = await reportResponse.json();
    const rows: VoluumReportRow[] = reportData.rows || [];
    console.log('[voluum-sync] Report has', rows.length, 'rows');

    // Insert metrics snapshots
    let insertedSnapshots = 0;
    for (const row of rows) {
      const { error: insertError } = await supabase
        .from('metrics_snapshots')
        .insert({
          account_id: accountId,
          voluum_campaign_id: row.campaignId,
          clicks: row.clicks || 0,
          conversions: row.conversions || 0,
          cost: row.cost || 0,
          revenue: row.revenue || 0,
          profit: row.profit || 0,
          roi: row.roi || 0,
          epc: row.epc || 0,
          cvr: row.cvr || 0,
          window_start: fromStr,
          window_end: toStr
        });

      if (insertError) {
        console.error('[voluum-sync] Failed to insert snapshot:', row.campaignId, insertError);
      } else {
        insertedSnapshots++;
      }
    }

    console.log('[voluum-sync] Inserted', insertedSnapshots, 'snapshots');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Voluum data synced successfully!',
        campaignsCount: campaigns.length,
        snapshotsInserted: insertedSnapshots,
        period: { from: fromStr, to: toStr }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[voluum-sync] Exception:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: 'Sync failed', message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
