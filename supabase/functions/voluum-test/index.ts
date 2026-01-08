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
    const voluumAuthHeader = Deno.env.get('VOLUUM_AUTH_HEADER') || 'cwauth-token';

    console.log('[voluum-test] Starting connection test');
    console.log('[voluum-test] Base URL:', voluumBaseUrl);
    console.log('[voluum-test] Auth Header:', voluumAuthHeader);
    console.log('[voluum-test] Access Key configured:', !!voluumAccessKey);

    // Check if access key is configured
    if (!voluumAccessKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'VOLUUM_ACCESS_KEY not configured',
          message: 'Please add your Voluum Access Key in the secrets configuration',
          help: 'Go to Cloud settings and add the VOLUUM_ACCESS_KEY secret'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Test connection by fetching user/account info
    // Using the /user endpoint which is lightweight
    const testUrl = `${voluumBaseUrl}/user`;
    console.log('[voluum-test] Testing URL:', testUrl);

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        [voluumAuthHeader]: voluumAccessKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log('[voluum-test] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[voluum-test] Error response:', errorText);

      let errorMessage = 'Voluum API connection failed';
      let help = '';

      if (response.status === 401) {
        errorMessage = 'Authentication failed - Invalid access key';
        help = 'Check that your VOLUUM_ACCESS_KEY is correct and not expired';
      } else if (response.status === 403) {
        errorMessage = 'Access forbidden - Check API permissions';
        help = 'Ensure your Voluum API key has the required permissions';
      } else if (response.status === 404) {
        errorMessage = 'Endpoint not found - Check base URL';
        help = 'Verify VOLUUM_BASE_URL is correct (default: https://api.voluum.com)';
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          status: response.status,
          details: errorText,
          help: help,
          config: {
            baseUrl: voluumBaseUrl,
            authHeader: voluumAuthHeader,
            accessKeyConfigured: true
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse successful response
    const userData = await response.json();
    console.log('[voluum-test] Success! User data received');

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
        config: {
          baseUrl: voluumBaseUrl,
          authHeader: voluumAuthHeader
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
