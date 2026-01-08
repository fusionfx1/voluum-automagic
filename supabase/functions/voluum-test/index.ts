import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const voluumBaseUrl = Deno.env.get('VOLUUM_BASE_URL') || 'https://api.voluum.com';
    const voluumAccessKey = Deno.env.get('VOLUUM_ACCESS_KEY');

    console.log('[voluum-test] Starting connection test');
    console.log('[voluum-test] Base URL:', voluumBaseUrl);
    console.log('[voluum-test] Access Key configured:', !!voluumAccessKey);

    // Check if access key is configured
    if (!voluumAccessKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'VOLUUM_ACCESS_KEY not configured',
          message: 'Please add your Voluum Access Key in the secrets configuration',
          help: 'Go to Cloud settings and add the VOLUUM_ACCESS_KEY secret. Format: accessId:accessKey'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse the access key - format should be "accessId:accessKey"
    if (!voluumAccessKey.includes(':')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid VOLUUM_ACCESS_KEY format',
          message: 'Access key must be in format: accessId:accessKey',
          help: 'Example: 0ba3900f-9dd4-4d73-a4a3-aea436706576:RamijzQSm95LMDL9_yEIPsgadKyZKK130Ym9'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const [accessId, accessKey] = voluumAccessKey.split(':');
    console.log('[voluum-test] Access ID:', accessId.slice(0, 8) + '...');
    
    // Authenticate to get session token
    // Per Voluum docs: POST to /auth/access/session with accessId and accessKey
    const authUrl = `${voluumBaseUrl}/auth/access/session`;
    console.log('[voluum-test] Auth URL:', authUrl);
    
    const authResponse = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        accessId: accessId.trim(),
        accessKey: accessKey.trim()
      })
    });

    console.log('[voluum-test] Auth response status:', authResponse.status);

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('[voluum-test] Auth error:', errorText);
      
      let help = 'Check that your Access Key ID and Access Key are correct.';
      if (authResponse.status === 401) {
        help = 'Invalid credentials. Please verify your Access Key ID and Access Key from Voluum Security settings.';
      } else if (authResponse.status === 400) {
        help = 'Bad request. Make sure the format is: accessId:accessKey';
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Authentication failed',
          message: `Voluum API returned status ${authResponse.status}`,
          details: errorText,
          help: help,
          status: authResponse.status
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const authData = await authResponse.json();
    const token = authData.token;
    console.log('[voluum-test] Got session token successfully');
    console.log('[voluum-test] Token expires:', authData.expirationTimestamp);

    // Test connection by fetching user info
    const testUrl = `${voluumBaseUrl}/user`;
    console.log('[voluum-test] Testing URL:', testUrl);

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'cwauth-token': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log('[voluum-test] User API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[voluum-test] User API error:', errorText);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch user info',
          message: `Voluum API returned status ${response.status}`,
          details: errorText,
          help: 'Authentication succeeded but user info fetch failed. This might be a permissions issue.',
          tokenObtained: true
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse successful response
    const userData = await response.json();
    console.log('[voluum-test] Success! User data received:', userData.email);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Voluum API connection successful!',
        user: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          timezone: userData.timezone,
          workspaceId: userData.workspaceId
        },
        session: {
          expiresAt: authData.expirationTimestamp,
          inaugural: authData.inaugural
        },
        config: {
          baseUrl: voluumBaseUrl
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('[voluum-test] Exception:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Connection test failed',
        message: errorMessage,
        help: 'Check network connectivity and Voluum service status'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
